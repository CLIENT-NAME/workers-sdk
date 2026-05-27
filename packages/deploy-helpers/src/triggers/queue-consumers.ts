import { UserError } from "@cloudflare/workers-utils";
import type { DeployHelpersContext } from "../shared/types";
import type { Config, ComplianceConfig } from "@cloudflare/workers-utils";

interface QueueResponse {
	queue_id: string;
	queue_name: string;
	created_on: string;
	modified_on: string;
	consumers: Consumer[];
}

interface Consumer {
	script?: string;
	service?: string;
	environment?: string;
	consumer_id: string;
	type: string;
}

interface PostTypedConsumerBody {
	type: string;
	script_name?: string;
	environment_name?: string;
	settings: {
		batch_size?: number;
		max_retries?: number;
		max_wait_time_ms?: number;
		max_concurrency?: number | null;
		retry_delay?: number;
	};
	dead_letter_queue?: string;
}

interface TypedConsumerResponse extends Consumer {
	queue_name: string;
	created_on: string;
}

async function getQueue(
	complianceConfig: ComplianceConfig,
	accountId: string,
	queueName: string,
	ctx: DeployHelpersContext
): Promise<QueueResponse> {
	const queues = await ctx.fetchResult<QueueResponse[]>(
		complianceConfig,
		`/accounts/${accountId}/queues`,
		{},
		new URLSearchParams({ page: "1", name: queueName })
	);
	if (queues.length === 0) {
		throw new UserError(
			`Queue "${queueName}" does not exist. To create it, run: wrangler queues create ${queueName}`,
			{ telemetryMessage: "queues lookup missing queue" }
		);
	}
	return queues[0];
}

async function postConsumer(
	complianceConfig: ComplianceConfig,
	accountId: string,
	queueName: string,
	body: PostTypedConsumerBody,
	ctx: DeployHelpersContext
): Promise<TypedConsumerResponse> {
	const queue = await getQueue(complianceConfig, accountId, queueName, ctx);
	return ctx.fetchResult(
		complianceConfig,
		`/accounts/${accountId}/queues/${queue.queue_id}/consumers`,
		{
			method: "POST",
			body: JSON.stringify(body),
		}
	);
}

async function putConsumer(
	complianceConfig: ComplianceConfig,
	accountId: string,
	queueName: string,
	scriptName: string,
	body: PostTypedConsumerBody,
	ctx: DeployHelpersContext
): Promise<TypedConsumerResponse> {
	const queue = await getQueue(complianceConfig, accountId, queueName, ctx);
	const targetConsumer = queue.consumers.find(
		(c) =>
			c.type === "worker" &&
			(c.script === scriptName || c.service === scriptName)
	);
	if (!targetConsumer) {
		throw new UserError(
			`No worker consumer '${scriptName}' exists for queue ${queueName}`,
			{ telemetryMessage: "queues worker consumer missing" }
		);
	}
	return ctx.fetchResult(
		complianceConfig,
		`/accounts/${accountId}/queues/${queue.queue_id}/consumers/${targetConsumer.consumer_id}`,
		{
			method: "PUT",
			body: JSON.stringify(body),
		}
	);
}

export async function updateQueueConsumers(
	complianceConfig: ComplianceConfig,
	accountId: string,
	scriptName: string,
	config: Config,
	ctx: DeployHelpersContext
): Promise<Promise<string[]>[]> {
	const consumers = config.queues.consumers || [];
	const updateConsumers: Promise<string[]>[] = [];
	for (const consumer of consumers) {
		const queue = await getQueue(
			complianceConfig,
			accountId,
			consumer.queue,
			ctx
		);

		const body: PostTypedConsumerBody = {
			type: "worker",
			dead_letter_queue: consumer.dead_letter_queue,
			script_name: scriptName,
			settings: {
				batch_size: consumer.max_batch_size,
				max_retries: consumer.max_retries,
				max_wait_time_ms:
					consumer.max_batch_timeout !== undefined
						? 1000 * consumer.max_batch_timeout
						: undefined,
				max_concurrency: consumer.max_concurrency,
				retry_delay: consumer.retry_delay,
			},
		};

		const existingConsumer =
			queue.consumers.filter(
				(c) => c.script === scriptName || c.service === scriptName
			).length > 0;
		if (existingConsumer) {
			updateConsumers.push(
				putConsumer(
					complianceConfig,
					accountId,
					consumer.queue,
					scriptName,
					body,
					ctx
				).then(() => [`Consumer for ${consumer.queue}`])
			);
			continue;
		}
		updateConsumers.push(
			postConsumer(
				complianceConfig,
				accountId,
				consumer.queue,
				body,
				ctx
			).then(() => [`Consumer for ${consumer.queue}`])
		);
	}

	return updateConsumers;
}

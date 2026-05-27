import { triggersDeploy as triggersDeployImpl } from "@cloudflare/deploy-helpers";
import { fetchListResult, fetchResult } from "../cfetch";
import { confirm, prompt } from "../dialogs";
import { logger } from "../logger";
import type { TriggerProps } from "@cloudflare/deploy-helpers";

export default async function triggersDeploy(
	props: TriggerProps
): Promise<string[] | void> {
	return triggersDeployImpl(props, {
		fetchResult,
		fetchListResult,
		logger,
		confirm,
		prompt,
	});
}

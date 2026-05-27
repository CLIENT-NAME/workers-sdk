import { UserError } from "@cloudflare/workers-utils";
import type { DeployHelpersContext } from "../shared/types";
import type { ComplianceConfig, Route } from "@cloudflare/workers-utils";

export interface Zone {
	id: string;
	host: string;
}

export type ZoneIdCache = Map<string, Promise<string | null>>;

export function getHostFromRoute(route: Route): string | undefined {
	let host: string | undefined;

	if (typeof route === "string") {
		host = getHostFromUrl(route);
	} else if (typeof route === "object") {
		host = getHostFromUrl(route.pattern);

		if (host === undefined && "zone_name" in route) {
			host = getHostFromUrl(route.zone_name);
		}
	}

	return host;
}

function getHostFromUrl(urlLike: string): string | undefined {
	if (
		urlLike.startsWith("*/") ||
		urlLike.startsWith("http://*/") ||
		urlLike.startsWith("https://*/")
	) {
		return undefined;
	}

	urlLike = urlLike.replace(/\*(\.)?/g, "");

	if (!(urlLike.startsWith("http://") || urlLike.startsWith("https://"))) {
		urlLike = "http://" + urlLike;
	}

	try {
		return new URL(urlLike).host;
	} catch {
		return undefined;
	}
}

export async function getZoneForRoute(
	complianceConfig: ComplianceConfig,
	from: {
		route: Route;
		accountId: string;
	},
	ctx: DeployHelpersContext,
	zoneIdCache: ZoneIdCache = new Map()
): Promise<Zone | undefined> {
	const { route, accountId } = from;
	const host = getHostFromRoute(route);
	let id: string | undefined;

	if (typeof route === "object" && "zone_id" in route) {
		id = route.zone_id;
	} else if (typeof route === "object" && "zone_name" in route) {
		id = await getZoneIdFromHost(
			complianceConfig,
			{ host: route.zone_name, accountId },
			ctx,
			zoneIdCache
		);
	} else if (host) {
		id = await getZoneIdFromHost(
			complianceConfig,
			{ host, accountId },
			ctx,
			zoneIdCache
		);
	}

	return id && host ? { id, host } : undefined;
}

async function getZoneIdFromHost(
	complianceConfig: ComplianceConfig,
	from: {
		host: string;
		accountId: string;
	},
	ctx: DeployHelpersContext,
	zoneIdCache: ZoneIdCache
): Promise<string> {
	const hostPieces = from.host.split(".");

	while (hostPieces.length > 1) {
		const cacheKey = `${from.accountId}:${hostPieces.join(".")}`;
		if (!zoneIdCache.has(cacheKey)) {
			zoneIdCache.set(
				cacheKey,
				ctx
					.fetchListResult<{ id: string }>(
						complianceConfig,
						`/zones`,
						{},
						new URLSearchParams({
							name: hostPieces.join("."),
							"account.id": from.accountId,
						})
					)
					.then((zones) => zones[0]?.id ?? null)
			);
		}

		const cachedZone = await zoneIdCache.get(cacheKey);
		if (cachedZone) {
			return cachedZone;
		}

		hostPieces.shift();
	}

	throw new UserError(
		`Could not find zone for \`${from.host}\`. Make sure the domain is set up to be proxied by Cloudflare.\nFor more details, refer to https://developers.cloudflare.com/workers/configuration/routing/routes/#set-up-a-route`,
		{ telemetryMessage: "zones route zone not found" }
	);
}

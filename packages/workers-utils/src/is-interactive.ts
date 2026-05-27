import ci from "ci-info";

function isInteractive(): boolean {
	if (ci.CLOUDFLARE_PAGES || ci.CLOUDFLARE_WORKERS) {
		return false;
	}

	try {
		return Boolean(process.stdin.isTTY && process.stdout.isTTY);
	} catch {
		return false;
	}
}

export function isNonInteractiveOrCI(): boolean {
	return !isInteractive() || ci.isCI;
}

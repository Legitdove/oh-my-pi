import * as fs from "node:fs/promises";
import path from "node:path";

/** Generic append-only journal for native child executions, stored with the parent session artifacts. */
export const NATIVE_CHILD_INVOCATION_JOURNAL = "native-child-invocations.jsonl";
export type NativeChildInvocationStatus = "CREATED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type NativeChildInvocation = {
	invocationId: string;
	parentSessionId?: string;
	childSessionId?: string;
	childSessionFile?: string;
	agent: string;
	status: NativeChildInvocationStatus;
	createdAt: string;
	startedAt?: string;
	terminalAt?: string;
	terminal?: { exitCode: number; error?: string; aborted?: boolean; structuredOutput?: unknown };
};

function pathFor(parentSessionFile: string | undefined): string | undefined {
	return parentSessionFile ? path.join(parentSessionFile.slice(0, -6), NATIVE_CHILD_INVOCATION_JOURNAL) : undefined;
}

export async function appendNativeChildInvocation(parentSessionFile: string | undefined, record: NativeChildInvocation): Promise<void> {
	const journal = pathFor(parentSessionFile);
	if (!journal) return;
	await fs.mkdir(path.dirname(journal), { recursive: true });
	await fs.appendFile(journal, `${JSON.stringify(record)}\n`, "utf8");
}

/** Last valid entry wins; a torn final JSONL write after process death is ignored. */
export async function getNativeChildInvocation(parentSessionFile: string | undefined, invocationId: string): Promise<NativeChildInvocation | undefined> {
	const journal = pathFor(parentSessionFile);
	if (!journal) return undefined;
	let content: string;
	try { content = await fs.readFile(journal, "utf8"); } catch { return undefined; }
	let current: NativeChildInvocation | undefined;
	for (const line of content.split("\n")) {
		if (!line) continue;
		try { const entry = JSON.parse(line) as NativeChildInvocation; if (entry.invocationId === invocationId) current = entry; } catch { /* final partial append is not a record */ }
	}
	return current;
}

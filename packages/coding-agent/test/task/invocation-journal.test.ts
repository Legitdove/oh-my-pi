import { afterEach, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import path from "node:path";
import { appendNativeChildInvocation, getNativeChildInvocation } from "../../src/task/invocation-journal";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))); });

async function parentSession() {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "omp-invocation-journal-")); roots.push(root);
	return path.join(root, "parent.jsonl");
}

test("append-only invocation journal survives a fresh lookup without process memory", async () => {
	const session = await parentSession();
	await appendNativeChildInvocation(session, { invocationId: "inv-1", parentSessionId: "parent", agent: "task", status: "CREATED", createdAt: "2026-01-01T00:00:00.000Z" });
	await appendNativeChildInvocation(session, { invocationId: "inv-1", parentSessionId: "parent", childSessionId: "child", childSessionFile: "/tmp/child.jsonl", agent: "task", status: "RUNNING", createdAt: "2026-01-01T00:00:00.000Z", startedAt: "2026-01-01T00:00:01.000Z" });
	const fresh = await getNativeChildInvocation(session, "inv-1");
	expect(fresh).toMatchObject({ invocationId: "inv-1", status: "RUNNING", childSessionId: "child" });
});

test("terminal structured result is the final durable record", async () => {
	const session = await parentSession();
	await appendNativeChildInvocation(session, { invocationId: "inv-2", agent: "task", status: "CREATED", createdAt: "2026-01-01T00:00:00.000Z" });
	await appendNativeChildInvocation(session, { invocationId: "inv-2", agent: "task", status: "COMPLETED", createdAt: "2026-01-01T00:00:00.000Z", terminalAt: "2026-01-01T00:00:02.000Z", terminal: { exitCode: 0, structuredOutput: { status: "valid", data: { ok: true } } } });
	const fresh = await getNativeChildInvocation(session, "inv-2");
	expect(fresh?.status).toBe("COMPLETED");
	expect(fresh?.terminal?.structuredOutput).toEqual({ status: "valid", data: { ok: true } });
});

// Butterbase access for the driver — via the MCP server over stdio (the
// proven-working path; the same one that provisioned the schema).
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

export const APP_ID = process.env.BUTTERBASE_APP_ID ?? "app_0hd3xjnzr9cv";

let child: ChildProcess | null = null;
const pending = new Map<number, (msg: any) => void>();
let nextId = 1;

function ensureChild(): ChildProcess {
  if (child) return child;
  child = spawn("sh", ["-c", "set -a; . ./.env; exec npx -y @butterbase/mcp"], {
    env: {
      ...process.env,
      BUTTERBASE_REGIONS: "us-east-1,us-west-2,eu-central-1",
      BUTTERBASE_REGION: "us-west-2",
      CONTROL_API_URL: "https://api.butterbase.ai",
    },
    stdio: ["pipe", "pipe", "ignore"],
  });
  const rl = createInterface({ input: child.stdout! });
  rl.on("line", (line) => {
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)!(msg);
        pending.delete(msg.id);
      }
    } catch {}
  });
  // MCP handshake
  send({ jsonrpc: "2.0", id: nextId++, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "meridian-driver", version: "0.1" } } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  return child;
}

function send(obj: unknown) {
  ensureChild().stdin!.write(JSON.stringify(obj) + "\n");
}

function request(method: string, params: unknown): Promise<any> {
  ensureChild();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`butterbase timeout: ${method}`)), 60000);
    pending.set(id, (m) => { clearTimeout(t); resolve(m); });
    send({ jsonrpc: "2.0", id, method, params });
  });
}

async function call(name: string, args: Record<string, unknown>): Promise<any> {
  const r = await request("tools/call", { name, arguments: { app_id: APP_ID, ...args } });
  if (r.error) throw new Error(`${name}: ${JSON.stringify(r.error)}`);
  const text = r.result?.content?.map((c: any) => c.text).join("\n") ?? "";
  if (r.result?.isError) throw new Error(`${name}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

export const selectRows = (table: string) => call("select_rows", { table, limit: 100 });
export const insertRow = (table: string, data: Record<string, unknown>) => call("insert_row", { table, data });

// "push issue #N to phase M" — no update tool in their MCP; PATCH the
// auto-generated REST API directly (driver-side env, same key as MCP).
export async function updateIssuePhase(issueId: number, phaseId: number): Promise<boolean> {
  const base = process.env.ROCKETRIDE_BUTTERBASE_API_BASE;
  const key = process.env.BUTTERBASE_API_KEY;
  if (!base) return false;
  for (const url of [`${base}/issues/${issueId}`, `${base}/tables/issues/rows/${issueId}`]) {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ phase_id: phaseId }),
      });
      if (res.ok) return true;
    } catch {}
  }
  return false;
}

export function shutdown() {
  child?.kill();
  child = null;
}

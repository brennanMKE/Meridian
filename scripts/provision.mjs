#!/usr/bin/env node
// Provision the BarkPark schema + seed data on Butterbase via its MCP server.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";

const APP_ID = process.env.BUTTERBASE_APP_ID;
if (!APP_ID) { console.error("Set BUTTERBASE_APP_ID in .env"); process.exit(1); }
const PROJECT = new URL("..", import.meta.url).pathname;
const seed = JSON.parse(readFileSync(`${PROJECT}/sample-project/seed-data.json`, "utf8"));

const child = spawn("sh", ["-c", "set -a; . ./.env; exec npx -y @butterbase/mcp"], {
  cwd: PROJECT,
  env: { ...process.env, BUTTERBASE_REGIONS: "us-east-1,us-west-2,eu-central-1", BUTTERBASE_REGION: "us-west-2", CONTROL_API_URL: "https://api.butterbase.ai" },
  stdio: ["pipe", "pipe", "inherit"],
});
const rl = createInterface({ input: child.stdout });
const pending = new Map();
let nextId = 1;
rl.on("line", (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (o) => child.stdin.write(JSON.stringify(o) + "\n");
const request = (method, params) => {
  const id = nextId++;
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout: ${method}`)), 120000);
    pending.set(id, (m) => { clearTimeout(t); res(m); });
    send({ jsonrpc: "2.0", id, method, params });
  });
};
const call = async (name, args) => {
  const r = await request("tools/call", { name, arguments: args });
  if (r.error) throw new Error(`${name}: ${JSON.stringify(r.error)}`);
  const text = r.result?.content?.map((c) => c.text).join("\n") ?? JSON.stringify(r.result);
  if (r.result?.isError) throw new Error(`${name} failed: ${text.slice(0, 800)}`);
  return text;
};

await request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "barkpark-provision", version: "0.1" } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });

const schema = {
  tables: {
    teams: {
      columns: {
        id: { type: "integer", primaryKey: true },
        name: { type: "text", nullable: false },
        lead: { type: "text" },
      },
    },
    phases: {
      columns: {
        id: { type: "integer", primaryKey: true },
        name: { type: "text", nullable: false },
        sort_order: { type: "integer", nullable: false },
        status: { type: "text", nullable: false, default: "'planned'" },
      },
    },
    users: {
      columns: {
        id: { type: "integer", primaryKey: true },
        team_id: { type: "integer", references: "teams.id" },
        name: { type: "text", nullable: false },
        role: { type: "text", nullable: false },
        slack_id: { type: "text" },
      },
    },
    issues: {
      columns: {
        id: { type: "integer", primaryKey: true },
        team_id: { type: "integer", nullable: false, references: "teams.id" },
        phase_id: { type: "integer", nullable: false, references: "phases.id" },
        title: { type: "text", nullable: false },
        status: { type: "text", nullable: false, default: "'planned'" },
        owner: { type: "text" },
        committed_date: { type: "date" },
        actual_date: { type: "date" },
      },
      indexes: {
        issues_team_idx: { columns: ["team_id"] },
        issues_phase_idx: { columns: ["phase_id"] },
      },
    },
    dependencies: {
      columns: {
        id: { type: "integer", primaryKey: true },
        from_issue_id: { type: "integer", nullable: false, references: { table: "issues", column: "id", onDelete: "CASCADE" } },
        to_issue_id: { type: "integer", nullable: false, references: { table: "issues", column: "id", onDelete: "CASCADE" } },
        type: { type: "text", nullable: false, default: "'blocks'" },
      },
    },
    memory_events: {
      columns: {
        // NOTE: id (serial pk) exists in PG but their introspection hides it;
        // declaring it makes the differ emit a failing ADD COLUMN. Omit it.
        issue_id: { type: "integer", references: "issues.id" },
        event_type: { type: "text", nullable: false },
        content: { type: "text", nullable: false },
        created_at: { type: "timestamptz", nullable: false, default: "now()" },
      },
    },
  },
};

const step = process.argv[2] ?? "all";
// Optional: limit schema to a comma-separated table subset (bisection/debug)
if (process.argv[3]) {
  const keep = new Set(process.argv[3].split(","));
  for (const t of Object.keys(schema.tables)) if (!keep.has(t)) delete schema.tables[t];
}

if (step === "dry_run" || step === "all") {
  console.log("--- dry_run ---");
  console.log((await call("manage_schema", { app_id: APP_ID, action: "dry_run", schema })).slice(0, 3000));
}
if (step === "apply" || step === "all") {
  // Two-pass apply, working around two quirks in Butterbase's schema differ:
  //  (a) it falsely flags two FKs from one NEW table to the same target as
  //      "circular" — so pass 1 creates `dependencies` without FKs and pass 2
  //      adds them via ALTER once the table exists;
  //  (b) serial PK columns are hidden from its introspection — so pass 1
  //      declares memory_events.id (needed for CREATE) and pass 2 omits it
  //      (re-declaring it makes the differ emit a failing ADD COLUMN).
  const pass1 = structuredClone(schema);
  delete pass1.tables.dependencies.columns.from_issue_id.references;
  delete pass1.tables.dependencies.columns.to_issue_id.references;
  pass1.tables.memory_events.columns = {
    id: { type: "serial", primaryKey: true },
    ...pass1.tables.memory_events.columns,
  };
  console.log("--- apply pass 1 (create tables) ---");
  try {
    console.log((await call("manage_schema", { app_id: APP_ID, action: "apply", schema: pass1 })).slice(0, 400));
  } catch (e) {
    // On an already-provisioned app the memory_events re-diff fails — benign.
    console.log(`pass 1: ${String(e.message).slice(0, 120)} (ok if tables already exist)`);
  }
  console.log("--- apply pass 2 (add dependency FKs) ---");
  console.log((await call("manage_schema", { app_id: APP_ID, action: "apply", schema })).slice(0, 800));
  console.log("--- seeding ---");
  for (const table of ["teams", "phases", "users", "issues", "dependencies"]) {
    const rows = seed[table];
    try {
      const out = await call("seed_database", { app_id: APP_ID, table, rows });
      const m = out.match(/"inserted":\s*(\d+)[\s\S]*?"failed":\s*(\d+)/);
      console.log(`${table}: inserted=${m?.[1]} failed=${m?.[2]}`);
    } catch (e) {
      console.log(`${table}: ${String(e.message).slice(0, 300)}`);
    }
  }
  console.log("--- verify ---");
  for (const table of ["teams", "phases", "users", "issues", "dependencies"]) {
    const out = await call("select_rows", { app_id: APP_ID, table, limit: 1 });
    console.log(`${table}: ${out.slice(0, 160)}`);
  }
}

child.kill();
process.stdout.write("", () => process.exit(0));

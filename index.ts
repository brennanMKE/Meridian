// Meridian driver — Spectrum message loop (terminal now, Slack when enabled).
// Commands: rollup | scope-change | push issue #N to phase M | seed-memory
import { readFileSync } from "node:fs";
import { Spectrum } from "spectrum-ts";
import { terminal } from "spectrum-ts/providers/terminal";
import { runRollup } from "./src/pipeline.ts";
import { insertRow, selectRows, updateIssuePhase, shutdown } from "./src/butterbase.ts";
import { writeFact, queryImpacts } from "./src/memory.ts";

const seed = JSON.parse(readFileSync("sample-project/seed-data.json", "utf8"));
const scopeChange = JSON.parse(readFileSync("sample-project/scope-change.json", "utf8"));
let runCounter = 0;

async function doRollup(reply: (t: string) => Promise<void>) {
  const runId = `run_${++runCounter}`;
  const context = await queryImpacts("commitments, scope changes, and contradictions for BarkPark Phase 2");
  const result = await runRollup(context, runId);
  await reply(`— Meridian rollup ${runId} (engine: ${result.engine}) —`);
  for (const b of result.briefings) {
    await reply(`[→ ${b.channel} (${b.audience})]\n${b.text}`);
  }
}

async function handle(text: string, reply: (t: string) => Promise<void>) {
  const cmd = text.trim().toLowerCase();

  if (cmd === "seed-memory") {
    for (const c of seed.xtrace_commitments) await writeFact(c, "barkpark_commitments");
    await reply(`🧠 ${seed.xtrace_commitments.length} scoped commitments written to XTrace.`);
    return;
  }

  if (cmd === "team" || cmd === "who") {
    const [users, teams] = await Promise.all([selectRows("users"), selectRows("teams")]);
    const tname = (id: number | null) => teams.find((t: any) => t.id === id)?.name ?? "—";
    const lines = users.map((u: any) => `• ${u.name} — ${u.role}${u.team_id ? `, ${tname(u.team_id)} team` : " (all teams)"}`);
    await reply(`👥 BarkPark project team:\n${lines.join("\n")}`);
    return;
  }

  if (cmd === "rollup") return doRollup(reply);

  if (cmd === "scope-change") {
    for (const issue of scopeChange.issues) await insertRow("issues", issue).catch(() => {});
    for (const dep of scopeChange.dependencies) await insertRow("dependencies", dep).catch(() => {});
    await writeFact(scopeChange.xtrace_fact, "barkpark_scope_change");
    await reply(`📦 Scope change applied: ${scopeChange.issues.length} vet-placement issues + ${scopeChange.dependencies.length} dependency edges. XTrace reconciling…`);
    return doRollup(reply);
  }

  const push = text.match(/push issue #?(\d+) to phase (\d+)/i);
  if (push) {
    const [, issueId, phaseId] = push;
    const ok = await updateIssuePhase(Number(issueId), Number(phaseId));
    await writeFact(`Manager decision: issue #${issueId} deferred to Phase ${phaseId}.`, "barkpark_decisions");
    await reply(ok ? `✅ Issue #${issueId} moved to Phase ${phaseId}. Re-running rollup…`
                   : `⚠️ REST update unavailable — decision recorded in memory; re-running rollup…`);
    return doRollup(reply);
  }

  await reply(`Commands: seed-memory · rollup · scope-change · push issue #15 to phase 3`);
}

const app = await Spectrum({
  projectId: process.env.PHOTON_PROJECT_ID!,
  projectSecret: process.env.PHOTON_PROJECT_SECRET!,
  providers: [terminal.config()], // → slack.config({}) once Photon enables it
});

console.log("Meridian ready. Try: seed-memory → rollup → scope-change → push issue #15 to phase 3");

for await (const [space, message] of app.messages) {
  const c = (message as any).content;
  const text =
    (message as any).text ??
    (Array.isArray(c)
      ? c.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ")
      : c?.text ?? "");
  if (text.trim().toLowerCase() === "quit" || text.trim().toLowerCase() === "exit") {
    await message.reply("Bye.");
    await app.stop();
    shutdown();
    process.exit(0);
  }
  await space.responding(async () => {
    try {
      await handle(text, (t) => message.reply(t));
    } catch (err) {
      await message.reply(`error: ${String(err).slice(0, 200)}`);
    }
  });
}
shutdown();

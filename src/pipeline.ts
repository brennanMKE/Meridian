// Rollup engine: RocketRide pipeline first, deterministic local fallback second.
// The demo cannot die on a flaky LLM or a down server.
import { selectRows } from "./butterbase.ts";

export interface Briefing { channel: string; audience: string; text: string }
export interface RollupResult {
  run_id: string;
  phase_status: { phase: string; complete: number; total: number; at_risk: boolean }[];
  blockers: { issue_id: number; blocked_team: string; cause_issue_id: number; cause: string; new_eta?: string }[];
  briefings: Briefing[];
  engine: "rocketride" | "local-fallback";
}

export async function runRollup(memoryContext: string[], runId: string): Promise<RollupResult> {
  try {
    const viaPipeline = await runViaRocketRide(memoryContext, runId);
    return { ...viaPipeline, engine: "rocketride" };
  } catch (err) {
    console.error(`⚠️  pipeline unavailable (${String(err).slice(0, 120)}) — using local fallback`);
    return runLocalFallback(memoryContext, runId);
  }
}

async function runViaRocketRide(memoryContext: string[], runId: string): Promise<RollupResult> {
  const { RocketRideClient, Question } = await import("rocketride");
  const client = new RocketRideClient();
  await client.connect();
  try {
    const { token } = await client.use({ filepath: "Meridian.pipe" });
    const q = new Question();
    q.addQuestion(
      `Run the Meridian rollup. run_id=${runId}\nPrior commitments and scope changes from memory:\n` +
      memoryContext.map((m) => `- ${m}`).join("\n"),
    );
    const response = await client.chat({ token, question: q });
    const raw = response.answers?.[0];
    if (!raw) throw new Error("pipeline returned no answer");
    const parsed = JSON.parse(String(raw).replace(/^```json?\s*|\s*```$/g, ""));
    if (!parsed.briefings) throw new Error("pipeline answer missing briefings");
    return parsed;
  } finally {
    await client.disconnect().catch(() => {});
  }
}

// Deterministic rollup straight from Butterbase — no LLM involved.
async function runLocalFallback(memoryContext: string[], runId: string): Promise<RollupResult> {
  const [issues, deps, phases, teams, users] = await Promise.all([
    selectRows("issues"), selectRows("dependencies"), selectRows("phases"), selectRows("teams"), selectRows("users"),
  ]);
  const teamName = (id: number) => teams.find((t: any) => t.id === id)?.name ?? `team ${id}`;
  const byId = new Map(issues.map((i: any) => [i.id, i]));

  const phase_status = phases.map((p: any) => {
    const inPhase = issues.filter((i: any) => i.phase_id === p.id);
    const complete = inPhase.filter((i: any) => i.status === "done").length;
    const scopeChanged = memoryContext.some((m) => /scope/i.test(m));
    return {
      phase: p.name,
      complete,
      total: inPhase.length,
      at_risk: p.status === "in_progress" && (scopeChanged || complete / Math.max(inPhase.length, 1) < 0.5),
    };
  });

  const blockers = deps
    .map((d: any) => ({ d, from: byId.get(d.from_issue_id), to: byId.get(d.to_issue_id) }))
    .filter(({ from, to }: any) => from && to && from.status !== "done" && to.status !== "done")
    .map(({ d, from, to }: any) => ({
      issue_id: to.id,
      blocked_team: teamName(to.team_id),
      cause_issue_id: from.id,
      cause: from.id >= 20 ? "scope_change" : "upstream_incomplete",
      new_eta: from.committed_date ?? undefined,
    }));

  const scopeNote = memoryContext.filter((m) => /scope/i.test(m)).slice(0, 1);
  const atRisk = phase_status.filter((p) => p.at_risk);

  // One briefing per team channel, crafted for that team's audience.
  const briefings: Briefing[] = teams.map((t: any) => {
    const channel = `#${t.name.toLowerCase()}`;
    const teamIssues = issues.filter((i: any) => i.team_id === t.id && i.status !== "done");
    const teamBlockers = blockers.filter((b: any) => byId.get(b.issue_id)?.team_id === t.id);
    const blocking = blockers.filter((b: any) => byId.get(b.cause_issue_id)?.team_id === t.id);
    const lines: string[] = [];
    if (teamBlockers.length) {
      for (const b of teamBlockers) {
        const owner = byId.get(b.issue_id)?.owner;
        lines.push(`🚧 "${byId.get(b.issue_id)?.title}" (#${b.issue_id}${owner ? `, ${owner}` : ""}) is blocked by #${b.cause_issue_id} "${byId.get(b.cause_issue_id)?.title}"${b.cause === "scope_change" ? " — added by a mid-phase scope change" : ""}. Upstream ETA: ${String(b.new_eta ?? "TBD").slice(0, 10)}.`);
      }
    } else {
      lines.push(`✅ No blocked work in ${t.name} today.`);
    }
    if (blocking.length) {
      lines.push(`⏳ Other teams are waiting on you: ${[...new Set(blocking.map((b: any) => `#${b.cause_issue_id} "${byId.get(b.cause_issue_id)?.title}"`))].join("; ")}.`);
    }
    if (teamIssues.length) {
      lines.push(`📌 Open in your lane: ${teamIssues.map((i: any) => `#${i.id}`).join(", ")}.`);
    }
    return { channel, audience: `${t.name} team`, text: lines.join("\n") };
  });

  // Leadership channel: phase health, risk, and the suggested move.
  const mgmtLines = [
    `📋 ${phase_status.map((p) => `${p.phase}: ${p.complete}/${p.total}${p.at_risk ? " ⚠️" : ""}`).join(" · ")} — ${blockers.length} blocker(s) across ${new Set(blockers.map((b: any) => b.blocked_team)).size || 0} team(s).`,
  ];
  if (atRisk.length) mgmtLines.push(`🎯 At risk: ${atRisk.map((p) => p.phase).join(", ")}.`);
  if (scopeNote.length) mgmtLines.push(`🧠 Memory: ${scopeNote[0]}`);
  if (scopeNote.length) mgmtLines.push(`💡 Suggested mitigation: defer "Map filters" (#15) to Phase 3 to absorb the vet placement work. Reply "push issue #15 to phase 3" to apply.`);
  briefings.push({ channel: "#management", audience: "directors & managers", text: mgmtLines.join("\n") });

  return { run_id: runId, phase_status, blockers, briefings, engine: "local-fallback" };
}

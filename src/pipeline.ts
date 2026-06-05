// Rollup engine: RocketRide pipeline first, deterministic local fallback second.
// The demo cannot die on a flaky LLM or a down server.
import { selectRows } from "./butterbase.ts";

export interface Briefing { role: string; slack_id: string; name?: string; text: string }
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
  const briefings: Briefing[] = users
    .filter((u: any) => ["dev", "manager", "director"].includes(u.role))
    .map((u: any) => {
      const mine = blockers.filter((b: any) => teamName(byId.get(b.issue_id)?.team_id) === teamName(u.team_id));
      if (u.role === "dev") {
        const text = mine.length
          ? mine.map((b: any) => `🚧 ${u.name}: "${byId.get(b.issue_id)?.title}" (#${b.issue_id}) is blocked by #${b.cause_issue_id} "${byId.get(b.cause_issue_id)?.title}"${b.cause === "scope_change" ? " — added by a mid-phase scope change" : ""}. New upstream ETA: ${b.new_eta ?? "TBD"}.`).join("\n")
          : `✅ ${u.name}: no blockers on your issues today.`;
        return { role: u.role, slack_id: u.slack_id, name: u.name, text };
      }
      const atRisk = phase_status.filter((p) => p.at_risk);
      if (u.role === "manager") {
        const text = `📋 ${u.name}: ${phase_status.map((p) => `${p.phase}: ${p.complete}/${p.total}${p.at_risk ? " ⚠️" : ""}`).join(" · ")}. ${blockers.length} blocker(s).${scopeNote.length ? ` Scope change in play: ${scopeNote[0]}` : ""}`;
        return { role: u.role, slack_id: u.slack_id, name: u.name, text };
      }
      const text = `🎯 ${u.name} (director): ${atRisk.length ? `${atRisk.map((p) => p.phase).join(", ")} at risk — ${new Set(blockers.map((b: any) => b.blocked_team)).size} team(s) affected by ${blockers.length} blocker(s).` : "All phases on track."}${scopeNote.length ? ` Cause: mid-phase scope addition. Suggested mitigation: defer "Map filters" (#15) to Phase 3 to absorb the vet placement work.` : ""}`;
      return { role: u.role, slack_id: u.slack_id, name: u.name, text };
    });

  return { run_id: runId, phase_status, blockers, briefings, engine: "local-fallback" };
}

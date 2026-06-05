# Meridian — Implementation Plan

Hackathon-day plan for two developers. North star: the four-beat demo moment.
Everything not on the demo path gets cut first.

## The Sample Project

Meridian tracks **BarkPark** — a dog park app (register your dogs, map of nearby
parks) built by three teams: Design (drives features + screens), Backend (Go),
Frontend (Svelte). Mid-cycle, Design — guided by the director — adds a funding
requirement: show veterinarians who pay for placement on the map.
Full narrative + data: `sample-project/` (SAMPLE_PROJECT.md, seed-data.json,
scope-change.json).

## The Demo Moment (build backwards from this)

1. **New requirement** — midway through Phase 2 (teams on schedule), Design adds sponsored vet locations to the map (issues #20–23 + dependency edges, applied live from `scope-change.json`).
2. **Reconcile** — XTrace detects the contradiction with stored commitments ("map data API final at current scope by June 19"; "frontend map workflows by June 19 assuming scope freezes June 5") and flags every downstream dependency now at risk.
3. **Notify** — Tom (frontend dev) gets a Slack DM: "Scope change upstream: the map data API now includes sponsored vet locations. Map filters (#15) at risk — new backend ETA June 12." Dana (director) gets a digest: scope added mid-phase, Phase 2 at risk, two teams affected, one mitigation (defer map filters #15 to Phase 3).
4. **Reply** — Marisol (manager) replies "push issue #15 to Phase 3" → agent updates Butterbase, re-runs the rollup; Phase 2 back on track.

## Architecture

```
manual trigger (demo) / daily cron (story)
        │
        ▼
RocketRide pipeline (local server, shared Meridian.pipe via git)
  coordination agent + per-team sub-agents
  • reads issues/deps from Butterbase REST
  • prior commitments injected from XTrace
  • emits role-segmented briefing JSON
        │
        ▼
TypeScript driver (src/)
  • writes new facts to XTrace, reads contradictions
  • routes briefings by role via Photon/Spectrum → Slack
  • parses inbound replies → PATCH Butterbase → re-run pipeline
```

## Integration Contract (agree on this FIRST — 30 min, both devs)

### Pipeline output → driver (briefing JSON)

```json
{
  "run_id": "2026-06-05T18:00:00Z",
  "phase_status": [{ "phase": "Phase 2 — Core Workflows", "complete": 3, "total": 8, "at_risk": true }],
  "blockers": [{ "issue_id": 15, "blocked_team": "Frontend", "cause_issue_id": 21, "cause": "scope_change", "new_eta": "2026-06-12" }],
  "briefings": [
    { "role": "dev",      "slack_id": "U…", "text": "Scope change upstream: map data API now includes sponsored vet locations…" },
    { "role": "manager",  "slack_id": "U…", "text": "Phase 2: 3/8 complete, 1 blocker from scope change…" },
    { "role": "director", "slack_id": "U…", "text": "Phase 2 at risk, two teams affected. Mitigation: defer map filters (#15) to Phase 3." }
  ]
}
```

### Butterbase schema (provision via Butterbase MCP, then seed)

| Table | Key fields |
|---|---|
| `teams` | id, name, lead |
| `phases` | id, name, order, status |
| `issues` | id, team_id, phase_id, title, status, owner, committed_date, actual_date |
| `dependencies` | id, from_issue_id, to_issue_id, type |
| `users` | id, team_id, role (dev/manager/director), slack_id |

Seed data lives in `sample-project/seed-data.json`: 3 teams (Design, Backend Go,
Frontend Svelte), 3 phases, 19 issues, 5 dependency edges, 5 users (director,
manager, designer, 2 devs) — replace the `U_REPLACE_*` placeholders with real
Slack IDs from the Meridian workspace. The vet-placement issues (#20–23, in
`sample-project/scope-change.json`) are NOT seeded — they get created live
during the demo.

## Work Split

**Dev A — Data + Pipeline** (Backend/Integrations + Agent roles)
**Dev B — Messaging + Driver** (Messaging + Generalist roles)

### M0 — Foundations (both, first hour)

- [ ] Both: repo cloned, `nvm use`, `npm install`, `.env` populated from `.env.example`
- [ ] Agree the contract above (tweak shape, then freeze it)
- [ ] Dev A: local RocketRide server running; extension synced
- [ ] Dev B: Slack workspace live, Photon project connected, both devs + bot in workspace
- [ ] Dev B: capture real `slack_id`s for seed data → hand to Dev A

### M1 — Halves in parallel (next 2–3 hours)

Dev A:
- [ ] Butterbase tables + seed via MCP (use AI gateway as the pipeline LLM if viable; else Nebius via `${ROCKETRIDE_NEBIUS_API_KEY}`)
- [ ] Fix `Meridian.pipe`: chat source → coordination agent (sub-agent per team) → `response_answers`; drop unused CrewAI/Git nodes; HTTP tool → Butterbase REST
- [ ] Pipeline prompt: ingest issues + XTrace context (passed in the question), emit contract JSON only
- [ ] `src/pipeline.ts`: RocketRideClient wrapper — `runRollup(xtraceContext) → BriefingResult`
- [ ] `src/memory.ts` (XTrace via `@xtraceai/memory`): `writeCommitment()`, `writeScopeChange()`, `queryImpacts()` — seed the `xtrace_commitments` from seed-data.json verbatim; they state scope ("map data API at current scope", "assuming scope freezes June 5") so the vet addition is a genuine contradiction

Dev B (mock the pipeline output until M2):
- [ ] `src/butterbase.ts`: typed REST client — `getIssues()`, `updateIssue(id, patch)`
- [ ] `src/index.ts`: Spectrum loop — on trigger, send each briefing to its `slack_id`; role formatting
- [ ] Reply handler: LLM-parse "push issue #14 to Phase 3" → `updateIssue()` → re-trigger rollup
- [ ] Test everything against the **terminal provider** + `mock-briefing.json` (no Slack collisions with Dev A)

### M2 — Integration (1–2 hours, pair on one machine)

- [ ] Replace Dev B's mock with `runRollup()`; one MacBook is "production" (only it runs the Slack loop)
- [ ] Wire the full scope-change flow: apply `scope-change.json` (issues #20–23 + edges) to Butterbase → `writeScopeChange()` → `queryImpacts()` flags the contradiction → rollup → Slack messages land
- [ ] Wire reply flow end-to-end
- [ ] Rehearse the four beats twice; capture screenshots as fallback

### M3 — Submission (final hour — protect this time)

- [ ] README: problem, architecture diagram, how each tool is used (depth, not name-drops)
- [ ] Push final; verify clean clone runs with `.env.example` instructions
- [ ] Submit via Butterbase MCP (code `havefun0605`, slug `agentic-ai-Hackathon`) — **allow 30 min**

## Tool-Depth Checklist (disqualification guard)

- **RocketRide**: multi-agent pipeline (coordination + per-team sub-agents), not a single LLM call
- **Butterbase**: system of record (5 tables) + REST from both pipeline and driver; AI gateway if feasible
- **XTrace**: scoped commitments written on seed; the mid-schedule requirement contradicts a stored commitment and XTrace's belief reconciliation drives the demo's key beat — this is the differentiator, give it real prompt/memory design
- **Photon**: role-differentiated delivery AND inbound conversational state updates (both directions)

## Cut List (in order, if time runs short)

1. iMessage delivery → Slack only (pitch says "Slack and iMessage"; Slack alone still demos)
2. Suggested mitigation → static text in director briefing
3. Reply parsing via LLM → regex for the exact demo phrase
4. Daily cron → manual trigger only (narrate the cron)
5. Per-team sub-agents → single coordination agent (only if pipeline fights back; weakens RocketRide depth)

## Hard Rules

- `Meridian.pipe` is **Dev A's file** — Dev B never edits it (canvas saves churn the JSON)
- Only one machine runs the Slack loop at a time
- `main` stays runnable; commit small, push often
- Secrets only in `.env` (shared out-of-band); `${ROCKETRIDE_*}` names identical on both machines

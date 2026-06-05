# Meridian

**Multi-team project intelligence that remembers what was promised.**

Meridian tracks cross-team project work, maintains a persistent memory of every
commitment, detects when reality diverges from the plan, and delivers
role-tailored briefings through messaging — so directors, managers, and
developers stay aligned without checking a dashboard.

Jira and Linear show *current state*. Meridian remembers what was **promised**,
flags what a change **contradicts**, and tells the people affected — in Slack.

Built at the Agentic AI Hackathon · SF · June 5, 2026.

## The problem

Large feature sets span multiple teams with foundational dependencies flowing
up to the frontend. Phase progress is invisible across team boundaries. When a
new requirement lands mid-cycle, nobody can say what promises it just broke —
managers find out in standups, developers find out when they're blocked.

## How it works

```
manual trigger (demo) / daily cron
        │
        ▼
RocketRide pipeline — coordination agent + per-team sub-agents
  • reads issues & dependency graph from Butterbase (REST)
  • prior commitments injected from XTrace
  • emits role-segmented briefing JSON
        │
        ▼
TypeScript driver (src/)
  • writes new facts to XTrace, reads back contradictions
  • routes briefings by role via Photon/Spectrum → Slack
  • parses conversational replies → updates Butterbase → re-runs rollup
```

## The four tools (all load-bearing)

| Tool | Role in Meridian |
|---|---|
| **[RocketRide](https://docs.rocketride.org)** | Aggregation engine: a multi-agent pipeline (`Meridian.pipe`) with per-team sub-agents reporting to a coordination agent that computes phase completion, blockers, and role-segmented summaries |
| **[Butterbase](https://docs.butterbase.ai)** | System of record: teams, phases, issues, dependency graph, users — provisioned via MCP, consumed over REST by both the pipeline and the driver |
| **[XTrace](https://xtrace.ai)** | Institutional memory: commitments stored as scoped facts; new information is reconciled against them and contradictions cascade to downstream dependencies — this is what Jira can't do |
| **[Photon (Spectrum)](https://photon.codes)** | Messaging layer: role-differentiated Slack briefings out, conversational state updates back in ("push issue #15 to Phase 3") |

## The demo: BarkPark

Meridian tracks **BarkPark**, a dog park app (register your dogs, map of nearby
parks) built by three teams — Design, Backend (Go), Frontend (Svelte) — midway
through a six-week release. See [`sample-project/`](sample-project/).

The four beats:

1. **New requirement** — mid-Phase-2, Design (guided by the director) adds
   sponsored veterinarian locations to the map to fund the app
2. **Reconcile** — XTrace flags that this contradicts Backend's "map data API
   final at current scope by June 19" commitment and Frontend's scope-freeze
   assumption — and cascades the risk through the dependency graph
3. **Notify** — the frontend dev gets a Slack DM about his now-at-risk map
   work; the director gets a digest with a suggested mitigation
4. **Reply** — the manager answers "push issue #15 to Phase 3"; Meridian
   updates the backlog and re-runs the rollup. Phase 2 back on track.

## Repo layout

```
IMPLEMENTATION_PLAN.md     build plan, work split, integration contract
Meridian.pipe              RocketRide pipeline (visual editor; single-owner file)
index.ts                   driver entry point (Spectrum message loop)
sample-project/            BarkPark: narrative, seed data, live scope-change payload
.env.example               required keys (copy to .env, fill in)
```

## Setup

Prereqs: Node (see `.nvmrc` — `nvm install && nvm use`), VS Code with the
RocketRide extension, a local RocketRide server.

```bash
git clone <repo> && cd Meridian
nvm use
npm install
cp .env.example .env   # fill in keys — see .env.example comments
npm start
```

Notes:

- `ROCKETRIDE_URI` / `ROCKETRIDE_APIKEY` are auto-written into `.env` by the
  RocketRide VS Code extension — don't hand-edit those two
- Secrets are shared out-of-band, never committed; `.env` is gitignored and
  blocked from AI-assistant reads via `.claude/settings.json`
- Two devs: only **one** machine runs the Slack loop at a time, and
  `Meridian.pipe` has a single owner (canvas saves churn the JSON)

## Team

Brennan + 1 — Agentic AI Hackathon, AWS Builder Loft, SF.

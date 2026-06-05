# Meridian Pipeline (`Meridian.pipe`)

This document explains the RocketRide pipeline that powers Meridian's release
rollup. Read it before touching `Meridian.pipe`. If you have never seen
RocketRide, the reference docs live in `.rocketride/docs/`.

> **Single-owner rule:** `Meridian.pipe` is **Dev A's file only.** The RocketRide
> visual editor rewrites/reorders the JSON every time it saves (it will even
> regenerate `project_id` — we pin it back to `cc4eee6a-5ce3-4224-a0f3-38024f716798`).
> Dev B must never edit or open it in the canvas, or merge conflicts and churn
> will follow.

---

## Architecture (end to end)

```
manual trigger (demo) / daily cron (story)
        │
        ▼
RocketRide pipeline  ──►  Meridian.pipe (THIS FILE)
  • chat source receives the rollup "question" (a JSON blob: run_id +
    scope-change / commitment / contradiction context from XTrace)
  • Deep Agent coordination agent reads issues, dependencies, teams,
    phases, users from the Butterbase REST API via an HTTP tool
  • analyzes phase completion + blocked issues over the dependency edges
  • emits the briefing JSON contract (ONLY JSON, no prose)
        │
        ▼  (returned under the "answers" response key)
TypeScript driver (index.ts / src/)
  • validates the briefing JSON against the contract
  • writes the new facts to XTrace, reads back contradictions
  • routes each briefings[] entry to its recipient by role via
    Photon / Spectrum → Slack
  • parses inbound Slack replies → PATCH Butterbase → re-run the rollup
```

**Slack routing is not wired yet (TODO).** The pipeline emits a `slack_id` per
briefing, but the mapping of those IDs to actual Slack DMs/channels happens in
the driver and depends on the Meridian Slack workspace being provisioned (real
user IDs captured into the Butterbase `users.slack_id` column). Until that setup
is done, the driver should treat `briefings[].slack_id` as opaque and the Slack
delivery step stays mocked / terminal-only.

---

## Node graph

Data lanes are solid (`──►`); control-plane invoke links are dashed
(`- - ->`). The Deep Agent's LLM, sub-agent, and HTTP tool are attached via the
`control` array **on the controlled node**, pointing back at the agent — not via
data lanes.

```
   [chat_1]  --questions-->  [agent_deepagent_1]  --answers-->  [response_answers_1]
   (source)                   (coordination agent)               (laneName: "answers")
                                   ▲   ▲   ▲
                 llm  - - - - - - -+   |   +- - - - - - tool
                                       | deepagent
                                       |
                              [agent_deepagent_subagent_1]
                               (per-team analysis specialist)
                                   ▲                ▲
                          llm  - - +                +- - - tool

   shared control-plane nodes (each invoked by BOTH agents):
     [llm_nebius_1]          profile llama-3-3-70b, apikey ${ROCKETRIDE_NEBIUS_API_KEY}
                             control: llm  ← agent_deepagent_1, agent_deepagent_subagent_1
     [tool_http_request_1]   GET-only, whitelisted to ${ROCKETRIDE_BUTTERBASE_API_BASE}/*
                             control: tool ← agent_deepagent_1, agent_deepagent_subagent_1
```

### Components

| id | provider | role |
|---|---|---|
| `chat_1` | `chat` | source; produces the `questions` lane. Drive with `client.chat()`. |
| `agent_deepagent_1` | `agent_deepagent` | coordination agent; `questions` → `answers`. Holds the rollup instructions + output contract. |
| `agent_deepagent_subagent_1` | `agent_deepagent_subagent` | per-team analysis sub-agent; invoked by the coordinator over the `deepagent` channel (no data lanes). |
| `llm_nebius_1` | `llm_nebius` | the LLM both agents use (`llama-3-3-70b`). Shared via two `control` entries. |
| `tool_http_request_1` | `tool_http_request` | generic REST/HTTP tool the agents call to GET Butterbase tables. |
| `response_answers_1` | `response_answers` | returns the agent's `answers` to the client under the `answers` key. |

### Why these choices / deviations from the brief

- **HTTP tool has no base-URL or auth-header config.** `tool_http_request` is
  the correct generic REST tool per the component reference, but its schema only
  exposes method toggles, rate limits, and a `urlWhitelist` — the **agent supplies
  the full request (URL, headers, auth) at call time**. So the Butterbase base URL
  and Bearer key are injected into the **agent instructions** (and the URL
  whitelist) as `${ROCKETRIDE_BUTTERBASE_API_BASE}` / `${ROCKETRIDE_BUTTERBASE_API_KEY}`,
  not as dedicated tool config fields. We deliberately did **not** use
  `tool_butterbase` — that is an MCP (Streamable HTTP) client to
  `api.butterbase.ai/mcp`, not the plain REST API the brief asked for. The tool is
  locked to **GET only** and whitelisted to the Butterbase base URL.
- **Deep Agent needs no memory.** Unlike `agent_rocketride`, `agent_deepagent`'s
  `invoke` block requires only an LLM (min 1); tools and sub-agents are optional
  and memory is not a port. No `memory_internal` node is wired.
- **One sub-agent kept.** The format supports it cleanly: a single
  `agent_deepagent_subagent` attached over the `deepagent` channel gives the
  per-team analysis pattern without fan-out clutter. It shares the same LLM and
  HTTP tool as the coordinator.
- **Deleted from the original sketch:** the CrewAI manager + CrewAI sub-agent
  (floating, unused) and the Git tool.

---

## Required `.env` entries (on BOTH developer machines)

Use the **same variable names** on both machines. Only variables that are
referenced inside `Meridian.pipe` must carry the `ROCKETRIDE_` prefix — that is a
hard RocketRide rule: the engine **only** substitutes `${ROCKETRIDE_*}`
placeholders into pipeline config; any other name (e.g. `${NEBIUS_KEY}`) is left
untouched and the pipeline breaks.

| Variable | Set by | Purpose |
|---|---|---|
| `ROCKETRIDE_URI` | **VS Code extension (auto)** — do not hand-edit | RocketRide server URL |
| `ROCKETRIDE_APIKEY` | **VS Code extension (auto)** — do not hand-edit | RocketRide server API key |
| `ROCKETRIDE_NEBIUS_API_KEY` | you | Nebius Token Factory key for the pipeline LLM (`llama-3-3-70b`) |
| `ROCKETRIDE_BUTTERBASE_API_BASE` | you | Butterbase REST base URL, no trailing slash (the agent appends `/issues`, `/dependencies`, …) |
| `ROCKETRIDE_BUTTERBASE_API_KEY` | you | Butterbase API key; the agent sends it as `Authorization: Bearer <key>` |

Placeholders for the three custom keys are committed in `.env.example` under the
RocketRide section. Real values go in `.env` only (secret, shared out-of-band,
never committed).

---

## How to run it

This is a **chat** pipeline (the source is a `chat` node). Drive it with
`client.chat()` — **not** `client.send()` (that is for `webhook`/`dropper`
sources and will fail here, per `ROCKETRIDE_COMMON_MISTAKES.md`).

```ts
import { RocketRideClient, Question } from 'rocketride';

const client = new RocketRideClient();        // reads ROCKETRIDE_URI / ROCKETRIDE_APIKEY from .env
await client.connect();

// Start the pipeline ONCE, reuse the token for every rollup:
const { token } = await client.use({ filepath: 'Meridian.pipe', useExisting: true });

// The "question" is the rollup input: a JSON string with run_id + XTrace context.
const question = new Question();
question.addQuestion(JSON.stringify({
  run_id: '2026-06-05T18:00:00Z',
  scope_change: { /* issues #20–23 + new edges, from scope-change.json */ },
  commitments: [ /* scoped commitments from XTrace */ ],
  contradictions: [ /* what XTrace flagged at risk */ ],
}));

const response = await client.chat({ token, question });

// response.answers[0] is the briefing JSON string — JSON.parse it, then validate
// against the contract below before routing to Slack.
await client.disconnect();   // only when completely done
```

Notes:
- Start once, reuse the token many times (starting a pipeline is slow).
- The response key is `answers` because `response_answers_1` uses the default
  `laneName: "answers"`. If you ever change `laneName`, update the driver to match.
- Never block the event loop with synchronous I/O between `chat()` calls — the
  websocket keepalive needs the loop responsive (see common-mistakes doc).

---

## The briefing JSON contract (pipeline output → driver)

The coordination agent must emit **exactly** this shape and nothing else — no
prose, no markdown fences:

```json
{
  "run_id": "<echo from input>",
  "phase_status": [
    { "phase": "Phase 2 — Core Workflows", "complete": 3, "total": 8, "at_risk": true }
  ],
  "blockers": [
    { "issue_id": 15, "blocked_team": "Frontend", "cause_issue_id": 21, "cause": "scope_change", "new_eta": "2026-06-12" }
  ],
  "briefings": [
    { "role": "dev",      "slack_id": "U…", "text": "Scope change upstream: map data API now includes sponsored vet locations…" },
    { "role": "manager",  "slack_id": "U…", "text": "Phase 2: 3/8 complete, 1 blocker from scope change…" },
    { "role": "director", "slack_id": "U…", "text": "Phase 2 at risk, two teams affected. Mitigation: defer map filters (#15) to Phase 3." }
  ]
}
```

- `run_id` — echoed verbatim from the input.
- `phase_status[]` — completion per phase (`complete`/`total`) and `at_risk` flag.
- `blockers[]` — one per blocked issue, with the upstream `cause_issue_id`, the
  `cause` (e.g. `scope_change`), the affected `blocked_team`, and a revised
  `new_eta` when known.
- `briefings[]` — one per role drawn from the `users` table
  (`dev` / `manager` / `director` / `designer`), addressed by `slack_id`. Text is
  **role-tailored**: dev = what blocks YOU; manager = phase summary + blockers;
  director = risk + suggested mitigation.

---

## Maintenance checklist (before committing a pipe change)

- `components` is the first field; `project_id` / `viewport` / `version` at the bottom.
- `project_id` is still the literal `cc4eee6a-5ce3-4224-a0f3-38024f716798`
  (the editor likes to regenerate it — pin it back).
- Validate JSON: `node -e "JSON.parse(require('fs').readFileSync('Meridian.pipe','utf8'))"`.
- Every `input[].from` and `control[].from` references an existing component id.
- Every lane name is legal (`questions`, `answers` here) and matches the
  producing/consuming node.
- All injected secrets use the `${ROCKETRIDE_*}` prefix.

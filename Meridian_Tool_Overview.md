# Meridian — Tool Overview for PRD
> Reference document for Claude Code. Use this to draft a PRD for **Meridian**, a multi-team project intelligence system built on RocketRide, Butterbase, XTrace, and Photon (Spectrum).

---

## Project Summary

Meridian tracks cross-team project work across multiple teams, phases, and dependency layers. It aggregates issue-level status daily, maintains a persistent memory of commitments and slippage, and delivers role-tailored briefings to directors, managers, designers, and developers through messaging. All four tools below are mandatory and must be deeply integrated.

---

## 1. RocketRide — AI Pipeline Infrastructure

**Role in Meridian:** Daily aggregation engine. Orchestrates multi-agent workflows that pull issue status across teams, detect phase completion percentages, identify cross-team dependency blockers, and generate rolled-up summaries per role.

### What it is
RocketRide is an open-source AI pipeline builder and runtime with a high-performance C++ core and 50+ Python-extensible nodes. Pipelines are built visually inside VS Code (or other IDEs) using a `.pipe` file format (JSON). It supports 13 LLM providers, 8+ vector databases, and multi-agent orchestration.

### Key concepts
- **Pipelines** — directed graphs of nodes defined as `.pipe` (JSON) files, rendered visually on a canvas in the IDE
- **Nodes** — building blocks that call LLMs, embed text, query vector stores, transform data, etc.
- **Source nodes** — every pipeline starts with a `webhook`, `chat`, or `dropper` source
- **Agent nodes** — agents or LLMs can be invoked as tools by parent nodes (sub-agent pattern)
- **Lanes** — connect input/output lanes by type to wire nodes together

### SDKs and integration
- **TypeScript SDK:** `import { RocketRideClient } from 'rocketride'` — connect, load a pipeline, send input, receive output
- **Python SDK** — also available
- **MCP server** — pipelines can be exposed as callable MCP tools for AI assistants
- **Deployment** — run locally, on Docker, on-prem, or on RocketRide Cloud

### Quickstart (TypeScript)
```typescript
import { RocketRideClient } from 'rocketride';
const client = new RocketRideClient({ uri: 'http://localhost:5565' });
await client.connect();
const { token } = await client.use({ filepath: './pipeline.json' });
const result = await client.send(token, 'Hello, pipeline!', { name: 'input.txt' }, 'text/plain');
await client.terminate(token);
await client.disconnect();
```

### Resources
- Docs: https://docs.rocketride.org
- GitHub: https://github.com/rocketride-org/rocketride-server
- IDE extension: search "RocketRide" in VS Code marketplace

---

## 2. Butterbase — Backend for AI Builders

**Role in Meridian:** Zero-DevOps backend. Stores teams, issues, phases, dependency graph, and role-based auth. Provides the AI model gateway for LLM calls within pipelines. Must be connected before project submission.

### What it is
Butterbase is an open-source, AI-optimized Backend-as-a-Service (BaaS). It connects directly to AI coding tools (Claude Code, Cursor, Codex) via MCP and auto-provisions a production-ready backend from natural language prompts — no SQL, no DevOps required.

### What it provides out of the box
- **PostgreSQL database** — schemas auto-generated from codebase; tables, indexes, relations provisioned automatically
- **Authentication** — email, Google, GitHub, Apple, X, magic links; JWT sessions; role-based access; post-login hooks
- **REST APIs** — typed CRUD endpoints for every model, versioned and production-ready
- **Real-time subscriptions** — subscribe to any table change; frontend stays synced
- **File storage** — S3-compatible
- **Serverless edge functions** — custom backend logic, globally deployed
- **AI model gateway** — single endpoint for chat, embeddings, and model listing across GPT, Claude, and Gemini
- **RAG** — managed collections, document ingestion, semantic search
- **Webhooks** — outbound webhooks for app events
- **Audit logs** — structured request audit trail

### MCP integration
- Add one line to your MCP config: `npx @butterbase/mcp`
- The agent reads your codebase, creates tables, sets up auth, and deploys API routes without leaving the editor
- All capabilities exposed as MCP tools at `/mcp`

### Hackathon setup
1. Sign up at https://dashboard.butterbase.ai
2. Connect MCP to your coding tool
3. Apply promo code `HAVEFUN0605` under https://dashboard.butterbase.ai/billing (launch plan, $20 credit)
4. Submit via Butterbase MCP when done: paste `"Submit my project to the hackathon. Submission code: havefun0605. Hackathon slug: agentic-ai-Hackathon"` into your AI agent

### Resources
- Docs: https://docs.butterbase.ai
- GitHub: https://github.com/butterbase-ai/butterbase
- Dashboard: https://dashboard.butterbase.ai

---

## 3. XTrace — Persistent Agent Memory

**Role in Meridian:** The institutional memory layer. Remembers commitments made by each team, detects when reality diverges from promises, reconciles slippage against downstream dependencies, and surfaces contradictions over time. This is what differentiates Meridian from Jira/Linear.

### What it is
XTrace is a hosted memory platform that acts as a "chief of staff" for agents. Rather than retrieving documents like RAG, XTrace maintains a running, structured model of what is currently true — including what changed, what revised what, and what is in conflict. It automatically revises beliefs when new information contradicts them.

### Key concepts
- **Memory API** — agents actively write facts to and read from a persistent, structured memory store
- **Fact extraction** — XTrace extracts durable facts from conversations and agent interactions
- **Belief reconciliation** — when new information contradicts a stored fact, XTrace updates the memory and flags the conflict
- **Memory Hub** — shared memory accessible across agents and tools; internal agents read it before responding
- **Context Engine** — sits between users and agents; manages memory, task routing, tool boundaries, token budgets, and consistency across agents

### Why it's not just RAG
RAG retrieves documents. XTrace maintains what is *currently true* — with a notion of historical vs. current state. A larger context window filled with contradictory entries makes retrieval worse; XTrace resolves contradictions structurally.

### Integration pattern for Meridian
```python
async with XTraceIntegration(org_id="your_org_id", api_key="your_api_key") as xtrace:
    # Write a commitment
    await xtrace.write("Team A committed: auth API complete by end of Phase 2")
    # Later, reconcile when it slips
    await xtrace.write("Team A: auth API delayed to June 12")
    # XTrace automatically flags downstream dependencies
    facts = await xtrace.query("what depends on Team A auth API")
```

### Resources
- Homepage: https://xtrace.ai
- Memory API docs: https://docs.xtrace.ai
- Blog (context engine architecture): https://xtrace.ai/blog/ai-agent-context-infrastructure

---

## 4. Photon (Spectrum) — Messaging Delivery

**Role in Meridian:** Delivers role-differentiated briefings to directors, managers, and developers via Slack and iMessage. Accepts conversational replies that update issue state without requiring a UI. The agent appears in recipients' message threads like any other contact.

### What it is
Photon's Spectrum is an open-source TypeScript SDK and cloud platform that connects agents to iMessage, WhatsApp, Telegram, Slack, Discord, Instagram, and more via a single unified API. Developers write agent logic once; Spectrum handles delivery and native rendering per platform.

### Key concepts
- **Unified API** — one message loop handles all platforms; add providers to an array to extend reach
- **`definePlatform` API** — build custom connectors for non-standard platforms
- **Adaptive rendering** — maps structured interactions (e.g. polls) to native platform primitives instead of raw text fallbacks
- **Sub-250ms end-to-end latency**
- **SOC 2 compliant** — suitable for production conversations

### Two deployment options
- **Spectrum SDK** — MIT licensed, self-hostable; provides the unified messaging interface, type-safe message handling, and platform support
- **Spectrum Cloud** — Photon's managed infrastructure; activates iMessage and WhatsApp connectivity in minutes with 99.9% uptime, edge network, audit logs, and human-in-the-loop controls

### Quickstart (TypeScript)
```typescript
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { slack } from "spectrum-ts/providers/slack";

const app = await Spectrum({
  projectId: process.env.PROJECT_ID,
  projectSecret: process.env.PROJECT_SECRET,
  providers: [imessage.config(), slack.config()],  // add platforms here
});

for await (const [space, message] of app.messages) {
  await space.responding(async () => {
    // Handle incoming message, update issue state, reply with briefing
    await message.reply("Phase 2 status: 3 of 7 issues complete. 1 blocker.");
  });
}
```

### Resources
- Homepage: https://photon.codes
- Spectrum docs: https://photon.codes/spectrum
- GitHub: https://github.com/photon-hq

---

## Integration Architecture for Meridian

```
Daily cron / webhook trigger
        │
        ▼
  RocketRide Pipeline
  ┌─────────────────────────────────────────────┐
  │  Per-team sub-agents fetch issue status     │
  │  from Butterbase (Postgres via REST API)    │
  │                                             │
  │  Coordination agent aggregates across       │
  │  teams, computes phase completion %,        │
  │  identifies dependency blockers             │
  │                                             │
  │  XTrace queried for prior commitments;      │
  │  new state written back; contradictions     │
  │  flagged and cascaded to dependents         │
  │                                             │
  │  Role-segmented summaries generated         │
  │  (dev / manager / director)                 │
  └─────────────────────────────────────────────┘
        │
        ▼
  Photon (Spectrum)
  ┌──────────────────────────────┐
  │  Devs → iMessage / Slack     │
  │  Managers → Slack digest     │
  │  Director → Slack summary    │
  │                              │
  │  Inbound replies routed      │
  │  back to Butterbase to       │
  │  update issue state          │
  └──────────────────────────────┘
```

---

## Data Model (Butterbase / Postgres)

| Table | Key fields |
|---|---|
| `teams` | id, name, lead |
| `phases` | id, name, order, status |
| `issues` | id, team_id, phase_id, title, status, owner, committed_date, actual_date |
| `dependencies` | id, from_issue_id, to_issue_id, type |
| `users` | id, team_id, role (dev/manager/director/designer), phone, slack_id |
| `memory_events` | id, issue_id, event_type, content, timestamp (mirrors XTrace writes) |

---

## Submission Checklist

- [ ] Sign up at dashboard.butterbase.ai before building
- [ ] Apply promo code `HAVEFUN0605` in billing
- [ ] All four tools woven into core product (disqualification risk if any are superficial)
- [ ] Working prototype — live or local demo
- [ ] Source code repository link
- [ ] Project description covering problem, tech usage, and integration depth
- [ ] Submit via Butterbase MCP: `"Submit my project to the hackathon. Submission code: havefun0605. Hackathon slug: agentic-ai-Hackathon"`
- [ ] Allow 30 minutes for submission process

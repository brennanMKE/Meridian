# Meridian — Speaker Notes (~3 minutes)

Setup before you start: `deck.html` and `board.html` open in browser tabs;
terminal ready in the repo; run `npm start` and wait for "Meridian ready"
BEFORE you begin talking (startup takes a few seconds).

---

**Slide 1 — Title**
> "Project trackers show you current state. They don't remember what was
> *promised* — or tell you when a change quietly breaks a promise. Meridian
> does. I'll show you with BarkPark, a dog-park app being built by three teams."

**Slide 2 — Scenario**
> "Three teams, mid-release, on schedule. One promise matters today: Priya's
> backend team committed that the map API is scope-frozen as of June 5 —
> that's *today*. And today, to fund the app, the design team adds paid vet
> placements to the map. Watch what Meridian does with that."

**Slide 3 — Stack** (10 seconds, don't linger)
> "Data in Butterbase, commitments in XTrace's memory service, analysis by a
> RocketRide pipeline, delivery through Photon's messaging SDK. All four are
> live services — and I'll be honest about one thing: Slack is gated on the
> vendor side, so delivery shows in their terminal provider. Same code path."

**Slide 4 — Demo cue** (switch to board tab)
> "This board is generated from the live database — three phases, every issue,
> nothing teal on it yet." (switch to terminal)
> Type `team` — "these are our five people."
> Type `scope-change` — read aloud as output appears:
> "#backend learns its API just grew — mid-phase. #frontend: Tom's map work is
> now blocked — and look at the wording: *added by a mid-phase scope change*.
> Meridian knows the difference between normal sequencing and a broken promise.
> And #management gets the digest: Phase 2 at risk, two teams affected, and a
> suggested fix with the exact reply to apply it."
> (switch to terminal 2 or pause) `npm run board`, refresh board tab:
> "Same board — now the teal cards. That's the scope change, visible."
> (back to chat) Type `push issue #15 to phase 3`:
> "A manager applies the mitigation by replying in chat. Issue deferred,
> decision recorded in memory, every channel re-briefed. No dashboard touched."
> Type `exit`.

**Slide 5 — Close**
> "Memory of promises, automatic contradiction detection, dependency-aware
> impact, delivered where people already talk. That's Meridian."

---

Honesty bank (if asked):
- "Is the LLM doing the analysis?" → "The pipeline is defined for RocketRide;
  today's run uses our deterministic graph engine — same contract, no model."
- "Why no real Slack?" → "Photon's Slack support is feature-flagged per
  project; ours isn't enabled. The SDK call is identical — it's one config
  line to swap."
- "Where does issue data come from?" → "Seeded for the demo. The real product
  needs tracker connectors (GitHub/Jira webhooks) — that's the roadmap."

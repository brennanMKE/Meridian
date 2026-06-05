# BarkPark — The People

The cast of the demo scenario. All fictional; they live in the `users` table in
Butterbase and drive who gets which briefing. In the chat, type `team` (or
`who`) to print this roster live from the database.

## Roster

| Name | Role | Team | Slack channel |
|---|---|---|---|
| **Dana** | Director | — (oversees all three) | `#management` |
| **Marisol** | Manager, design lead | Design | `#management`, `#design` |
| **Kai** | Designer | Design | `#design` |
| **Priya** | Developer (Go) | Backend | `#backend` |
| **Tom** | Developer (Svelte) | Frontend | `#frontend` |

## Who they are (for narration)

- **Dana — the director.** Accountable for the BarkPark release shipping July 3.
  Doesn't read issue trackers; wants the one-paragraph truth: what's at risk,
  why, and what the fix is. Dana pushed for the app to find a funding model —
  which is what triggers the demo's scope change.

- **Marisol — the design manager.** Runs the design team and drives the feature
  set. Translates Dana's funding guidance into the new requirement (sponsored
  vet placements on the map). She's also the one who applies the mitigation at
  the end by replying `push issue #15 to phase 3` in chat.

- **Kai — the designer.** Owns the screens: registration flow, park detail,
  check-in — and now the new vet pin + sponsored card designs (#20). Kai's
  unfinished work is what other teams quietly wait on.

- **Priya — the backend developer (Go).** Owns the APIs: auth, dog
  registration, park data, and the map data API (#12) — the issue at the heart
  of the demo. Priya's team committed to "map data API final at current scope
  by June 19." The vet requirement breaks that promise.

- **Tom — the frontend developer (Svelte).** Builds every user-facing workflow
  against Kai's designs and Priya's APIs. Most-blocked person in the project —
  downstream of everyone. The demo's emotional beat is Tom's briefing flipping
  from "on track" to "blocked by a mid-phase scope change."

## How each experiences Meridian

| Person | What lands in their channel | What it spares them |
|---|---|---|
| Dana | Phase health, risk, suggested mitigation with a ready-to-send reply | Asking three teams for status, or reading Jira |
| Marisol | Same management digest + her team's design queue | Discovering in standup that her requirement blocked two teams |
| Kai | `#design`: open screens + "other teams are waiting on you" | Not knowing their mock blocks Tom's sprint |
| Priya | `#backend`: what blocks her team + what's waiting on her API | Surprise scope growth nobody reconciled against her commitment |
| Tom | `#frontend`: exactly which issues block him, why, and the new ETA | Finding out he's blocked when his PR has nowhere to go |

## The story in one arc

Dana wants funding → Marisol's team adds paid vet placements mid-phase →
XTrace remembers Priya's scope-freeze commitment and flags the contradiction →
Tom's channel learns his map work is blocked and why → `#management` gets the
risk plus a one-line fix → Marisol replies `push issue #15 to phase 3` →
Meridian updates the backlog, re-briefs every channel, Phase 2 is back on track.

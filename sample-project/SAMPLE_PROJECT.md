# Sample Project: BarkPark

The fictional release Meridian tracks during the demo. BarkPark is a dog park
system: people register the dogs they bring to their preferred dog parks, and a
map shows dog parks near the user. The app is mostly working — the teams are
midway through the release cycle, implementing the remaining user workflows.

## Release cycle

| | Dates | Status |
|---|---|---|
| Phase 1 — Foundation | May 11 – May 29 | Complete |
| Phase 2 — Core Workflows | Jun 1 – Jun 19 | In progress (today: Jun 5) |
| Phase 3 — Polish & Launch | Jun 22 – Jul 3 | Planned |

## Teams

| Team | Stack | Role in release | Lead |
|---|---|---|---|
| Design | Figma | Drives the feature set; delivers screens and user workflows | Marisol |
| Backend | Go + Postgres/PostGIS | APIs: auth, dogs, parks, map data | Priya |
| Frontend | Svelte web UI | Implements every user workflow against the designs + APIs | Tom |

People: Dana (director), Marisol (design manager), Kai (designer),
Priya (backend dev), Tom (frontend dev).

## Planned features (set at project start)

### Phase 1 — Foundation (all done)

| # | Team | Feature |
|---|---|---|
| 1 | Design | Design system & component library |
| 2 | Design | User workflow map: registration & check-in journeys |
| 3 | Backend | Postgres schema: users, dogs, parks (PostGIS geo index) |
| 4 | Backend | Auth API (email + OAuth) |
| 5 | Backend | Dog park database import + geo search index |
| 6 | Frontend | Svelte app scaffold, routing, auth screens |
| 7 | Frontend | Base map view with park markers |

### Phase 2 — Core Workflows (in flight)

| # | Team | Feature | Status |
|---|---|---|---|
| 8 | Design | Dog registration flow screens | done |
| 9 | Design | Park detail & check-in screens | in progress |
| 10 | Backend | Dog registration API | done |
| 11 | Backend | Park detail & amenities API | in progress |
| 12 | Backend | Map data API — park search by user location | in progress |
| 13 | Frontend | Dog registration UI | in progress |
| 14 | Frontend | Park detail page + check-in UI | planned |
| 15 | Frontend | Map filters (amenities, distance, off-leash hours) | planned |

### Phase 3 — Polish & Launch

| # | Team | Feature |
|---|---|---|
| 16 | Design | Visual QA & accessibility pass |
| 17 | Backend | Park activity notifications |
| 18 | Frontend | User + dog profile pages |
| 19 | Frontend | Onboarding polish & launch checklist |

### Dependency edges (blocking → blocked)

- 8 → 13, 10 → 13 (registration designs + API block registration UI)
- 9 → 14, 11 → 14 (check-in designs + park API block park detail UI)
- 12 → 15 (map data API blocks map filters)

## The mid-cycle scope change (June 5 — created LIVE in the demo)

The app needs funding. Guided by the director, the **design team adds a new
requirement**: show the locations of **veterinarians who pay for placement**
on the map. Sponsored vet pins fund the app.

New issues (NOT seeded — created during the demo):

| # | Team | Feature | Phase |
|---|---|---|---|
| 20 | Design | Sponsored vet placement: map pin + detail card designs | 2 |
| 21 | Backend | Vets table + sponsored placement API (extends map data API) | 2 |
| 22 | Backend | Sponsorship ranking & billing hooks | 3 |
| 23 | Frontend | Vet pins + sponsored detail card on map | 2 |

New dependency edges: 20 → 23, 21 → 23, 21 → 22.

## Why XTrace fires (seeded commitments, written with scope)

1. "Backend committed: Map data API (issue 12) final **at current scope** by
   end of Phase 2 (June 19)."
2. "Frontend committed: all Phase 2 map workflows (issues 14, 15) complete by
   June 19, **assuming map data API scope freezes June 5**."
3. "Design committed: all Phase 2 screens delivered by June 8."

Issue 21 extends the map data API **after the freeze** → contradicts
commitments 1 and 2. XTrace reconciles and flags issues 14/15 and the
Phase 2 end date as at risk.

## The demo beats with this data

1. **New requirement** — issues 20–23 + edges created in Butterbase; scope
   change written to XTrace.
2. **Reconcile** — XTrace flags the contradiction with the scope-frozen
   commitments; downstream impact: Tom's map work (15), Phase 2 date.
3. **Notify** — Tom (frontend dev) gets a Slack DM: "Scope change upstream:
   the map data API now includes sponsored vet locations. Map filters (#15)
   is at risk — new backend ETA June 12." Dana (director) gets the digest:
   scope added mid-phase, Phase 2 at risk, two teams affected, mitigation:
   defer map filters (#15) to Phase 3 to absorb vet placement work.
4. **Reply** — Marisol replies "push issue #15 to Phase 3" → Meridian updates
   Butterbase and re-runs the rollup; Phase 2 back on track, Phase 3 grows.

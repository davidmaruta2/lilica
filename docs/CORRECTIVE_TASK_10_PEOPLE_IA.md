# Corrective Task 10 — People Tab Information Architecture

Status: Implemented and automatically validated; physical-device QA pending (same standing as every other projection screen — see `docs/PHASE_13_QA.md` for the QA approach this follows)
Date: 11 September 2026

## Problem

Home already says "Everything for {name}, in one place" and is that person's operational dashboard (Today/Upcoming/Recently added, the at-a-glance strip). The tab previously labelled with the supported person's name (`PersonScreen.tsx`, Phase 13) repeated much of that same information a second time — bills/renewals, home matters, documents, care notes — under a different heading. This duplicated Home and gave the tab no distinct purpose of its own.

## Product decision

The tab is renamed **People** ("the people involved in care") and no longer behaves as a second Home dashboard. It now centres on four things Home/Calendar/To Do genuinely do not cover:

1. **Supported people** — the person/people whose care is organised here (e.g. Beauty). Unchanged mechanism: tapping the current person's card still opens the existing `PersonSwitcher` — its logic, care-space switching and `activeCareSpaceId` semantics were not touched.
2. **Key contacts** — external people/services with no Lilica account (GP, pharmacy, a neighbour). This is the exact same `contact` record type and creation architecture Phase 13 already established, just renamed and now the tab's primary durable-knowledge section rather than one of five.
3. **Care circle** — authenticated Lilica members who actually have access to this care space (e.g. "David — Organiser", "Sarah — Contributor"). Phase 13 had only ever shown a static, hardcoded "You" placeholder here; this task wires in the real `careCircleMembers` list Phase 15 already produces and Settings' own Care Circle screen already reads (`App.tsx`'s `careCircleMembers` state, refreshed on active-space change, empty for a local-only care space). No member is ever fabricated, and an external Key contact is never conflated with a care-circle member — they are rendered by entirely separate code paths reading entirely separate data (`records` vs `careCircleMembers`).
4. **Ask Lilica** — the existing non-interactive placeholder, moved from Home to People (re-homed only; no new AI functionality was implemented, and its placeholder status is preserved exactly as it was).

## Removed as primary sections

Bills & renewals (`bill`), Home (`homeMatter`), Documents & paperwork (`document`) and Care & health information (`careNote`) are no longer rendered as People sections. **No records were deleted or altered** — these types are untouched in storage and continue to appear correctly in Home (its "Recently added" fallback already covers every non-actionable record type, including these four) and, where actionable, Calendar/To Do. This is a projection change only.

## Architectural distinctions preserved

- **Supported person**: a care space being organised for (`LocalCareSpaceState`/`people` prop). Unchanged.
- **Care-circle member**: an authenticated Lilica user with real access (`CareCircleMember`, Phase 15). Sourced only from `careCircleMembers`.
- **External contact**: a named useful person/service with no Lilica account (`contact` record). Sourced only from `records`.

These three are never inferred from one another — a contact's name/role never promotes it to a membership, and a relationship label never implies account access.

## What was not touched

Canonical record storage, bill/home/document/care-note data (still present, still correct in Home/Calendar/To Do), Phase 15's real invitation/membership logic, `PersonSwitcher`, Home, Calendar, To Do, or any onboarding/authentication flow. `PersonScreen.tsx` remains a pure projection: it still takes no care-space ID of its own and makes no network or storage call — the same isolation and offline guarantees documented in `docs/PHASE_13_ARCHITECTURE.md` apply unchanged.

## Tests

`tests/phase13-person.test.tsx` was rewritten (superseding its old five-section assertions) to cover: Key contacts only (no bills/home/documents/care-note duplication), supported-people display, real care-circle membership rendering with role labels, the external-contact/care-circle-member non-conflation guarantee, the "just you" honest empty state for a local-only care space, Ask Lilica's move from Home to People, self-care wording, care-space isolation, and offline-safety. `tests/tab-header-titles.test.tsx` updated to assert the tab leads with "People" rather than "Care Circle".

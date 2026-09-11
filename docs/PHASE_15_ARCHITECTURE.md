# Phase 15 Care-Circle Invitations And Collaboration Architecture

Status: database layer (invitations, roles, domain grants, assignment-visibility enforcement) implemented and automatically validated (pgTAP + Jest); client layer (Care Circle screen, real assignment selector) implemented and automatically validated; physical two-real-account device QA pending (see `docs/PHASE_15_QA.md`)
Date: 11 September 2026

## Boundary

Phase 15 makes sharing a Lilica care space **real, explicit, permissioned and revocable** between genuine Supabase accounts. It extends — rather than duplicates — the Phase 6/7 membership/RLS skeleton: `care_space_memberships.membership_status` (active/revoked) already existed and is reused unchanged for removal/leaving; `can_access_care_space_records()` was already the designated Phase 15 extension point (code-commented as such since Phase 7); the domain taxonomy (general/health/financial/home/documents) already existed via `record_domain_for_type()`.

Out of scope, deliberately not touched: Home/Calendar/To Do/Person/onboarding/auth redesign, Phase 7 sync internals, Phase 14's reminder engine internals (only reused as-is), document cloud maturity, OCR, Ask Lilica, search/history, professional/agency workflows, emergency access, Phase 16+.

## Core Invariant

Sharing must be real, explicit, permissioned and revocable. Nothing in this phase infers membership, role, or visibility from a name, email, relationship label, contact, or the legacy `responsiblePerson` free-text field. A pending invitee is never a member, is never assignable, and is authorised to read nothing.

## Locked Invariant: Assignment ≠ Permission

"Who is expected to deal with this" (assignment) and "who is allowed to see this" (permission/visibility) are kept strictly separate, and assignment must never grant permission:

- `apply_record_mutation()` (redefined, same signature, in `supabase/migrations/20260911120000_phase15_care_circle.sql`) now validates any `assignedMembershipId` present in the merged record data: the target membership must (a) be **active** in this care space and (b) have **read access to this record's actual domain**. Either failure raises `42501` and the whole mutation is rejected — never silently dropping just the assignment.
- This closes two real gaps that existed before Phase 15: the write-access check was hardcoded to the `'general'` domain regardless of the record's real domain (would have wrongly gated/ungated contributors with partial grants), and `assignedMembershipId` was never validated at all — any value round-tripped through `record_data` unchecked.
- Because the check re-runs on every mutation (not only the one that first sets the assignment), a **replayed/offline mutation cannot recreate access for a since-removed member** by re-sending the same assignment — Scenario H's fixed test in `supabase/tests/database/phase15_care_circle.test.sql`.
- Removing a member never rewrites a record's historical `assignedMembershipId` — attribution is retained. The client is responsible for rendering "assignee no longer has access" when the assigned membership is not in the current active member list (not yet built as its own UI affordance; `careCircleMembers` from `src/careCircle.ts` is the source of truth a screen would check against).

## Role Presets And The Capability/Grant Model

Three role presets, not "dozens of roles": **Organiser**, **Contributor**, **Viewer** (`care_space_memberships.role`, CHECK-extended from the Phase 6 organiser-only constraint). Role is a convenience preset, not the sole security boundary — it sits over an explicit per-domain grant model:

- `care_space_domain_grants` — one row per `(membership_id, domain)` a **non-organiser** has been explicitly given `can_read`/`can_write` on. Organisers need no rows here; their role alone grants full, unconditional access to every domain, unchanged from Phase 7/8/9.
- `membership_has_domain_access(membership_id, domain, action)` — the shared access decision, keyed by membership ID rather than caller identity, so it can answer both "can the caller do X" (via `can_access_care_space_records()`, unchanged signature, now delegating to this) and "does this OTHER membership have visibility" (the assignment check above).
- **Default-deny**: a domain not explicitly granted is invisible to a contributor/viewer, full stop — there is no implicit "general access for everyone" fallback. An invitation's `granted_domains` is chosen explicitly by the inviting organiser (the Care Circle screen's invite form asks them to review it before sending, per the brief's "review access before send" requirement) and is exactly what the resulting membership's grant rows become on acceptance.
- A viewer's grant rows are always `can_write = false`; a contributor's are `can_write = true` for whatever domains they were granted. Changing a member's role (`change_member_role()`) replaces their grant rows wholesale with the new set passed in — never merges stale ones forward.

## Invitation Lifecycle

`care_space_invitations`: `pending → accepted | declined | expired | revoked` (all terminal except pending). Fields: `care_space_id`, `invited_by_membership_id`, `invitee_email` (normalised lower-case), `role` (`contributor`/`viewer` only — an invitation can never directly grant `organiser`), `relationship_type`/`relationship_label` (reuses the exact same CHECK-constrained vocabulary as `care_space_memberships`, including the "label required for Other relative/Someone else" rule), `granted_domains`, `operation_id` (idempotency), `created_at`/`expires_at` (14-day default), `responded_at`, `accepted_membership_id`.

- **`invite_member()`** — organiser-only (checked against the caller's own active organiser membership in that space, not client-asserted). Rejects inviting someone who already has active access. Upserts (via a partial unique index on `(care_space_id, lower(invitee_email)) where status = 'pending'`) rather than duplicating a still-pending invite to the same address — a re-invite refreshes role/domains/expiry.
- **`list_my_invitations()`** — the invitee's own pending, unexpired invitations only, resolved by their authenticated email (`auth.jwt() ->> 'email'`), never by any client-supplied identity. Lazily flips anything past `expires_at` to `expired` on read, so an expired invitation is never silently still acceptable. This is a SECURITY DEFINER function, not a direct table SELECT — an invitee has no membership yet to scope table-level RLS against, so `care_space_invitations`' own RLS policy only lets an **organiser** SELECT directly; the invitee's access is exclusively through this function.
- **`accept_invitation()`** — verifies the caller's own authenticated email matches the invitation, verifies it is still pending and unexpired, then creates (or **reactivates**, if this user held a since-removed membership in that same space — `care_space_memberships` allows only one row per `(user_id, care_space_id)`) the real membership with exactly the invitation's role/relationship/domain grants, and marks the invitation accepted with `accepted_membership_id` set.
- **`decline_invitation()`** — invitee-only, pending-only.
- **`revoke_invitation()`** — organiser-only, pending-only. A revoked invitation is a hard terminal state (cannot be revoked again, cannot later be accepted).

## Membership Lifecycle: Removal And Leaving

Both **reuse the existing `membership_status` active/revoked column** — no new column, no parallel lifecycle. Every RLS check and `can_access_care_space_records()` call already keys on `membership_status = 'active'`, so a revoked membership loses access immediately and everywhere the moment the row is updated — DB, RLS-gated reads, and any client re-sync alike.

- **`remove_member()`** — organiser-only. Refuses to remove the sole remaining active organiser (a care space can never be left without one).
- **`leave_care_space()`** — a member revoking their own membership. Same sole-organiser protection: a sole organiser must hand organiser role to someone else first (`change_member_role()`), or leaving is refused with an explanatory error.
- **`change_member_role()`** — organiser-only. Refuses to demote the sole remaining organiser. Replaces the target membership's domain grants wholesale with the new set passed in.
- Role itself became a legitimately-changeable field in this phase: Phase 6's `protect_membership_identity()` trigger originally treated `role` as an immutable ownership identifier (safe at the time, since `'organiser'` was the only allowed value). It is redefined here to keep `care_space_id`/`user_id`/`bootstrap_id` immutable but allow `role` to change — authorised exclusively by `change_member_role()`'s own organiser + sole-organiser-safety checks, never by direct client `UPDATE`.

## Member Display

`list_care_space_members(care_space_id)` returns active members only (never pending/declined/expired/revoked/removed/left), each with `membership_id` (the real, stable identity), a human-friendly `display_name` (from `profiles`), `role`, `relationship_type`/`relationship_label`, `is_self`, and `granted_domains`. Display name is sourced live from `profiles` on every call — changing it never touches any stored assignment, because assignment is keyed by `membership_id`, never by name. This is the same "no name matching, ever" discipline the legacy `responsiblePerson` free-text field has always been held to.

## Real Assignment Selector (extends Phase 9)

`src/components/RecordEditor.tsx`'s "Assigned to" control previously offered only Unassigned/You (`activeMembershipId`). It now accepts an optional `careCircleMembers: CareCircleMember[]` prop (from `App.tsx`'s `listCareSpaceMembers()`, refreshed whenever the active care space changes or Care Circle is opened) and, when present, offers every member with visibility into **this record's domain** — computed client-side via the new `recordDomainForType()` in `src/records.ts` (an exact mirror of the server's `record_domain_for_type()`), filtering `careCircleMembers` to `role === 'organiser' || grantedDomains.includes(domain)`. This is a courtesy (a clearer, non-broken picker) — the server-side check in `apply_record_mutation()` is what actually enforces the invariant; the client filter can never be the only thing standing between a forbidden assignment and the database. With no `careCircleMembers` prop supplied (a local-only care space, or before the first fetch resolves), the control falls back to exactly its pre-Phase-15 Unassigned/You behaviour — existing Phase 9/12/14 tests pass unchanged.

## Client Boundary (`src/careCircle.ts`)

A thin, typed RPC wrapper module, following the same pattern as `src/careSpaces.ts`: every function maps snake_case RPC rows to camelCase types and never throws (`{ ok, data | message }`). No authorisation logic lives here — every function's actual authority comes from the server function it calls. `inviteMember`, `listMyInvitations`, `acceptInvitation`, `declineInvitation`, `revokeInvitation`, `listCareSpaceMembers`, `listCareSpaceInvitations`, `changeMemberRole`, `removeMember`, `leaveCareSpace`.

## Care Circle Screen (`src/screens/CareCircleScreen.tsx`)

Reachable from Person's header via a "Care Circle" link (next to the existing "Account" link), shown only when the active care space is a real (non-`local-`) synced space with a membership — matching Person's own precedent for `onOpenAccount`. Shows the active member list (with role, relationship, and — for non-organisers — exactly which domains they can see), pending invitations with a cancel action, and an invite form: email, relationship label, role (Contributor/Viewer), and an explicit domain checklist the organiser reviews before sending (default-deny — nothing is pre-selected beyond "Everyday things"). Removing a member or cancelling an invitation re-fetches both lists from the server afterwards, so the screen never shows an optimistic guess about server-authoritative state.

## What Is Deliberately Not Built Yet

Documented here rather than silently absent, matching this project's established honesty precedent (see Phase 14's own "deferred" section):

- **No UI for an invitee to discover or accept an invitation.** `listMyInvitations()`/`acceptInvitation()` are implemented, server-validated and unit-tested, but no screen calls them yet for someone who isn't already a member of a space. Once `accept_invitation()` does run, the resulting membership needs no further client-side plumbing to surface — `reconnectCareSpaces()` (existing since Phase 6, calling `list_my_supported_people()`, which was never role-filtered) already picks up any active membership, contributor/viewer included, the same way it always has for organisers. The missing piece is purely the "you've been invited" entry screen itself, deliberately not built this phase to avoid rushing changes to the onboarding/care-space-switching state machine (`App.tsx`'s `OnboardingStage` machine, explicitly out of scope for a redesign this phase).
- **No push/email delivery of the invitation itself.** An invited person currently discovers their invitation only by opening Lilica and having `list_my_invitations()` return it — there is no email sent, no push notification. Reusing Phase 14's local-notification engine for "you have an invitation" / "your invitation was accepted" / "work was assigned to you" (brief sections 39-40) is designed for (the domain/permission model is already in place to support it safely) but not yet wired up.
- **No dedicated "assignee no longer has access" UI treatment.** The data needed for a screen to detect and show this (comparing a record's `assignedMembershipId` against the current active `careCircleMembers` list) is available via `src/careCircle.ts`, but no screen renders that state specially yet — an editor currently just shows the assignment control's normal Unassigned/named-member options, with the previously-assigned-but-now-inactive member simply absent from the offered list.
- **No progressive-disclosure "change role" UI.** `change_member_role()` exists and is pgTAP-tested; the Care Circle screen does not yet expose a control to call it (only invite and remove are wired into the UI).
- **No organiser self-service "make someone else organiser then leave" flow in the UI**, though the underlying `change_member_role()` + `leave_care_space()` functions and their sole-organiser-safety checks are implemented and tested.

None of this is faked — the app never claims an invitation was sent by email, never shows a stale assignee as if they still had access, and never offers a role-change control that doesn't work. It is simply not yet built, exactly as stated here.

## Validation

- **Database**: `supabase/tests/database/phase15_care_circle.test.sql` — 31 pgTAP assertions covering invite→pending→zero-access, accept→real membership with exactly the granted domains, default-deny for ungranted domains, forbidden assignment (financial-domain record to a member without financial grant) rejected, permitted assignment succeeds, viewer read-without-write, immediate zero-access on removal with attribution retained, a stale/replayed mutation unable to recreate access for a removed member, sole-organiser removal/leave protection, invitation terminal states (revoked cannot be revoked again), and cross-space/non-organiser denial. Runs alongside the full existing 152-assertion RLS suite (Phases 6/7/8/9) with zero regressions — `npm run validate:backend`.
- **Client**: `tests/phase15-care-circle.test.ts` (RPC wrapper mapping/error-handling, `recordDomainForType()` mirrors the server exactly) and `tests/phase15-record-editor.test.tsx` (the real assignment selector offers only visibility-eligible members, stores membership ID never display name, and falls back to pre-Phase-15 behaviour with no care circle loaded) — 11 new tests, all existing 247 Phase 1-14 tests unchanged and passing (258 total). `npm run validate`.

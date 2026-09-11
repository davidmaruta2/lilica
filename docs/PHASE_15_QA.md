# Phase 15 Physical-Device QA — Care-Circle Invitations And Collaboration

Status: implementation complete, automated tests passing (see `docs/PHASE_15_ARCHITECTURE.md`); physical-device QA not yet run.

**Requires two real Supabase accounts, on two devices (or two separate app sessions signed in as each account).** This phase is explicitly NOT adequately tested with one account pretending to be two — invitations, permissions and removal must be proven across a genuine account boundary. Use `lilica-development` only, never production.

## Setup

1. Account A ("the organiser") — an existing or fresh Lilica account with at least one supported person set up.
2. Account B ("the invitee") — a second, separate Lilica account (different email), signed in on a second device or a second app session.
3. Note Account B's exact sign-up email before starting — invitations are address-matched exactly.

## Checks

### Inviting and accepting (Scenarios A/B/C)

1. **Invite sent** — Account A opens Person → Care Circle → Invite someone, enters Account B's email, a relationship label, role (Contributor), and grants only "Everyday things" and "Home & car" (leave Care & health and Bills & money unchecked). Send.
2. **Zero access while pending** — before accepting, Account B has no visibility into Account A's care space anywhere in the app (no new person/tab appears).
3. **Invitation visible to the right account only** — a third account (not invited) sees nothing.
4. **Accept** — **this build has no dedicated UI for an invitee to discover or accept an invitation yet** (`listMyInvitations()`/`acceptInvitation()` in `src/careCircle.ts` are implemented and server-validated, but no screen calls them for an invitee who isn't already a member of the space). To QA everything downstream of acceptance, call `acceptInvitation(invitationId)` for Account B via a temporary developer hook (e.g. a debug console call, or a short-lived test button), then continue from step 5. Building the real "you've been invited" screen is the top of the Phase 15 follow-up list — see `docs/PHASE_15_ARCHITECTURE.md`'s "What Is Deliberately Not Built Yet".
5. **Membership is real** — after accepting, Account B can see Account A's supported person's everyday/home records, but NOT care/health or bills/money records.
6. **Assignment works within granted domains** — Account A assigns a task (everyday domain) to Account B; Account B sees it in their To Do.
7. **Assignment is rejected outside granted domains (Scenario D)** — Account A attempts to assign a bill (financial domain) to Account B; the assignment control should not even offer Account B for that record (client-side filter), and if forced via a stale/replayed state, the server rejects it — confirm no crash, a clear error, and the bill remains unassigned or assigned to its previous assignee.

### Roles (Scenario J)

8. **Viewer cannot write** — Account A invites a third account as Viewer with "Everyday things" granted. That account can see everyday records but cannot create, edit, or complete anything (write actions are absent or fail with a clear message, never silently no-op).

### Display name independence (Scenario legacy-Sarah / display-name-change)

9. **Display name change doesn't touch assignment** — Account B changes their own display name in Account settings. Confirm the task assigned to them in step 6 is still correctly shown as assigned to them (never re-resolved by old/new name).
10. **Legacy free-text is never auto-linked** — create a record with the old free-text "Who's dealing with it" field set to Account B's exact display name (not using the Assigned-to control). Confirm this never causes Account B to appear as the structured assignee, and never grants them any access they don't already have from their membership.

### Removal (Scenario G) and offline replay (Scenario H)

11. **Removal is immediate** — Account A removes Account B from Care Circle. Within the same session (no app restart needed), Account B's next action against that care space (pull-to-refresh, opening a record) shows zero access.
12. **Historical attribution retained** — the task from step 6, previously assigned to Account B, still shows Account B as who it was assigned to (not silently reassigned to someone else or blanked), even though Account B no longer has access.
13. **Offline stale reassignment cannot restore access** — if the test build allows forcing an offline queued mutation (e.g. airplane mode + edit + reconnect) that re-sends an assignment to the now-removed Account B, confirm on reconnect that mutation is rejected server-side and Account B still has no access.

### Re-invitation and terminal states (Scenario K)

14. **Decline** — invite a fourth account; have them decline. Confirm they gain no access and the invitation cannot later be accepted.
15. **Revoke** — invite a fifth account; Account A revokes before they respond. Confirm the invitee cannot accept a revoked invitation.
16. **Re-invite after removal** — Account A re-invites the removed Account B from step 11. Confirm a fresh invite/accept cycle correctly restores exactly the newly granted access (not the old grants from before removal).

### Sole-organiser safety

17. **Cannot remove the only organiser** — with only one organiser, attempting self-removal or "leave" is refused with a clear explanation, not a crash or silent no-op.
18. **Cannot strand the space** — promote Account B to organiser, then confirm Account A can now leave or be removed successfully.

### Cross-space isolation

19. **No leakage between spaces** — if Account A has more than one supported person/care space, confirm Account B's Phase 15 access is scoped only to the specific care space they were invited into, never any other space Account A organises.

## Known limitations (by design, not defects — see `docs/PHASE_15_ARCHITECTURE.md`'s "What Is Deliberately Not Built Yet")

- No email/push delivery of the invitation itself — the invitee currently discovers it only inside the app.
- No dedicated "assignee no longer has access" visual treatment.
- No in-app "change role" control yet (server function exists and is tested; UI does not expose it).
- No guided "hand over organiser, then leave" flow in the UI (both underlying functions exist and are tested independently).

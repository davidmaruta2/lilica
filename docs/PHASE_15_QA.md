# Phase 15 Physical-Device QA - Care-Circle Invitations And Collaboration

Status: implementation complete, automated tests passing (see `docs/PHASE_15_ARCHITECTURE.md`); physical-device QA not yet run.

**Requires two real Supabase accounts, on two devices (or two separate app sessions signed in as each account).** This phase is explicitly NOT adequately tested with one account pretending to be two - invitations, permissions and removal must be proven across a genuine account boundary. Use `lilica-development` only, never production.

## Setup

1. Account A ("the organiser") - an existing or fresh Lilica account with at least one supported person set up.
2. Account B ("the invitee") - a second, separate Lilica account (different email), signed in on a second device or a second app session.
3. Note Account B's exact sign-up email before starting - invitations are address-matched exactly.

## Checks

### Inviting and accepting (Scenarios A/B/C)

1. **Invite sent** - Account A opens Person → Care Circle → Invite someone, enters Account B's email, a relationship label, role (Contributor), and grants only "Everyday things" and "Home & car" (leave Care & health and Bills & money unchecked). Send.
2. **Zero access while pending** - before accepting, Account B has no visibility into Account A's care space anywhere in the app (no new person/tab appears).
3. **Invitation visible to the right account only** - a third account (not invited) sees nothing.
4. **Accept** - Account B should see the Invitations screen open automatically shortly after signing in (once per app session, the first time a pending invitation is found). If it was previously dismissed with "Not now", reopen it from Person's header ("Invitations (N)" link, next to Care Circle/Account). Confirm the screen correctly shows the care space name, that it was invited by Account A, the role (Contributor), and exactly the domains granted ("Everyday things, Home & car" - not the withheld ones). Tap Accept.
4a. **Membership appears without restarting** - after accepting, confirm Account A's supported person now appears as a person/space Account B can switch to, without needing to sign out and back in (this reuses the existing `reconnectCareSpaces()` flow, unchanged since Phase 6).
5. **Membership is real** - after accepting, Account B can see Account A's supported person's everyday/home records, but NOT care/health or bills/money records.
6. **Assignment works within granted domains** - Account A assigns a task (everyday domain) to Account B; Account B sees it in their To Do.
7. **Assignment is rejected outside granted domains (Scenario D)** - Account A attempts to assign a bill (financial domain) to Account B; the assignment control should not even offer Account B for that record (client-side filter), and if forced via a stale/replayed state, the server rejects it - confirm no crash, a clear error, and the bill remains unassigned or assigned to its previous assignee.

### Roles (Scenario J)

8. **Viewer cannot write** - Account A invites a third account as Viewer with "Everyday things" granted. That account can see everyday records but cannot create, edit, or complete anything (write actions are absent or fail with a clear message, never silently no-op).

### Display name independence (Scenario legacy-Sarah / display-name-change)

9. **Display name change doesn't touch assignment** - Account B changes their own display name in Account settings. Confirm the task assigned to them in step 6 is still correctly shown as assigned to them (never re-resolved by old/new name).
10. **Legacy free-text is never auto-linked** - create a record with the old free-text "Who's dealing with it" field set to Account B's exact display name (not using the Assigned-to control). Confirm this never causes Account B to appear as the structured assignee, and never grants them any access they don't already have from their membership.

### Removal (Scenario G) and offline replay (Scenario H)

11. **Removal is immediate** - Account A removes Account B from Care Circle. Within the same session (no app restart needed), Account B's next action against that care space (pull-to-refresh, opening a record) shows zero access.
12. **Historical attribution retained** - the task from step 6, previously assigned to Account B, still shows Account B as who it was assigned to (not silently reassigned to someone else or blanked), even though Account B no longer has access.
13. **Offline stale reassignment cannot restore access** - if the test build allows forcing an offline queued mutation (e.g. airplane mode + edit + reconnect) that re-sends an assignment to the now-removed Account B, confirm on reconnect that mutation is rejected server-side and Account B still has no access.

### Re-invitation and terminal states (Scenario K)

14. **Decline** - invite a fourth account; have them open the Invitations screen and tap Decline. Confirm they gain no access and the invitation cannot later be accepted (re-opening the screen or Person's "Invitations" link no longer shows it, since it's no longer pending).
14a. **"Not now" then reopen** - invite a fifth account; when their Invitations screen auto-opens, tap "Not now". Confirm they land on normal onboarding/Home, the invitation is untouched, and Person's header still shows "Invitations (1)" - tapping it reopens the same screen with the same invitation still there.
14b. **Screen closes itself once resolved** - with exactly one pending invitation, accept (or decline) it; confirm the Invitations screen closes on its own back to normal use, without a manual "Not now".
15. **Revoke** - invite a fifth account; Account A revokes before they respond. Confirm the invitee cannot accept a revoked invitation.
16. **Re-invite after removal** - Account A re-invites the removed Account B from step 11. Confirm a fresh invite/accept cycle correctly restores exactly the newly granted access (not the old grants from before removal).

### Sole-organiser safety

17. **Cannot remove the only organiser** - with only one organiser, attempting self-removal or "leave" is refused with a clear explanation, not a crash or silent no-op.
18. **Cannot strand the space** - promote Account B to organiser, then confirm Account A can now leave or be removed successfully.

### Cross-space isolation

19. **No leakage between spaces** - if Account A has more than one supported person/care space, confirm Account B's Phase 15 access is scoped only to the specific care space they were invited into, never any other space Account A organises.

## Care Circle invitation & joining flow completion, 14 September 2026 - physical QA still required

Everything below is genuinely NOT RUN as of writing (server-side/client-side logic proven by pgTAP/Jest and one real end-to-end run against `lilica-development`, but never on a physical device) - see `docs/PHASE_15_ARCHITECTURE.md`'s matching addendum and the full completion report for exactly what each level of testing did and did not prove:

20. **Manual code entry, new user** - a genuinely new Lilica account, with no supported person and no auto-surfaced invitation, sees "What would you like to do?" and can choose "Join a Care Circle", enter a real code, review it, and join without ever being forced through supported-person creation.
21. **Manual code entry, existing user** - an existing organiser/member opens People -> Care Circle -> "Join another Care Circle", enters a code for a DIFFERENT care space, and ends up with both care spaces intact and switchable.
22. **Invalid/expired/cancelled code** - each shows its own calm message on a real device, and the user can correct and retry without being stranded.
23. **Email/Share now show the code** - open a real invitation email and a real Share sheet message, confirm both display the code in the `ABCD-1234` format alongside the existing link.
24. **Invitation-created vs pending-invitation UX** - create an invitation, confirm only ONE representation of it ever shows on screen at any point (creation panel, then exactly one Pending row after any outcome - send, share, or Dismiss).

## Known limitations (by design, not defects - see `docs/PHASE_15_ARCHITECTURE.md`'s "What Is Deliberately Not Built Yet")

- No OS-level push delivery of the invitation itself (email, native Share, and a manual invitation code all now cover delivery - only push notification delivery remains undone).
- No dedicated "assignee no longer has access" visual treatment.
- No in-app "change role" control yet (server function exists and is tested; UI does not expose it).
- No guided "hand over organiser, then leave" flow in the UI (both underlying functions exist and are tested independently).

# Phase 20C - Jointly Navigation & Discoverability Reconciliation: Audit / Proposal Only

**AUDIT / PROPOSAL ONLY. NO IMPLEMENTATION HAS BEEN PERFORMED. THIS DOCUMENT MUST BE REVIEWED BY GPT AND THE PRODUCT OWNER BEFORE ANY DRAWER/NAVIGATION CHANGE IS IMPLEMENTED.**

Implemented from the approved `menu.txt` brief (`LILICA - PHASE 20C: JOINTLY NAVIGATION & DISCOVERABILITY RECONCILIATION`). Phase 20 (capability parity) is preserved unchanged and not rewritten here - see `docs/PHASE_20_GAP_AUDIT.md` (audit) and `docs/PHASE_20_ARCHITECTURE.md` (implementation) for that history. Phase 20C is a distinct, later reconciliation: **Phase 20 asked "what can Jointly do that Lilica can't"; Phase 20C asks "can a carer actually find everything Lilica can already do."**

`PRE_PHASE_20C_BASELINE`: HEAD `a67c40f` (in sync with `origin/master`); tracked working tree clean.

---

## 1. Executive conclusion

Jointly's menu *looks* bigger than Lilica's because Jointly exposes almost every capability as its own top-level, permanently-visible menu row (Messages, Calendar, Notes, Tasks, Reminders, Contacts, Medications, Devices - a flat module list), while Lilica deliberately collapses most of that same surface area into four primary tabs plus a small number of contextual links reached *through* People. The product owner's own observation is correct on its face (the Settings drawer alone is thin - four rows) but is comparing the wrong surface: Lilica's real "menu" is Home + Calendar + To Do + People + Search, not the Settings drawer, which was only ever intended to hold account/app-level administration.

Having now reconciled every identifiable Jointly capability against the actual current implementation, this audit finds:
- **Most of Jointly's apparent breadth already exists in Lilica** - almost everything Jointly names is already built (To Do, Calendar, Care Circle, Contacts, Recent Activity, Care Summary), just reached through a tab or a People link rather than a drawer row.
- **A genuine, specific navigation problem exists**: three real, already-built, already-approved capabilities (**Care Summary**, **Recent Activity**, and to a lesser extent **Documents-as-a-collection**) are reachable only by first opening People and then finding a small text link - they are not wrong to be there, but they have **no second, faster route**, and two of them (Care Summary, Recent Activity) were built specifically to solve a "what's going on / what changed" need that a carer would reasonably expect to find quickly, not two taps deep inside another screen.
- **Documents specifically has no browsable collection at all** - not merely poor discoverability, but a genuine structural gap: there is no screen anywhere in the app that lists "every document for Maggie," only Search, Care Summary's bounded 4-5-item preview, or stumbling on one inside Home/Calendar/To Do.
- **The Settings drawer is currently Settings-only in practice, but the product owner's instinct toward a hybrid is well-founded** - a small, clearly-separated "[Person]'s care" section added above the existing account rows would close the discoverability gap without turning the drawer into a Jointly-style flat module list.
- **No genuine, previously-undiscovered PRODUCT gap was found in this pass** - every "missing" item traces to either an existing capability (poor discoverability), a Phase 20 deliberate omission that remains correct, or a Phase 20 deferred candidate that this audit reconfirms rather than silently reopens.

**Recommended outcome (detailed in section 14/23)**: add one new, clearly person-scoped section to the top of the Settings drawer - Search, Care Summary, Recent Activity, and (new, no code required) nothing for Documents beyond directing to Search, since a new Documents collection screen is itself a small feature addition, not a navigation fix, and is flagged as a genuine candidate for product-owner decision rather than assumed.

---

## 2. Why this audit was needed after Phase 20

Phase 20A's own audit (`docs/PHASE_20_GAP_AUDIT.md`) was explicitly a **capability** comparison - "what can Jointly do that Lilica cannot" - and its own scope notes are honest that visual/navigational quality was out of its remit ("Protect; full visual audit is Phase 22's job, not this one"). Phase 20B then implemented exactly three approved capabilities (Recent Activity, Search, Care Summary) and placed each using the *narrowest, least-invasive* location judged sufficient at the time (a header icon for Search; a small link under People's Care Circle card for Recent Activity; a small link under People's own person card for Care Summary) - each individually a reasonable, low-risk choice, but never checked against each other or against the app's *overall* navigational shape once all three existed together. This task performs that check.

---

## 3. Current Lilica navigation map (directly inspected this session and immediately before)

- **Bottom tab bar** (`App.tsx`, `TabBar.tsx`, permanent, four tabs): **Home**, **Calendar**, **To Do**, **People**.
- **Home** (`HomeScreen.tsx`): `+Add`, Settings cog, the avatar/name person-switcher, the search bar (-> `SearchScreen`), the horizontal status strip, Today/Upcoming/Recently-added record sections.
- **Calendar** (`CalendarScreen.tsx`): Settings cog, month grid, day-selected agenda list. No entry point to anything outside Calendar itself besides the cog.
- **To Do** (`ToDoScreen.tsx`): `+Add`, Settings cog, All/Mine/Unassigned filters, Overdue/Today/Upcoming groups, Show completed.
- **People** (`PersonScreen.tsx`): Settings cog, Invitations link (only when pending invitations exist), the supported-person switcher card, **Care summary** link (small, under the person card), **Key contacts** bounded preview -> **View all** (`ContactsListScreen.tsx`, only when more than 4 exist) or **Add**, **Care circle** summary card -> **Manage** (`CareCircleScreen.tsx`) and **Recent activity** link (both under the same card), and the still-placeholder **Ask Lilica**.
- **Settings drawer** (`SettingsMenu.tsx`, opened from the cog on every tab - the ONE consistent app-level entry point): exactly four rows today - **Account**, **Care Circle** (only when the active care space is synced and the user has a membership - a SECOND route to the same `CareCircleScreen.tsx` People's own "Manage" link reaches), **Privacy & data**, **Subscription**.
- **No other entry point exists anywhere in the app** for Search, Care Summary, Recent Activity, or a Documents collection - each of the three built-and-approved Phase 20B features has exactly one route in, and Documents has none at all as a distinct destination.

This matches direct inspection of `App.tsx`'s render wiring, not documentation assumption, per the brief's own instruction not to trust stale docs.

---

## 4. Reconstructed Jointly navigation/menu inventory

Reconstructed from `docs/PHASE_20_GAP_AUDIT.md`'s own sourced evidence table (Apple App Store listing, Carers UK page, and the product owner's own previously-supplied screenshot description) - **not re-derived from memory**, and every confidence level below is carried forward unchanged from that document's own classification, since no new Jointly material was supplied to this session.

| Jointly item | What it does | Class | Evidence |
|---|---|---|---|
| Circles / invitations / members | Create/join a care circle, invite by email/link | A. primary navigation | VERIFIED CURRENT |
| Messages (group + direct) | Real-time chat, image uploads | F. feature/module | VERIFIED CURRENT |
| Calendar | Events, recurrence, location search, categories | A. primary navigation | VERIFIED CURRENT |
| Tasks | Task lists, assignment, status, move between lists | A. primary navigation | VERIFIED CURRENT |
| Medications | Current/past medication, image upload | F. feature/module | VERIFIED CURRENT |
| Notes | Notes with image/document attachments | F. feature/module | VERIFIED CURRENT |
| Contacts | Contact module + device import | B. care information | VERIFIED CURRENT |
| Profile page | DOB, condition, caring needs, likes/dislikes | B. care information | OBSERVED IN PRODUCT-OWNER SCREENSHOT |
| Devices | Receive/store/share data from connected devices | F. feature/module | VERIFIED CURRENT (description only) |
| Homepage "latest activity" | Cross-circle activity feed | B. care information | VERIFIED CURRENT |
| Member filtering (Events/Notes/Reminders/Tasks) | Filter any list by circle member | D. utility | VERIFIED CURRENT |
| Contingency Plan export | Exportable handover/emergency document | C. collaboration / B. care information | VERIFIED CURRENT (existence only, not exact fields) |
| Search (dedicated) | Keyword search | D. utility | UNCERTAIN (not confirmed either way) |
| Reminders | Reminder module (implied by member-filtering across "Reminders") | F. feature/module | VERIFIED CURRENT (named, not detailed) |
| Account/settings | Circle hiding, language, web app | E. account/settings | VERIFIED CURRENT |

---

## 5. Full Jointly -> Lilica reconciliation table

| Jointly item | Purpose | Lilica equivalent | Has capability? | Where it lives today | Taps from Home | In Settings drawer? | Elsewhere discoverable? | Discoverability | Phase 20 disposition | Current recommendation | Decision required? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Circles/invitations/members | Coordinate care | Care Circle (Phase 15) | YES | People -> Manage; Settings -> Care Circle | 2 | Yes | Yes (People) | GOOD | Advantage, protect | No change | No |
| Calendar | See what's happening | Calendar tab | YES | Bottom tab | 1 | No | N/A (permanent tab) | GOOD | Advantage/parity, protect | No change | No |
| Tasks | Track what needs doing | To Do tab | YES | Bottom tab | 1 | No | N/A (permanent tab) | GOOD | Advantage, protect | No change | No |
| Messages (chat) | Real-time family comms | Not built | NO | - | - | No | No | NOT AVAILABLE | Deliberate omission (7 in Phase 20A) | Do not build | No (reconfirmed) |
| Medications | Track what/dosage/schedule | Folded into `careNote` free text | PARTIAL | Inside a record, via Add or Calendar/To Do/Home | 1-2 (to add/find a note) | No | No dedicated destination | BURIED (as a distinct concept) | Genuine gap, P1/legal-gated (7C) | Reconfirm deferred; not a navigation fix | Yes (product+legal) |
| Notes | Unstructured observations | `careNote` + per-record notes + attachments | YES (differently) | Records, via Add/Home/Calendar/To Do | 1-2 | No | No | ACCEPTABLE | Handled differently, adequate (Phase 20A) | No change | No |
| Contacts + device import | Avoid retyping contacts | Key Contacts (manual only) | PARTIAL | People (bounded) -> View all | 2 | No | No | ACCEPTABLE (once you know to look on People) | Genuine gap - import only (7H) | Reconfirm deferred; not a navigation fix | Yes (product) |
| Profile page (DOB/condition/likes) | Quick "who is this person" reference | Not built | NO | - | - | No | No | NOT AVAILABLE | Genuine gap, deferred, legal-gated (7K) | Reconfirm deferred | Yes (product+legal) |
| Devices | Connected health-device data | Not built | NO | - | - | No | No | NOT AVAILABLE | Deliberate omission (7) | Do not build | No (reconfirmed) |
| "Latest activity at a glance" | Coordination visibility | Recent Activity (Phase 20B) | YES | People -> Care Circle card -> "Recent activity" | 2 | **No** | People only | **POOR** | Implemented Phase 20B; navigation now the problem | **Improve discoverability** | No (navigation fix) |
| Member filtering across lists | Understand a member's contribution | Not built as a cross-list filter | NO | - | - | No | No | NOT AVAILABLE | Genuine gap, small (7L) | Reconfirm deferred | Yes (product) |
| Contingency Plan export | "If I'm unavailable..." | Not built (Care Summary partly serves this) | PARTIAL | Care Summary (People) covers the underlying need informally | 2 | No | People only | ACCEPTABLE-POOR | Genuine gap, P1 (7D); Care Summary implemented instead as the nearest analogue | Reconfirm 7D still open; ensure Care Summary itself is discoverable | Yes (product) |
| Search (dedicated) | Find something entered long ago | Search (Phase 20B) | YES | Home's search bar only | 1 | **No** | No | **ACCEPTABLE** (one obvious route, but only one) | Implemented Phase 20B | Assess whether a second route adds value (section 12) | No (navigation judgement) |
| Account/settings | App-level administration | Account, Privacy & data | YES | Settings drawer | 2 | Yes | No | GOOD | N/A (Lilica-native) | No change | No |
| Subscription (n/a to Jointly directly, Lilica-specific) | Billing | Subscription (Phase 21) | YES | Settings drawer | 2 | Yes | No | GOOD | N/A | No change | No |
| Documents as a browsable collection | Find any document | **No dedicated destination exists** | PARTIAL (documents exist, no collection view) | Care Summary preview (bounded), Search, or stumbled on in Home/Calendar/To Do | 2+ (indirect) | No | Partially (Care Summary) | **POOR** | Not raised as a distinct gap in Phase 20A (documents were assessed for search/grouping, not for a collection screen at all) | **Flag as a genuine, newly-identified navigation+small-capability gap** | Yes (product) |

---

## 6. Existing-but-poorly-discoverable capabilities

- **Recent Activity** - fully built, correctly scoped, but two taps deep inside People's own Care Circle card, with no drawer entry and no Home indicator. The single clearest instance in the whole app of "we built the feature but under-exposed it," and the brief's own framing (section 14) is correct to worry Phase 20 "only partially solved the original user need" if this remains buried.
- **Care Summary** - same shape of problem, one level shallower (a footnote-style link under the supported-person card on People, easy to miss on a first visit, no drawer entry).
- **Documents as a collection** - see section 15; this is closer to a genuine small gap than a pure discoverability problem, since no destination exists to be "poorly discoverable" - there is nothing to find.

## 7. Existing-and-well-discoverable capabilities

- **Search** - one clear, obvious, well-placed entry point (Home's own search bar, now visually a real search-bar affordance per this session's own search4.txt work) - a single route is not automatically a problem (see section 12's judgement on whether a second route is actually needed).
- **Care Circle** - two independent, sensible routes already exist (People's "Manage" link, and Settings' own "Care Circle" row) - this is the one capability in the whole audit that already has exactly the kind of redundancy the product owner is asking for elsewhere.
- **Key Contacts** - a bounded preview with an explicit "View all" is a deliberate, already-approved design (Corrective Task 10/People final visual pass) - once a user has been to People once, this is obvious.
- **Account, Privacy & data, Subscription** - all reached identically and consistently via the one Settings cog present on every primary tab - this is the strongest, most consistent navigation pattern in the app.

## 8. Deliberately absent/rejected capabilities (reconfirmed, not reopened)

Carried forward unchanged from `docs/PHASE_20_GAP_AUDIT.md` section 7/35, and this audit finds no reason to revisit any of them purely for navigation purposes: general group messaging/chat; a generic parallel Notes feature; connected health-device integration; copying Jointly's own flat module-drawer structure. None of these should be "snuck back in through navigation work," per the brief's own explicit instruction (section 6) - a drawer row is itself a form of implementation-adjacent commitment, and none of these capabilities exist to have a row for.

## 9. Deferred product gaps (see full table, section 22)

Medication structure, supported-person optional profile fields, contact import, collaboration notifications, contextual record comments, calendar export, former-member visibility/cross-list filtering, and export narrative summary all remain exactly as Phase 20A left them - genuine candidates for a future, separately-approved product decision, not navigation problems, and not addressed by this audit's own recommendations.

---

## 10. "Where would I find...?" test

Starting from Home, for a carer supporting Maggie:

| Looking for | Result | Rating |
|---|---|---|
| Maggie's appointments | Calendar tab, or Home's own sections | OBVIOUS |
| Maggie's tasks | To Do tab, or Home's own sections | OBVIOUS |
| Maggie's documents (a specific one, if you know roughly when it was added) | Home/Calendar/To Do's own sections, or Search | REASONABLY FINDABLE |
| Maggie's documents (as a browsable list of everything) | No destination exists | **NOT AVAILABLE** |
| Maggie's contacts | People -> Key Contacts | REASONABLY FINDABLE |
| Maggie's Care Circle | People -> Care Circle card -> Manage, or Settings -> Care Circle | OBVIOUS |
| Maggie's care summary | People -> small link under the person card | **BURIED** |
| Recent changes/activity | People -> Care Circle card -> small link | **BURIED** |
| Medication information | Nowhere dedicated - inside a `careNote` record if one was ever added | **NOT AVAILABLE** (as a distinct concept; the underlying free-text note is findable only if you already know it exists) |
| Important notes/information | `careNote` records, via Home/Calendar/To Do/Search | REASONABLY FINDABLE |
| Emergency/contingency information | Not a distinct concept; Care Summary is the nearest analogue | **BURIED** (as above) / NOT AVAILABLE (as a purpose-built concept) |
| Subscription/account information | Settings drawer | OBVIOUS |
| Privacy/export controls | Settings drawer | OBVIOUS |

## 11. New-user discoverability assessment

Opening the drawer for the first time, a new user would correctly infer that Lilica has an account, some privacy/export controls, and a subscription - and, if the active care space is synced, a Care Circle. They would have **no reason to suspect from the drawer alone** that Lilica also has a Care Summary or a Recent Activity feed - those two genuinely useful capabilities are invisible unless the new user happens to explore People thoroughly enough to notice two small text links. This is a real comprehension gap, not merely an inconvenience for an experienced user: a brand-new carer is exactly the person most likely to benefit from Care Summary (a fast "what do I need to know" view) and least likely to have already explored deeply enough to find it.

## 12. Experienced-carer assessment

For a six-month user with substantial history, the two-tap route to Recent Activity/Care Summary remains equally buried (frequency of use does not reduce the tap count), and this is precisely the point in a user's life where Recent Activity matters most (the exact finding Phase 20A's own six-person-collaboration test already made, reconfirmed here from the navigation angle: "nobody can easily tell what changed recently without opening every record"). Search's single route (Home's own search bar) remains perfectly adequate at this stage - an experienced user has already learned where it is, and a second drawer entry would be pure redundancy, not a meaningful efficiency gain (see section 20's own "no shortcut without meaningful benefit" test).

---

## 13. Settings-only vs navigation-hub decision

**Recommendation: HYBRID (Option C)** - not a wholesale conversion of the drawer into a navigation hub, and not leaving it Settings-only.

Justification: the existing drawer rows (Account, Care Circle, Privacy & data, Subscription) are genuinely account/app-scoped and belong together as "Settings" in the ordinary sense - nothing about them is person-specific navigation, and conflating them with a person-scoped section without any separation would blur exactly the account-vs-care-space distinction the brief's own section 27 requires. But the product owner's instinct that the drawer *also* needs to answer "where do I find things about the person I'm supporting" is well-founded given the "where would I find...?" test above - a purely Settings-only drawer leaves Care Summary and Recent Activity with no second route at all, which this audit finds is a genuine problem, not a preference. A **small, clearly-labelled, clearly-separated person-scoped section added ABOVE the existing account rows** achieves both: it makes the drawer a genuine "everything about Maggie and my account, in one place" hub without turning it into Jointly's flat module list, because the section is bounded (a handful of rows, all already-built, already-approved destinations) rather than an attempt at menu parity.

---

## 14. Proposed exact drawer information architecture

```
Settings

Maggie's care
------------------------------
Care Summary
Recent Activity

------------------------------
Account
------------------------------
Account
Care Circle
Privacy & data
Subscription
```

Exact reasoning per row, tested against sections 9-12/16-19 below:

- **Care Summary**: included. Directly answers the "where would I find...?" BURIED rating found in section 10; a new/occasional helper materially benefits from a fast route to it; low regression risk (an additional entry point to an already-built, already-approved screen, no change to the screen itself).
- **Recent Activity**: included, for the identical reason - the single most carer-relevant gap Phase 20A itself identified, now correctly implemented but under-exposed exactly as section 14 of the brief worried it might be.
- **Search**: **NOT included.** Assessed in detail in section 16 - Home's own search bar is already a single, obvious, well-placed, person-context-carrying route; a second drawer entry would either (a) require re-deriving the current supported person inside the drawer (duplicating context Home already establishes more naturally) or (b) search a different scope entirely (ambiguous), for no proven discoverability benefit over Home's own now-prominent search-bar affordance (this session's own search4.txt work made it more visually obvious specifically to avoid needing a second route).
- **Documents**: **NOT included as a new drawer row**, because no Documents collection screen currently exists to link to - adding a drawer row here would require building a new destination first, which is a small capability addition, not a navigation fix, and is explicitly out of this audit's authorised scope (see section 15/23's own "product decision required" flag rather than a silent recommendation to build one).
- **Key Contacts**: **NOT included.** People's own bounded-preview -> View all pattern (Corrective Task 10, explicitly approved, explicitly not to be undone per the brief's own section 16) is already a reasonably short, reasonably obvious route (2 taps from Home, and Key Contacts is squarely "People" content, unlike Care Summary/Recent Activity which read more like account-adjacent overviews of the WHOLE care situation). Duplicating it in the drawer would be redundant, not clarifying.
- **Care Circle**: **kept in the Account group, not duplicated into "Maggie's care."** It already has two sensible routes (People -> Manage, and this existing Settings row) - it is genuinely both a person-scoped concept (who helps Maggie) and an account-adjacent one (membership/permissions, closer in spirit to Account/Privacy than to Care Summary/Recent Activity). Moving it would not improve anything; it is already well-discoverable (section 7).
- **Home/Calendar/To Do/People**: **NOT duplicated anywhere in the drawer.** These are permanent bottom-tab destinations, one tap away at all times regardless of which screen the user is on - repeating them in the drawer would be pure clutter with zero discoverability benefit (see section 18).
- **Add**: **NOT represented in the drawer.** Add is already a prominent, permanent header action on Home/To Do (and reachable from People's own type-specific Add links) - it is an action, not a destination that benefits from menu presence (see section 19).

---

## 15. Dynamic supported-person behaviour

The proposed "Maggie's care" section header must read the exact same `personName`/`supportedPersonName` source every other part of the app already uses (confirmed this session's own search4.txt work reuses this identical source for Home's own avatar/search copy) - never a duplicate name state, never hard-coded. For a local-only (never-synced) care space, the section should read exactly as Home's own search bar already degrades - the person's name is still known locally even before any care space is synced, so this section can render correctly from the very first supported person onward, with Care Summary/Recent Activity's own existing "omitted for a local-only care space" guard (already implemented, per `PersonScreen.tsx`'s `onOpenCareSummary`/`onOpenRecentActivity` being `undefined` in that case) simply propagating - the drawer row would not render at all for a local-only space, exactly like the existing People links already correctly do not.

## 16. Multiple-supported-person behaviour

Because the section header itself states the current person's name (`"Maggie's care"`, becoming `"Beauty's care"` on switch), there is **no ambiguity risk** about whether Care Summary/Recent Activity concern the account globally or the currently active person - the label answers that question directly, exactly as the brief's own section 26 requires, without needing an extra explanatory line. Switching supported person while the drawer is open should refresh this section exactly as `SettingsMenu`'s own existing `subscriptionSummary` prop already re-renders live from `App.tsx` state - no new mechanism required, only reusing the pattern already proven for the Subscription row.

## 17. Account vs care-space separation

The two-group structure in section 14 **is** the account-vs-care-space separation the brief's own section 27 requires: "Maggie's care" is explicitly person/care-space-scoped (Care Summary, Recent Activity - both already architecturally scoped to the active care space, confirmed via `App.tsx`'s existing `onOpenCareSummary`/`onOpenRecentActivity` wiring), "Account" is explicitly account/app-scoped (Account, Care Circle, Privacy & data, Subscription - Care Circle sits here deliberately, per section 14's own reasoning, as a membership/permission concept rather than a pure content-browsing one). No row is proposed that would blur this line.

## 18. Drawer-length/density assessment

Current drawer: 3-4 rows (Care Circle conditional). Proposed drawer: 6-7 rows across two clearly-labelled groups (2 new + existing 4, Care Circle conditional as today). This remains well short of Jointly's own flat 8+-item module list and does not require scrolling on any reasonable device - the brief's own worry ("don't solve sparse by creating overwhelming") is not triggered by an addition of exactly two rows under one new, clearly-scoped heading. No further grouping/collapsing mechanism is needed at this length; this should be revisited only if a future phase adds materially more rows to either group.

## 19. Navigation-depth comparison

| Destination | Current route | Current taps from Home | Proposed route | Proposed taps from Home | Meaningful improvement? |
|---|---|---|---|---|---|
| Care Summary | Home -> People -> (find the small link) | 2, but requires finding a footnote-style link | Home -> Settings cog -> Care Summary | 2, but the destination is a plain, immediately-visible drawer row | YES - same tap count, materially better discoverability (the whole point of this task; tap count alone was never the problem, findability was) |
| Recent Activity | Home -> People -> Care Circle card -> (find the small link) | 2 (but nested two links deep inside one card) | Home -> Settings cog -> Recent Activity | 2, plain drawer row | YES, same reasoning |
| Search | Home -> search bar | 1 | (unchanged - no drawer entry proposed) | 1 | N/A - already optimal, no change proposed |
| Care Circle | People -> Manage, or Settings -> Care Circle | 2 (either route) | Unchanged | 2 | N/A - already has two good routes |
| Documents (collection) | No route exists | N/A | No route proposed (product decision required first) | N/A | Cannot be assessed until a destination exists |

---

## 20. DO NOT ADD list

- **Home / Calendar / To Do / People as drawer rows** - already permanent, one-tap bottom-tab destinations; duplicating them adds clutter with zero discoverability benefit (brief section 10's own default).
- **Add** - an action, not a destination; already prominent on every relevant screen (brief section 11's own default).
- **Key Contacts as a separate drawer row** - already has a good, approved, sufficiently-short route via People; duplicating it does not clarify anything (section 14's own reasoning).
- **A generic "Documents" drawer row pointing nowhere** - would create a dead-end/placeholder row, which this app's own established discipline explicitly avoids ("never a fake affordance" - the same principle already documented for Home's own status-chip tiles). Do not add until/unless a real Documents destination is separately approved.
- **Medications, Notes, Devices, Messages as drawer rows** - each is a deliberately rejected or deferred CAPABILITY (Phase 20A), not a navigation problem; adding a row for a capability that does not exist would misrepresent what Lilica can do (menu parity, not feature parity - exactly the trap brief section 18 warns against).
- **A Jointly-style flat list of every record category** (Appointments, Bills, Home & Car, etc. as individual drawer rows) - Calendar/To Do/Search/Home's own sections already represent these needs through Lilica's own cleaner model; a parallel category list in the drawer would be the exact "module-heavy" regression the brief explicitly warns against (section 23).
- **Subscription moved out of Account** - already well-discoverable (section 7), no evidence a move improves anything; Phase 21's own commercial model/UI is explicitly not to be redesigned by this task (brief section 28).

---

## 21. Product decisions required (not resolved by this audit)

1. **Should a genuine "Documents" collection destination be built at all** (a small, separately-scoped feature addition, not covered by Phase 20A's own approved set, and not something this audit is authorised to recommend as approved) - this audit only confirms the gap exists and is real; whether to build one, and where it would live in navigation once it exists, needs its own product decision.
2. **Should Care Summary/Recent Activity's EXISTING People-based links be removed once a drawer route exists, or should both routes coexist** (this audit recommends **both coexist** - Care Circle already proves two routes to the same destination work fine in this app, and removing the People links would itself be a small implementation change to two already-approved screens that this audit is not authorised to make) - flagged for explicit product-owner confirmation rather than assumed.
3. **Whether any of Phase 20A's still-deferred candidates** (medication structure, supported-person profile fields, contact import, collaboration notifications, contextual record comments, calendar export, former-member visibility, export narrative summary) should be reconsidered before release, per section 22's own table - this audit's own recommendation per item is stated there, but the final call remains the product owner's.

---

## 22. Deferred Jointly-inspired product-gap backlog (reconfirmed, not reopened)

| Capability | Current Lilica coverage | Phase 20 decision | Still relevant? | Recommendation |
|---|---|---|---|---|
| Medication structure | Folded into `careNote` free text | Deferred, P1, legal-gated (7C) | Yes | KEEP DEFERRED |
| Supported-person profile fields (DOB/condition/likes) | Not built | Deferred, P2, legal-gated (7K) | Yes | KEEP DEFERRED |
| Contact import | Manual entry only | Deferred, P2 (7H) | Yes | KEEP DEFERRED |
| Collaboration notifications | Not built (reminders are personal-only) | Deferred, P2, depends on Recent Activity (7J) | Partially addressed - Recent Activity (its own dependency) now exists, but the notification layer itself was never built | RECONSIDER BEFORE RELEASE (the dependency this item was blocked on is now satisfied) |
| Contextual record comments | Not built | Deferred, P2, scope-risk flagged (7G) | Yes | KEEP DEFERRED |
| Calendar `.ics` export feed | Not built | Deferred, P2 (7E) | Yes | KEEP DEFERRED |
| Former-member visibility / cross-list member filtering | Data exists (Phase 18B), not surfaced | Deferred, P2 (7L) | Yes | KEEP DEFERRED |
| Export narrative/handover summary | `export_my_data()` is technically complete, not narrative | Deferred, P2, depends on 7A/7D (7N) | Partially addressed - Care Summary now exists and could plausibly serve much of this need already | RECONSIDER - Care Summary may have already substantially closed this gap; worth a product-owner look before committing new engineering effort |
| Contingency/emergency summary (7D) | Not built as its own concept | Deferred, P1 (7D) | Partially addressed - Care Summary is the nearest analogue, though not purpose-built as an emergency/contingency view | RECONSIDER - confirm whether Care Summary already satisfies the underlying need, or whether a distinct emergency framing is still wanted |
| Full global search index | Scoped Search (Phase 20B) already implemented as the smaller alternative | Deferred, P3 | No longer urgent - the smaller version shipped and appears adequate | NO LONGER A GAP (for now) |
| Documents collection/browsing destination | No collection screen exists at all | **Not raised as a distinct item in Phase 20A** (that audit assessed document search/grouping, not a browsable collection screen) | Yes - newly identified by this navigation-focused audit | RECONSIDER BEFORE RELEASE (new finding, see section 21 item 1) |

---

## 23. Recommended implementation set

### Option 1 - MINIMAL
Add exactly two rows (Care Summary, Recent Activity) directly into the existing drawer list, with no new section heading - just two more rows alongside Account/Care Circle/Privacy & data/Subscription.
- **Benefit**: smallest possible change; closes the two clearest discoverability gaps.
- **Disadvantage**: without a visual/label separation, a new user cannot tell Care Summary/Recent Activity are about Maggie specifically while Account/Subscription are about them - reintroduces exactly the account-vs-care-space ambiguity brief section 27 warns against.
- **Regression risk**: LOW.

### Option 2 - RECOMMENDED
Exactly the structure in section 14 - a new, clearly-labelled `"[Name]'s care"` section (Care Summary, Recent Activity) above the existing, unchanged Account group.
- **Benefit**: closes both discoverability gaps found; correctly separates person-scoped from account-scoped, per the brief's own explicit requirement; drawer length stays well short of feeling overwhelming (2 new rows); reuses every existing screen/callback unchanged - no new screen, no new RPC, no schema change.
- **Disadvantage**: two routes now exist to the same two destinations (People and Settings) - a real but low-cost redundancy, already proven acceptable in this exact app by Care Circle's own existing dual-route pattern.
- **Regression risk**: LOW (purely additive; no existing row, screen, or callback is changed or removed).

### Option 3 - MAXIMUM
Everything in Option 2, plus: build a new Documents collection screen and add it to the "[Name]'s care" section; add Key Contacts as a duplicate drawer row; add a "Home"/"Calendar"/"To Do" quick-jump section for symmetry with the four-tab structure.
- **Benefit**: closest to full menu-style completeness; would make the drawer alone answer nearly every "where would I find...?" question without ever needing to explore People.
- **Disadvantage**: requires building a genuinely new screen (Documents) - out of this audit's own authorised scope and Phase 20A's approved set; duplicates already-well-discoverable destinations (Key Contacts, the primary tabs) for no proven benefit, actively risking exactly the "module-heavy" drawer the brief explicitly warns against (section 23) and undoing the very simplicity the product owner named as a Lilica strength (section 30 of the brief: "the goal is not menu parity").
- **Regression risk**: MEDIUM (a new screen is new surface area to test/maintain; the duplicate rows risk drawer-density creep the brief explicitly cautions against).

### Recommendation: **Option 2.**
It resolves every genuine discoverability finding this audit made (Care Summary, Recent Activity) without inventing new capability, without duplicating already-well-discoverable destinations, and without any regression risk to existing, protected, already-approved surfaces (Home/Calendar/To Do/People/Care Circle/Search/Subscription all remain completely untouched). Documents (Option 3's own new-screen component) is correctly separated out as its own, later, explicitly product-owner-decided question (section 21 item 1) rather than bundled into a navigation fix it does not actually belong to.

---

## 24. Regression-risk assessment

Option 2 touches exactly one file conceptually (`SettingsMenu.tsx`, to add a new section/rows and two new required callback props for Care Summary/Recent Activity, mirroring the existing `onOpenCareCircle?`/`onOpenSubscription` pattern already in place) and `App.tsx` (to wire those two new callbacks to the exact same `setShowCareSummary(true)`/`setShowRecentActivity(true)` state already used by People's own existing links - no new state, no new screen, no new RPC). Every existing test covering `SettingsMenu`'s current rows, People's existing Care Summary/Recent Activity links, and the Care Circle drawer/People dual-route pattern should continue to pass unchanged, since none of their own props or behaviour would be modified - only additive. This is a genuinely LOW-risk change relative to the other phases completed this session (Phase 21B/21C, search4), which touched materially more surface area.

## 25. Phase 22 implications

**Phase 22A's own visual audit (`docs/PHASE_22_VISUAL_AUDIT.md`, drafted immediately before this task and explicitly paused to run this one) should not be finalised for the Settings drawer specifically until this Phase 20C navigation decision is resolved** - polishing the *visual* treatment of a drawer whose *row structure* is about to change would mean redoing that work once new rows are added. Every OTHER surface Phase 22A already audited (Home, Calendar, To Do, People, Search, Care Circle, Account/Privacy, Subscription) is unaffected by this navigation question and Phase 22A's own findings for those surfaces remain valid as written. Concretely: Phase 22B implementation should sequence Phase 20C's own approved navigation change (if approved) before or alongside any Settings-drawer visual work, not after it.

---

## Documentation status

This document states: **Phase 20 (capability parity) complete and unchanged; Phase 20C (navigation/discoverability reconciliation) is a subsequent audit, not a correction of Phase 20's own decisions.** No navigation change has been implemented. No recommendation in this report is approved - approval is GPT's and the product owner's decision.

## Validation (documentation-only, at the time this audit was written)

- Application code (`.ts`/`.tsx`) unchanged: confirmed via `git status --short` - no tracked application file modified by this task.
- `SettingsMenu.tsx`, navigation, Home, Calendar, To Do, People, Search, Care Summary, Recent Activity, Add: all unmodified, confirmed.
- Database/migrations/dependencies unchanged: confirmed - no `supabase/` file touched, no `package.json`/`package-lock.json` change.
- `git diff --check`: clean.

---

## 26. Implementation status addendum (`prephase22.txt`, Part A - IMPLEMENTED)

**Option 2 (section 23) was implemented exactly as recommended, with one correction made afterward following direct product-owner testing.**

### 26.1 What was built

- `SettingsMenu.tsx`: the `Section` type gained `'careSummary' | 'recentActivity'`; new optional props `personName`, `onOpenCareSummary`, `onOpenRecentActivity` render a `personCareEntries` group (label `"[Name]'s care"`, falling back to `"This care space"` when no name is available) directly above the existing, renamed `accountEntries` group (`"Account"`), exactly matching section 14's proposed information architecture. Both new rows are omitted entirely (no row, no heading) when both callbacks are undefined - the same "no fabricated destination" guard already used for the local-only case, per section 15.
- `App.tsx`: the drawer's `onOpenCareSummary`/`onOpenRecentActivity` are wired to `setSettingsSection('careSummary' | 'recentActivity')`.

### 26.2 Correction after physical testing: in-drawer rendering, not an overlay-return flag

Section 24's own regression-risk assessment assumed Care Summary/Recent Activity would keep opening as App.tsx's existing full-screen overlays (`showCareSummary`/`showRecentActivity`), with only the drawer gaining a second route in. The first implementation attempt followed that assumption, plus a `careOverlayOpenedFromSettings` flag so the overlay's own Back button would reopen the drawer instead of returning to People.

**Direct product-owner testing found this wrong**: "care summary and recent activity menu items appear to be opening whole new pages instead of remaining in the menu." The flag fixed the wrong layer - it corrected where Back went, not the fact that a drawer row was breaking out into a separate full-screen navigation layer at all, which is not how any other drawer row (Account, Care Circle, Privacy & data) behaves.

**Corrected, final architecture**: `App.tsx`'s `SettingsMenu` children switch gained two branches - `settingsSection === 'careSummary'` and `settingsSection === 'recentActivity'` - rendering the existing `CareSummaryScreen`/`RecentActivityScreen` components **in-drawer**, with `onBack={() => setSettingsSection('menu')}`, architecturally identical to how Account/Care Circle/Privacy & data already render. This needed **no new state at all** - the `careOverlayOpenedFromSettings` flag and its `closeCareOverlay()` helper were fully removed. People's own separate Care Summary/Recent Activity links are entirely unaffected and continue to use the original full-screen overlay state (`showCareSummary`/`showRecentActivity`) unchanged, per section 21 item 2's own "both routes coexist" recommendation - only the *drawer's* route was ever wrong.

### 26.3 Tests

- `tests/settings-drawer-person-care.test.tsx` - `SettingsMenu`'s own new group (dynamic label, both rows, omitted-when-unavailable, Account group unaffected).
- `tests/settings-drawer-care-screens-in-drawer.test.tsx` (added after the correction above) - proves, via the same harness pattern `tests/settings-navigation.test.tsx` already established for Account/Care Circle/Privacy & data, that Care Summary/Recent Activity render **in-drawer**: the underlying tab/person route never changes, the drawer's own row list is replaced (not stacked on top of) by the section body, Back returns to the drawer root, and a full round trip through both sections then Close restores the original route exactly - direct regression coverage for the reported bug.

### 26.4 Deviation from this document's own regression-risk assessment

Section 24 stated the change would touch "exactly one file conceptually" (`SettingsMenu.tsx`) plus `App.tsx` wiring to existing overlay state. The corrected implementation instead added two new `settingsSection` branches in `App.tsx` and removed the overlay-flag detour entirely - still no new screen, no new RPC, no schema change, and still LOW regression risk (verified: 658/658 Jest tests pass, `npm run typecheck` clean), but the exact mechanism differs from what section 24 anticipated. Recorded here rather than silently editing section 24, per this project's standing documentation practice of preserving what was actually decided and why a later correction was needed.

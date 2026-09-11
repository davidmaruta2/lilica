# Corrective Task 10 Physical-Device QA — People Tab

Status: implementation complete, automated tests passing; physical-device QA not yet run.

People is a projection of the same records Home/Calendar/To Do already read, plus the real care-circle membership list Phase 15 already produces. There is no separate data store to verify.

## Setup

Use an account with at least one supported person who has: a Key contact (e.g. GP surgery), plus (to confirm they no longer appear here) a bill, a home matter, a document and a care note. Ideally a synced (non-local-only) care space with at least one other real Care Circle member (Phase 15), and a second supported person to test switching.

## Checks

1. **Open People** — tap the tab labelled "People". It opens without delay or a blank flash.
2. **Correct selected person** — "People you support" shows the currently active person's name (or "You" for self-care).
3. **Switch person** — tap the person card, choose someone else via the existing switcher. Key contacts and Care circle refresh to the new person/space; nothing from the previous one remains visible.
4. **Key contacts** — a saved contact (e.g. GP surgery) appears under "Key contacts" with its role/phone.
5. **No record-category duplication** — bills, home/car matters, documents and care notes do **not** appear anywhere on People, even though they're saved for this person. Confirm they still appear correctly on Home (its "Recently added" section) and, where actionable, Calendar/To Do.
6. **Care circle — real members** — for a synced care space with other members, each shows as "Name — Role" (Organiser/Contributor/Viewer) with their real relationship label, never a placeholder.
7. **Care circle — honest empty state** — for a local-only care space (or one with no other members), Care circle shows only "You — The only person with access right now," never a fabricated second member.
8. **External contact never becomes a member** — a Key contact (e.g. "GP surgery") never appears in the Care circle section, and a Care circle member is never shown as a Key contact.
9. **Manage** — tapping "Manage" in the Care circle section opens the existing Care Circle management screen.
10. **Ask Lilica moved** — the "Ask Lilica" placeholder appears on People, and no longer appears on Home.
11. **Open an existing Key contact** — tap a row. The normal record editor opens, pre-filled with its real details.
12. **Add a Key contact** — tap "Add" next to Key contacts. It opens a new draft in the normal category editor, not a separate form.
13. **Settings** — tap the Settings cog. The shared Settings sheet opens (Account, and Care Circle when available), exactly as on Home/Calendar/To Do.
14. **Offline** — turn off network connectivity. People still shows cached Key contacts (Care circle membership, being server-sourced, may show its last-fetched state rather than live).
15. **Long names** — a long display name or contact title doesn't break the layout.
16. **Small Android layout / iPhone layout / bottom-nav/safe-area behaviour** — People fits and scrolls correctly at both common screen sizes, and the tab bar never covers or is covered by its content.

## Known limitations (by design, not defects)

- Care circle membership is read from the same list Settings' own Care Circle screen uses; it is not re-fetched by People itself, so a very recent change made elsewhere may need a Care Circle open/refresh to appear.
- Ask Lilica is still a non-functional placeholder — no AI functionality was implemented by this task.
- No per-record "added by" attribution exists yet for Key contacts.

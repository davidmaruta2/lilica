# Self/Someone-Else Onboarding Fork — Physical-Device QA

Use a fresh development account in `lilica-development`. Test on the target Android phone and a modern iPhone-sized device, per the project's usual physical-device requirement — automated tests do not prove device rendering.

1. Fresh account → complete `About you` → confirm the new `Whose wellbeing are you looking to support with Lilica?` screen appears, with Myself and Someone else as two clear tiles.
2. Fresh account → **Myself** → confirm the display name shown/confirmed is the organiser's own `About you` name, not re-typed → complete privacy/interests/first record → Home shows that name naturally (e.g. "Everything for [organiser name], in one place.").
3. Fresh account → **Someone else** → confirm the existing relationship wheel, name entry, review and multi-person flow behave exactly as before this change.
4. **Myself** → complete → from Home, add another person → confirm `Myself` no longer appears in the relationship wheel (already represented) and the rest of the wheel is unaffected.
5. **Someone else** (e.g. Mum) → complete → add another person → confirm `Myself` is offered in the wheel and can be chosen once.
6. Switch between a Myself care space and another supported person via the person switcher; confirm records, interests and privacy state stay correctly isolated per space (no crossover).
7. Force-close and reopen mid-fork (after tapping Myself, before finishing privacy/interests) → confirm resume lands back in the correct place without creating a duplicate care space.
8. Sign out during incomplete Myself setup, then sign back in → confirm resume behaves the same as any other incomplete person today.
9. Back navigation: from the relationship wheel back to the fork screen, and from the fork screen back to `About you` — confirm no dead end or lost selection.
10. Long organiser display name and long custom relationship labels elsewhere in the same session — confirm no layout breakage in the fork screen or the wheel.
11. Narrow-screen layout and keyboard-open behaviour are not expected to be exercised by this screen itself (it has no text input), but confirm the two-tile layout does not clip or overlap at a small phone width.

Record device/build/results alongside each case when executed. This checklist is new and has not yet been run by the product owner.

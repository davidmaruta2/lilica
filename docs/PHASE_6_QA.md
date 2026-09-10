# Phase 6 Physical-Device QA

Use a development account in `lilica-development`. Test on the target Android phone and a modern iPhone-sized device.

- Create Mum + Dad, enter two names, review both, and choose either person first.
- Add Child twice through `+ Add another person`; confirm both children remain distinct after naming.
- Confirm Other relative requires a relationship such as Aunt.
- Confirm Someone else requires context such as Neighbour.
- In review, rename one draft, edit its custom relationship, remove another draft, and add it again.
- Complete privacy, interests and at least one record for the chosen person; confirm Home names that person.
- Switch to an incomplete person; confirm `Continue setup` resumes that person's setup only.
- Give two people different interests and records; switch repeatedly and confirm nothing crosses between Homes.
- From the Home switcher, add another person; verify `Set up now` and `Set up later` both preserve the person.
- Force-close/relaunch during names and after provisioning; confirm progress resumes without duplicate people.
- Sign out and back into the same account; confirm the roster and local care-space data remain.
- Upgrade an existing completed single-person account; confirm it is not re-onboarded and all records/attachments remain.
- Check the relationship wheel, review rows, chooser, switcher and incomplete-state card for clipping, keyboard obstruction and safe-area overlap on Android and iPhone.
- Confirm every name/custom-relationship field scrolls above the keyboard and its Continue CTA on both Android and iOS, including a short-height viewport.

Cloud records and cross-device record restoration are not expected in Phase 6.

Run Phase 5 signup/recovery/keyboard acceptance first. Phase 7 must not start until these device checks and this multi-person checklist are recorded and approved.

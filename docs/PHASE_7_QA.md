# Phase 7 Physical-Device QA

Status: Passed and approved by the product owner on physical Android and iOS devices, 10 September 2026

Result: The product owner completed the Phase 7 physical-device checklist below and confirmed that the tested upgrade/migration, online, multi-device, offline/retry, responsibility, attachment and platform-regression behaviour passed. No Phase 7 physical-device failure remains open.

Use only development accounts and `lilica-development`. Test on a physical Android phone and a physical iPhone. Keep a note of device model, OS, build/Expo Go version, account, date and result. Do not use production data.

## Upgrade And Migration

- Before upgrading, create records in at least two care spaces, including responsibility text and a document with a local attachment.
- Upgrade/relaunch and confirm every record remains under the correct person with unchanged title, dates, status, responsibility text and attachment reference.
- Force-close during first synchronisation, relaunch, and confirm migration resumes with no duplicate record.
- Relaunch again after completion and confirm migration does not repeat.

## Online And Multi-Device

- Create a record online; force-close/relaunch and confirm it remains.
- Sign in to the same development account on a second device and confirm the care space and cloud record can be obtained once that device's local setup gates are completed.
- Edit on device A, foreground device B, and confirm the authorised change reconciles.
- Confirm no record appears under another supported person while switching repeatedly.

## Offline And Retry

- Disconnect networking, create a record, and confirm it appears locally.
- Force-close/relaunch while still offline; confirm the record remains visible.
- Reconnect and confirm exactly one cloud-backed record remains after repeated foreground/relaunch cycles.
- Edit a synced record offline, relaunch, reconnect, and confirm the edit synchronises without duplication.
- Queue work for one person, switch to another before reconnecting, and confirm the mutation remains under its original care space.
- Sign out with queued work and confirm no upload occurs while signed out; sign back in and confirm authorised retry resumes.

## Responsibility And Attachments

- Confirm an existing value such as `Sarah` is displayed unchanged after migration.
- Confirm no UI treats that text as a member, account, permission, invitation or assignment.
- Confirm an existing local attachment still appears and opens on its originating device wherever opening was previously supported.
- Confirm no cloud-upload, sharing or OCR behavior appears.

## Platform Regression

- Repeat core upgrade, online create, offline create/restart/reconnect, edit, sign-out/sign-in and person-switching checks on Android and iPhone.
- Confirm startup can show cached records without waiting indefinitely for a remote fetch.
- Confirm Welcome/authentication, verification/recovery, safe areas, keyboard handling, record sheets, date/time wheels and Home composition have no obvious regression.

Phase 7 physical-device QA is approved. Phase 8 was not started as part of QA or close-out and still requires its own explicit authorisation.

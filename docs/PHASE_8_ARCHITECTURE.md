# Phase 8 Core Record And Occurrence Architecture

Status: Implemented and automatically validated locally and in `lilica-development`; physical-device QA pending
Date: 10 September 2026

## Boundary

Phase 8 introduces the canonical `Record -> Occurrence` layer beneath the existing UI. Phase 7 records retain their IDs, care-space ownership, attachment manifests, responsibility text and cache/outbox protocol. Phase 8 does not redesign Home or onboarding and does not implement Calendar, To Do, assignment controls, collaboration, invitations, notifications or cloud attachment bytes.

## Record And Occurrence

A Record is the durable thing Lilica knows. An Occurrence is one dated expectation belonging to exactly one record and care space. Existing appointment, task, bill, dated home/car and expiring-document records map deterministically to sequence zero. Undated or malformed records remain records without fabricated dates.

Occurrence UUIDs derive deterministically from the stable Phase 7 cloud record UUID and sequence. The same algorithm runs in TypeScript and PostgreSQL. A record retry, migration retry or response-lost retry therefore converges on one row. Composite foreign keys prevent cross-space relinking.

## Time And Lifecycle

The schema distinguishes date-only obligations, local date/time appointments and true instants. Current appointment input persists its wall date/time with `Europe/London`; no guessed UTC conversion occurs. Stored lifecycle values are open, scheduled, awaiting confirmation, completed, cancelled and missed. Due/overdue and `past_awaiting_outcome` are derived states. A passed scheduled appointment remains scheduled in storage and is never inferred to be completed, missed or overdue.

Completing, cancelling, reopening or rescheduling an occurrence uses `apply_occurrence_mutation(...)` with active-membership checks, base version and an operation receipt. The previous row is copied to `occurrence_versions` before any update, preserving what was expected at that point in time.

## Recurrence

Recurring records own one stable series and immutable rule versions. Weekly, monthly and yearly generation uses the original calendar anchor, including month ends and leap years. Explicit completion creates the next occurrence in the same server transaction. Its UUID and `(record_id, sequence)` key make retry idempotent. The domain contract supports one, this-and-future and entire-series edit planning without rewriting terminal history. No recurrence management UI is added in this phase.

## Phase 7 Integration And Migration

`recordSync.ts` remains the single cache/outbox/synchronisation engine. Local record create/edit/delete immediately updates its deterministic occurrence projection. The same authenticated sync pass pulls authorised server occurrences using a per-space cursor; unresolved record mutations block the corresponding remote occurrence so stale server state cannot replace an offline edit. Cache upgrade derives missing occurrence arrays from existing identity mappings.

The SQL migration creates schema first, installs the record trigger, then scans existing records through the same idempotent mapper used for future writes. Missing evidence remains unknown. Attachment manifests and `legacy_responsibility_text` remain on the parent record unchanged. No name or email is converted into assignment identity.

## Assignment Foundation

`assignments` supports exactly one record or occurrence target and exactly one active membership or external-contact assignee. `care_space_membership.id` or `care_space_contact.id` is identity; `display_name_snapshot` is historical display only. `create_assignment(...)` validates target and assignee care-space membership and provides operation idempotency. External contacts have no Auth identity or application access.

Assignment rows are absent from all record and occurrence RLS predicates. Assignment never grants visibility, and visibility never creates assignment. The current free-text UI remains legacy descriptive input until Phase 9.

## Security And Conflicts

All new tables have forced RLS. Authenticated clients receive organiser-scoped reads only; direct writes are denied. Security-definer mutation functions validate authentication, active membership, care-space target, immutable identity and optimistic base version. Stale or incompatible changes return conflict rather than using blanket last-write-wins.

## Current Limitations

- Existing UI actions continue through parent-record operations; no direct occurrence or assignment editor is exposed.
- Assignment acceptance/decline/removal workflows and assignment cache/outbox support are deferred with their UI phases.
- Recurrence edit scopes are domain-contract behavior; no rule-edit RPC or UI is exposed yet.
- Realtime, Calendar, To Do, linked actions, notifications and collaboration remain later phases.
- Attachment bytes remain device-local and unavailable on a second device.

See `docs/PHASE_8_QA.md` for physical checks.

## Deployment Verification

The linked dry run listed only `20260910170000_phase8_occurrence_engine.sql`, with no seed or role changes. That migration was then applied only to `lilica-development`. Local and linked histories match through `20260910170000`; both database suites pass all 152 assertions and both warning-level schema lints are clean.

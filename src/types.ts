export type OnboardingStage =
  | 'welcome'
  | 'how'
  | 'auth'
  | 'emailAuth'
  | 'verifyEmail'
  | 'aboutYou'
  | 'recoveryRequest'
  | 'recoveryEmailSent'
  | 'recoveryCode'
  | 'recoveryPassword'
  | 'careFork'
  // Care Circle invitation & joining flow completion (`\downloads\carecircle.txt`,
  // 14 September 2026): the ONLY authorised onboarding change -- a small
  // routing fork shown BEFORE supported-person/care-space creation,
  // only for a genuine new user with no accessible care space and no
  // auto-surfaced invitation already handling their situation (see
  // App.tsx's initialPersonStage()). Every subsequent onboarding screen
  // for an ordinary organiser is completely unchanged.
  | 'joinOrSetup'
  | 'joinCareCircle'
  | 'relationship'
  | 'relationshipSummary'
  | 'name'
  | 'peopleReview'
  | 'chooseActivePerson'
  | 'privacyConsent'
  | 'interests'
  | 'firstThing'
  | 'itemForm'
  | 'home';

export type Relationship =
  | 'Myself'
  | 'Mum'
  | 'Dad'
  | 'Partner'
  | 'Child'
  | 'Grandparent'
  | 'Other relative'
  | 'Someone else';

export type SupportedPersonDraft = {
  draftId: string;
  relationshipType: Relationship;
  relationshipLabel?: string;
  displayName?: string;
  order: number;
};

export type MultiPersonOnboardingDraft = {
  version: 2;
  stage: 'relationships' | 'identity' | 'review' | 'choose_active' | 'person_setup';
  people: SupportedPersonDraft[];
  currentDraftId?: string;
  selectedSetupDraftId?: string;
  addingAfterOnboarding?: boolean;
};

export type FirstItemType = 'appointment' | 'task' | 'bill' | 'document' | 'careNote';

export type LilicaRecordType =
  | FirstItemType
  | 'homeMatter'
  | 'contact'
  | 'update'
  // Post-build implementation batch (lilbatch.txt, 17 September 2026):
  // structured Medical Log entries. 'careNote' already covers Care needs
  // (viewable/editable/attributable/persisted/permissioned exactly as
  // required -- reused rather than duplicated). Conditions and medicines
  // are genuinely new, since they need their own active/closed lifecycle
  // (see closedAt below), which no existing type has. Both map to the
  // 'health' domain -- see records.ts's recordDomainForType() and
  // supabase/migrations/20260917130000_medical_log.sql.
  | 'condition'
  | 'medicine';

export type RecordStatus = 'scheduled' | 'unresolved' | 'completed' | 'saved' | 'cancelled';

export type RecordRecurrence = {
  interval: number;
  unit: 'week' | 'month' | 'year';
};

export type RecordConfirmation = {
  status: 'completed' | 'confirmed';
  confirmedAt: string;
  confirmedBy?: string;
};

export type RecordAttachment = {
  id: string;
  kind: 'file' | 'scan';
  // Device-local sandbox URI. Present only on the device that captured or
  // most recently downloaded this file -- never assume another device can
  // use it (Phase 16: see docs/PHASE_16_ARCHITECTURE.md). A record pulled
  // fresh on a second device has attachment metadata but no local `uri`
  // until that device downloads its own copy via `src/attachments.ts`.
  uri?: string;
  name: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  createdAt: string;
  // Phase 16: cloud file-byte tracking, independent of the local `uri`
  // above. Undefined means "never uploaded" (including every attachment
  // that existed before Phase 16). `uploadStatus` only ever becomes
  // 'uploaded' once the byte transfer has genuinely completed.
  storageObjectPath?: string;
  uploadStatus?: 'pending' | 'uploaded' | 'failed';
};

export type AuthState = {
  method: 'apple' | 'google' | 'email' | 'local';
  email?: string;
  returning?: boolean;
};

export type FirstItem = {
  id: string;
  type: LilicaRecordType;
  title: string;
  supportedPersonId?: string;
  status?: RecordStatus;
  eventDate?: string;
  eventTime?: string;
  dueDate?: string;
  expiryDate?: string;
  date?: string;
  time?: string;
  location?: string;
  notes?: string;
  amount?: string;
  recurrence?: RecordRecurrence;
  responsiblePerson?: string;
  // Phase 9 stable-identity assignment: the active care-space membership ID
  // this record is assigned to, or undefined for explicitly Unassigned.
  // Never a display name/email - see docs/CORE_SYSTEM_CONTRACT.md section 8.
  // Distinct from the legacy `responsiblePerson` free text above, which is
  // preserved exactly and never inferred to be this assignment.
  assignedMembershipId?: string;
  // Phase 14: whether the user has opted in to local reminders for this
  // record. Never implies a reminder has actually fired, been seen, or
  // been acted on -- that is notification-delivery state, tracked only as
  // scheduled local device notifications, never written back onto the
  // record. See docs/PHASE_14_ARCHITECTURE.md section "Three-state
  // separation".
  remindersEnabled?: boolean;
  // Phase 14: bumped whenever the record's relevant date/time changes
  // while reminders are enabled, so previously scheduled local
  // notifications (keyed by this version) can be identified and cancelled
  // rather than left to fire with stale timing.
  reminderScheduleVersion?: number;
  provider?: string;
  reference?: string;
  role?: string;
  phone?: string;
  email?: string;
  completed?: boolean;
  completedAt?: string;
  confirmationHistory?: RecordConfirmation[];
  attachments?: RecordAttachment[];
  // Medical Log (lilbatch.txt, 17 September 2026). Diagnosed-condition-only:
  // when the diagnosis date is genuinely unknown, this stays undefined --
  // never fabricated (brief section 13, "unknown remains unknown").
  diagnosedDate?: string;
  // Medicine-only: whether this medicine repeats/is ongoing, or runs for a
  // specific duration. Undefined only ever means "not yet chosen" on an
  // in-progress draft -- save() always fills it in for type === 'medicine'.
  medicineSchedule?: 'repeat' | 'duration';
  // Medicine-only, and only meaningful when medicineSchedule === 'duration'.
  // A proper date field (DateTimeWheelField), never free text (brief
  // section 15).
  medicineEndDate?: string;
  // Condition/medicine only: undefined means ACTIVE; a timestamp means the
  // user has recorded it as CLOSED/resolved/no-longer-applicable. Closing
  // is never deletion -- the record (and this field) survive exactly like
  // any other historical record, and can be cleared again to reopen it.
  // See docs/CORE_SYSTEM_CONTRACT.md and RecordEditor.tsx's own handling.
  closedAt?: string;
  createdAt: string;
  updatedAt?: string;
};

export type LilicaRecord = FirstItem;

export type CareSpaceSetupStatus =
  | 'identity_only'
  | 'privacy_pending'
  | 'interests_pending'
  | 'records_pending'
  | 'ready';

export type LocalCareSpaceState = {
  careSpaceId: string;
  supportedPersonId: string;
  membershipId?: string;
  bootstrapId: string;
  relationshipType: Relationship;
  relationshipLabel?: string;
  displayName: string;
  // Remove-supported-person follow-up: this account's own role for this
  // specific care space, refreshed whenever reconnectCareSpaces() runs
  // (app startup, and after leaving a care space). Undefined until the
  // first reconnect resolves, or for a local-only (never-synced) space,
  // where this account is always its sole implicit organiser regardless.
  role?: 'organiser' | 'contributor' | 'viewer';
  // Phase 20D: ACTIVE (normal) or ARCHIVED (reversible, non-destructive --
  // hidden from the ordinary active-person switcher/navigation, ordinary
  // mutations rejected server-side, everything else preserved and
  // readable). Undefined for a local-only (never-synced) space, which has
  // no archive concept -- always treated as active.
  status?: 'active' | 'archived';
  privacyDeclarationAccepted: boolean;
  privacyDeclarationVersion?: string;
  privacyDeclarationAcceptedAt?: string;
  // Corrective task: temporary initial-setup orchestration only -- which
  // category setup gateways to offer during THIS care space's initial
  // setup journey ("What do you help X with?"). Keyed directly by the
  // canonical LilicaRecordType (no separate onboarding taxonomy) so it
  // can never drift out of sync with the real record categories. Has no
  // bearing on what the user can do once setupStatus reaches 'ready' --
  // see FirstThingScreen's `everyday` handling.
  interests: LilicaRecordType[];
  records: LilicaRecord[];
  setupStatus: CareSpaceSetupStatus;
  allSetDismissed: boolean;
};

export type OnboardingState = {
  migrationVersion: 2;
  stage: OnboardingStage;
  auth?: AuthState;
  relationship?: Relationship;
  supportedPersonName?: string;
  supportedPersonId?: string;
  interests: LilicaRecordType[];
  selectedFirstItemType?: FirstItemType;
  firstItem?: FirstItem;
  records: LilicaRecord[];
  privacyDeclarationAccepted: boolean;
  privacyDeclarationVersion?: string;
  privacyDeclarationAcceptedAt?: string;
  onboardingComplete: boolean;
  allSetDismissed: boolean;
  activeCareSpaceId?: string;
  careSpaces: Record<string, LocalCareSpaceState>;
  onboardingDraft?: MultiPersonOnboardingDraft;
};

export type AppTab = 'home' | 'calendar' | 'todo' | 'person';

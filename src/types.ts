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
  | 'update';

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
  // Never a display name/email — see docs/CORE_SYSTEM_CONTRACT.md section 8.
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

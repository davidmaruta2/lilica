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

export type Interest =
  | 'appointments'
  | 'homeBills'
  | 'tasks'
  | 'paperwork'
  | 'familyHelp'
  | 'careInfo';

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
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  createdAt: string;
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
  interests: Interest[];
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
  interests: Interest[];
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

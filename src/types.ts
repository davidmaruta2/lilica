export type OnboardingStage =
  | 'welcome'
  | 'how'
  | 'auth'
  | 'emailAuth'
  | 'relationship'
  | 'name'
  | 'privacyConsent'
  | 'interests'
  | 'firstThing'
  | 'itemForm'
  | 'home';

export type Relationship =
  | 'Mum'
  | 'Dad'
  | 'Partner'
  | 'Child'
  | 'Grandparent'
  | 'Other relative'
  | 'Someone else';

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

export type OnboardingState = {
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
};

export type AppTab = 'home' | 'calendar' | 'todo' | 'person';

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

export type AuthState = {
  method: 'apple' | 'google' | 'email' | 'local';
  email?: string;
  returning?: boolean;
};

export type FirstItem = {
  id: string;
  type: FirstItemType;
  title: string;
  date?: string;
  time?: string;
  location?: string;
  notes?: string;
  amount?: string;
  recurrence?: string;
  responsiblePerson?: string;
  createdAt: string;
};

export type OnboardingState = {
  stage: OnboardingStage;
  auth?: AuthState;
  relationship?: Relationship;
  supportedPersonName?: string;
  interests: Interest[];
  selectedFirstItemType?: FirstItemType;
  firstItem?: FirstItem;
  privacyDeclarationAccepted: boolean;
  privacyDeclarationVersion?: string;
  privacyDeclarationAcceptedAt?: string;
  onboardingComplete: boolean;
  allSetDismissed: boolean;
};

export type AppTab = 'home' | 'calendar' | 'todo' | 'person';

import { Fraunces_800ExtraBold, useFonts } from '@expo-google-fonts/fraunces';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { TabBar } from './src/components/TabBar';
import { AppText } from './src/components/Text';
import { AboutYouScreen } from './src/screens/AboutYouScreen';
import { AccountScreen, ProfileErrorScreen } from './src/screens/AccountScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { CareForkScreen } from './src/screens/CareForkScreen';
import { EmailAuthScreen } from './src/screens/EmailAuthScreen';
import { FirstThingScreen } from './src/screens/FirstThingScreen';
import { FoundationScreen } from './src/screens/FoundationScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { InterestsScreen } from './src/screens/InterestsScreen';
import { ItemFormScreen } from './src/screens/ItemFormScreen';
import { NameScreen } from './src/screens/NameScreen';
import { PeopleReviewScreen } from './src/screens/PeopleReviewScreen';
import { ChooseActivePersonScreen } from './src/screens/ChooseActivePersonScreen';
import {
  PrivacyConsentScreen,
  PRIVACY_DECLARATION_VERSION,
} from './src/screens/PrivacyConsentScreen';
import { RelationshipScreen } from './src/screens/RelationshipScreen';
import { RecoveryEmailSentScreen, RecoveryPasswordScreen, RecoveryRequestScreen } from './src/screens/RecoveryScreen';
import { RecoveryCodeScreen, VerificationScreen } from './src/screens/VerificationScreen';
import { PersonScreen } from './src/screens/PersonScreen';
import { CareCircleScreen } from './src/screens/CareCircleScreen';
import { ToDoScreen } from './src/screens/ToDoScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import {
  initialOnboardingState,
  loadOnboardingState,
  prepareOnboardingStateForStartup,
  saveOnboardingState,
} from './src/storage';
import { removeRecordById, upsertRecord } from './src/records';
import {
  activeCareSpace,
  createOnboardingDraft,
  createPersonDraft,
  integrateProvisionedPeople,
  integrateReconnectedCareSpaces,
  linkProvisionedCareSpaces,
  projectActiveCareSpace,
  replaceCareSpace,
  validatePersonDraft,
} from './src/careSpaceState';
import { provisionSupportedPeople, reconnectCareSpaces } from './src/careSpaces';
import { CareCircleInvitation, CareCircleMember, listCareSpaceInvitations, listCareSpaceMembers } from './src/careCircle';
import {
  enqueueRecordDelete,
  enqueueRecordUpsert,
  prepareRecordCache,
  recordRetryDelay,
  synchronizeRecords,
} from './src/recordSync';
import {
  addNotificationResponseListener,
  cancelRecordReminders,
  configureNotificationHandler,
  DEFAULT_NOTIFICATION_SETTINGS,
  disableAllReminders,
  getPermissionState,
  loadNotificationSettings,
  NotificationSettings,
  PermissionState,
  reconcileRecordReminders,
  requestPermission as requestNotificationPermission,
  saveNotificationSettings,
} from './src/notifications';
import { colors } from './src/theme';
import {
  AppTab,
  FirstItem,
  Interest,
  LilicaRecord,
  LilicaRecordType,
  OnboardingStage,
  OnboardingState,
  Relationship,
  SupportedPersonDraft,
} from './src/types';

const stageOrder: OnboardingStage[] = [
  'welcome',
  'auth',
  'emailAuth',
  'verifyEmail',
  'aboutYou',
  'careFork',
  'relationship',
  'relationshipSummary',
  'name',
  'peopleReview',
  'chooseActivePerson',
  'privacyConsent',
  'interests',
  'firstThing',
  'home',
];

// The "Whose wellbeing..." fork only ever governs the very first pass
// through person setup, never a later add-person pass: once any care space
// or in-progress draft exists, later additions go straight to the existing
// relationship wheel (startAddPerson() already does this unconditionally).
function initialPersonStage(state: OnboardingState): OnboardingStage {
  const hasStarted = Object.keys(state.careSpaces).length > 0 || (state.onboardingDraft?.people.length ?? 0) > 0;
  return hasStarted ? 'relationship' : 'careFork';
}

// Phase 14: a friendly "9pm"/"8am" label for the quiet-hours row.
function formatQuietHour(hour: number): string {
  const period = hour < 12 ? 'am' : 'pm';
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}${period}`;
}

function applyCachedRecords(state: OnboardingState, recordsBySpace: Record<string, LilicaRecord[]>) {
  let next = state;
  for (const [careSpaceId, records] of Object.entries(recordsBySpace)) {
    next = replaceCareSpace(next, careSpaceId, (space) => ({ ...space, records }));
  }
  return projectActiveCareSpace(next);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LilicaApp />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function LilicaApp() {
  const auth = useAuth();
  const [state, setState] = useState<OnboardingState>(initialOnboardingState);
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [localLoading, setLocalLoading] = useState(true);
  const [loadedStorageOwnerId, setLoadedStorageOwnerId] = useState<string | null>();
  const [saveError, setSaveError] = useState(false);
  const [authMode, setAuthMode] = useState<'create' | 'login'>('create');
  const [pendingEmail, setPendingEmail] = useState('');
  const [signOutError, setSignOutError] = useState<string>();
  const [signingOut, setSigningOut] = useState(false);
  const [addingRelationship, setAddingRelationship] = useState(false);
  const [pendingRelationship, setPendingRelationship] = useState<Relationship>();
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string>();
  // Phase 14: local-only reminder settings. remindersEnabled is the global
  // master switch, off until the user explicitly opts in from a real
  // reminder-value moment -- never requested at launch or during
  // onboarding. See docs/PHASE_14_ARCHITECTURE.md.
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [reminderPermissionState, setReminderPermissionState] = useState<PermissionState>('undetermined');
  // Phase 10: one-shot "open this record's editor" request from Calendar,
  // consumed and cleared by FirstThingScreen itself (see
  // onInitialOpenHandled) so a later, unrelated visit never reopens it.
  const [calendarOpenRecordId, setCalendarOpenRecordId] = useState<string>();
  // Phase 13: one-shot "open a NEW draft of this category" request from
  // Person's per-section Add links -- same consume/clear contract as
  // calendarOpenRecordId above; only one of the two is ever set at once.
  const [projectionOpenType, setProjectionOpenType] = useState<LilicaRecordType>();
  const [showAccount, setShowAccount] = useState(false);
  // Phase 15: the active care space's real members, for the record
  // editor's assignment selector and the Care Circle screen. Never
  // includes pending/declined/expired/revoked/removed/left memberships --
  // list_care_space_members() only returns active ones.
  const [careCircleMembers, setCareCircleMembers] = useState<CareCircleMember[]>([]);
  const [careCircleInvitations, setCareCircleInvitations] = useState<CareCircleInvitation[]>([]);
  const [showCareCircle, setShowCareCircle] = useState(false);
  const storageOwnerId = auth.session?.user.id ?? null;
  const legacyBootstrapInFlight = useRef(false);
  const reconnectedOwnerId = useRef<string | undefined>(undefined);
  const localRecordRevision = useRef(0);
  const recordRetryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeStorageOwnerId = useRef<string | null>(storageOwnerId);
  activeStorageOwnerId.current = storageOwnerId;
  const [fontsLoaded] = useFonts({
    Fraunces_800ExtraBold,
  });
  const currentSpace = activeCareSpace(state);
  const spaces = Object.values(state.careSpaces).sort((left, right) => left.displayName.localeCompare(right.displayName));

  // Phase 14: configure the notification handler once, and load whatever
  // reminder settings this device already has -- never requests OS
  // permission itself, only reads local preference state.
  useEffect(() => {
    configureNotificationHandler();
    loadNotificationSettings().then(setNotificationSettings).catch(() => undefined);
    getPermissionState().then(setReminderPermissionState).catch(() => undefined);
  }, []);

  // Refresh the displayed permission status whenever Account is opened --
  // the user may have changed it in device settings since last time.
  useEffect(() => {
    if (showAccount) getPermissionState().then(setReminderPermissionState).catch(() => undefined);
  }, [showAccount]);

  // Phase 15: reload the active care space's real membership/invitation
  // lists whenever the active space changes, and again whenever Care
  // Circle is opened (an invite/removal/role change may have just
  // happened). A local-only care space (never synced -- careSpaceId
  // starts with "local-") has no server membership list, so this is left
  // empty rather than queried.
  useEffect(() => {
    if (!currentSpace || currentSpace.careSpaceId.startsWith('local-')) {
      setCareCircleMembers([]);
      setCareCircleInvitations([]);
      return;
    }
    let cancelled = false;
    listCareSpaceMembers(currentSpace.careSpaceId).then((result) => {
      if (!cancelled && result.ok) setCareCircleMembers(result.data);
    });
    listCareSpaceInvitations(currentSpace.careSpaceId).then((result) => {
      if (!cancelled && result.ok) setCareCircleInvitations(result.data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSpace?.careSpaceId, showCareCircle]);

  function refreshCareCircle() {
    if (!currentSpace || currentSpace.careSpaceId.startsWith('local-')) return;
    listCareSpaceMembers(currentSpace.careSpaceId).then((result) => {
      if (result.ok) setCareCircleMembers(result.data);
    });
    listCareSpaceInvitations(currentSpace.careSpaceId).then((result) => {
      if (result.ok) setCareCircleInvitations(result.data);
    });
  }

  // Phase 14: a tapped notification must resolve its OWN referenced care
  // space, never trust the currently active one (brief section 17) -- a
  // notification for Maggie opened while Jackie is active must switch to
  // Maggie first. If that care space no longer exists locally (the only
  // form of "access revoked" possible in this single-device, pre-Phase-15
  // scope), the tap is safely ignored rather than opening the wrong
  // record or exposing stale content.
  useEffect(() => {
    const subscription = addNotificationResponseListener(({ recordId, careSpaceId }) => {
      setState((current) => {
        if (!current.careSpaces[careSpaceId]) return current;
        const next = careSpaceId === current.activeCareSpaceId ? current : projectActiveCareSpace({ ...current, activeCareSpaceId: careSpaceId });
        return next;
      });
      openRecordFromProjection(recordId);
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (auth.loading) return;

    let cancelled = false;
    setLocalLoading(true);
    loadOnboardingState(storageOwnerId ?? undefined)
      .then(async (loaded) => {
        if (cancelled) return;
        let prepared = prepareOnboardingStateForStartup(loaded, storageOwnerId ?? undefined);
        if (storageOwnerId) {
          try {
            const cached = await prepareRecordCache(storageOwnerId, Object.values(prepared.careSpaces));
            prepared = applyCachedRecords(prepared, cached);
          } catch {
            setSaveError(true);
          }
        }
        if (!cancelled) setState(prepared);
      })
      .catch(() => {
        if (cancelled) return;
        setSaveError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadedStorageOwnerId(storageOwnerId);
        setLocalLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [auth.loading, storageOwnerId]);

  useEffect(() => () => {
    if (recordRetryTimer.current) clearTimeout(recordRetryTimer.current);
  }, [storageOwnerId]);

  useEffect(() => {
    if (localLoading || loadedStorageOwnerId !== storageOwnerId || !auth.profile || !storageOwnerId) return;
    if (reconnectedOwnerId.current === storageOwnerId) return;
    reconnectedOwnerId.current = storageOwnerId;
    reconnectCareSpaces().then((result) => {
      if (result.ok) setState((current) => integrateReconnectedCareSpaces(current, result.people));
    });
  }, [auth.profile, loadedStorageOwnerId, localLoading, storageOwnerId]);

  useEffect(() => {
    if (localLoading || loadedStorageOwnerId !== storageOwnerId) return;

    saveOnboardingState(state, storageOwnerId ?? undefined).catch(() => {
      setSaveError(true);
    });
  }, [loadedStorageOwnerId, localLoading, state, storageOwnerId]);

  useEffect(() => {
    if (localLoading || loadedStorageOwnerId !== storageOwnerId || !auth.profile || legacyBootstrapInFlight.current) return;
    const unlinked = Object.values(state.careSpaces).filter((space) => !space.membershipId);
    if (unlinked.length === 0) return;

    legacyBootstrapInFlight.current = true;
    const drafts: SupportedPersonDraft[] = unlinked.map((space, order) => ({
      draftId: space.bootstrapId,
      relationshipType: space.relationshipType,
      relationshipLabel: space.relationshipLabel,
      displayName: space.displayName,
      order,
    }));
    provisionSupportedPeople(drafts)
      .then((result) => {
        if (result.ok) setState((current) => linkProvisionedCareSpaces(current, result.people));
      })
      .finally(() => {
        legacyBootstrapInFlight.current = false;
      });
  }, [auth.profile, loadedStorageOwnerId, localLoading, state.careSpaces, storageOwnerId]);

  const linkedCareSpaceIds = spaces
    .filter((space) => Boolean(space.membershipId) && !space.careSpaceId.startsWith('local-'))
    .map((space) => space.careSpaceId);
  const linkedCareSpaceSignature = linkedCareSpaceIds.join('|');

  useEffect(() => {
    if (localLoading || loadedStorageOwnerId !== storageOwnerId || !auth.profile || !storageOwnerId || !linkedCareSpaceSignature) return;
    let cancelled = false;
    const revision = localRecordRevision.current;
    const localSpaces = Object.values(state.careSpaces);
    prepareRecordCache(storageOwnerId, localSpaces)
      .then((cached) => {
        if (!cancelled && revision === localRecordRevision.current) setState((current) => applyCachedRecords(current, cached));
        scheduleRecordRetry(storageOwnerId, linkedCareSpaceIds);
        return synchronizeRecords(storageOwnerId, linkedCareSpaceIds);
      })
      .then((cached) => {
        if (!cancelled && revision === localRecordRevision.current) setState((current) => applyCachedRecords(current, cached));
      })
      .catch(() => {
        // Existing cached records remain usable; queued work will retry later.
      });
    return () => {
      cancelled = true;
    };
  }, [auth.profile, linkedCareSpaceSignature, loadedStorageOwnerId, localLoading, storageOwnerId]);

  useEffect(() => {
    if (!storageOwnerId || !linkedCareSpaceSignature) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      const revision = localRecordRevision.current;
      synchronizeRecords(storageOwnerId, linkedCareSpaceIds)
        .then((cached) => {
          if (revision === localRecordRevision.current) setState((current) => applyCachedRecords(current, cached));
          scheduleRecordRetry(storageOwnerId, linkedCareSpaceIds);
        })
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, [linkedCareSpaceSignature, storageOwnerId]);

  function syncAfterLocalMutation(operation: Promise<LilicaRecord[]>) {
    if (!storageOwnerId) return;
    const revision = localRecordRevision.current;
    operation
      .then(() => synchronizeRecords(storageOwnerId, linkedCareSpaceIds))
      .then((cached) => {
        if (revision === localRecordRevision.current) setState((current) => applyCachedRecords(current, cached));
        scheduleRecordRetry(storageOwnerId, linkedCareSpaceIds);
      })
      .catch(() => setSaveError(true));
  }

  function scheduleRecordRetry(ownerId: string, careSpaceIds: string[]) {
    recordRetryDelay(ownerId, careSpaceIds).then((delay) => {
      if (activeStorageOwnerId.current !== ownerId) return;
      if (recordRetryTimer.current) clearTimeout(recordRetryTimer.current);
      if (delay === undefined) {
        recordRetryTimer.current = undefined;
        return;
      }
      recordRetryTimer.current = setTimeout(() => {
        if (activeStorageOwnerId.current !== ownerId) return;
        const revision = localRecordRevision.current;
        synchronizeRecords(ownerId, careSpaceIds)
          .then((cached) => {
            if (revision === localRecordRevision.current) setState((current) => applyCachedRecords(current, cached));
          })
          .finally(() => scheduleRecordRetry(ownerId, careSpaceIds));
      }, Math.max(250, delay));
    }).catch(() => undefined);
  }

  function update(patch: Partial<OnboardingState>) {
    setSaveError(false);
    setState((current) => ({ ...current, ...patch }));
  }

  function go(stage: OnboardingStage) {
    update({ stage });
  }

  function goBack() {
    if (state.stage === 'itemForm') {
      go('firstThing');
      return;
    }

    const currentIndex = stageOrder.indexOf(state.stage);
    if (currentIndex > 0) {
      go(stageOrder[currentIndex - 1]);
    }
  }

  function toggleInterest(interest: Interest) {
    if (!currentSpace) return;
    setState((current) => projectActiveCareSpace(replaceCareSpace(current, currentSpace.careSpaceId, (space) => {
      const exists = space.interests.includes(interest);
      return { ...space, interests: exists ? space.interests.filter((item) => item !== interest) : [...space.interests, interest] };
    })));
  }

  function saveRecord(record: LilicaRecord) {
    if (!currentSpace) return;
    localRecordRevision.current += 1;
    const previousRecord = currentSpace.records.find((item) => item.id === record.id);
    const savedRecord = { ...record, supportedPersonId: currentSpace.supportedPersonId };
    setState((current) => projectActiveCareSpace(replaceCareSpace(current, currentSpace.careSpaceId, (space) => ({
      ...space,
      records: upsertRecord(space.records, savedRecord),
    }))));
    if (storageOwnerId && currentSpace.membershipId) {
      syncAfterLocalMutation(enqueueRecordUpsert(storageOwnerId, currentSpace.careSpaceId, savedRecord));
    }
    // Phase 14: reconcile pending local reminders against whatever just
    // changed -- covers a fresh save, a date/time edit, completion and
    // cancellation alike, since they all flow through this one path.
    void reconcileRecordReminders(
      savedRecord,
      previousRecord?.reminderScheduleVersion,
      currentSpace.careSpaceId,
      currentSpace.displayName,
      notificationSettings,
    );
  }

  function removeRecord(recordId: string) {
    if (!currentSpace) return;
    localRecordRevision.current += 1;
    const existing = currentSpace.records.find((item) => item.id === recordId);
    setState((current) => projectActiveCareSpace(replaceCareSpace(current, currentSpace.careSpaceId, (space) => ({
      ...space,
      records: removeRecordById(space.records, recordId),
    }))));
    if (storageOwnerId && currentSpace.membershipId) {
      syncAfterLocalMutation(enqueueRecordDelete(storageOwnerId, currentSpace.careSpaceId, recordId));
    }
    // Phase 14: deleting a record must suppress its pending reminders too.
    if (existing) void cancelRecordReminders(existing.id, existing.reminderScheduleVersion ?? 0);
  }

  async function requestReminderPermission(): Promise<boolean> {
    const permissionState = await requestNotificationPermission();
    setReminderPermissionState(permissionState);
    if (permissionState !== 'granted') return false;
    if (!notificationSettings.remindersEnabled) {
      const next = { ...notificationSettings, remindersEnabled: true };
      setNotificationSettings(next);
      void saveNotificationSettings(next);
    }
    return true;
  }

  function updateNotificationSettings(patch: Partial<NotificationSettings>) {
    setNotificationSettings((current) => {
      const next = { ...current, ...patch };
      void saveNotificationSettings(next);
      if (current.remindersEnabled && next.remindersEnabled === false) void disableAllReminders();
      return next;
    });
  }

  // The Account screen's master switch: turning it on is the same
  // explicit reminder-value moment as a record's own "Remind me" toggle
  // (brief section 13), so it goes through the same permission request.
  // Turning it off never needs permission, just disables everything.
  async function toggleGlobalReminders(nextEnabled: boolean) {
    if (nextEnabled) await requestReminderPermission();
    else updateNotificationSettings({ remindersEnabled: false });
  }

  function toggleQuietHours(nextEnabled: boolean) {
    updateNotificationSettings({ quietHoursEnabled: nextEnabled });
  }

  function completeOnboarding(firstItem?: FirstItem) {
    if (!currentSpace) return;
    if (firstItem) localRecordRevision.current += 1;
    const savedRecord = firstItem ? { ...firstItem, supportedPersonId: currentSpace.supportedPersonId } : undefined;
    setState((current) => projectActiveCareSpace(replaceCareSpace({ ...current, onboardingComplete: true, stage: 'home', onboardingDraft: undefined }, currentSpace.careSpaceId, (space) => ({
      ...space,
      records: savedRecord ? upsertRecord(space.records, savedRecord) : space.records,
      setupStatus: 'ready',
      allSetDismissed: false,
    }))));
    if (storageOwnerId && currentSpace.membershipId && savedRecord) {
      syncAfterLocalMutation(enqueueRecordUpsert(storageOwnerId, currentSpace.careSpaceId, savedRecord));
    }
    setActiveTab('home');
  }

  function setDraft(patch: Partial<NonNullable<OnboardingState['onboardingDraft']>>) {
    const draft = state.onboardingDraft ?? createOnboardingDraft(state.onboardingComplete);
    update({ onboardingDraft: { ...draft, ...patch } });
  }

  function selfAlreadyRepresented() {
    return Object.values(state.careSpaces).some((space) => space.relationshipType === 'Myself')
      || (state.onboardingDraft?.people.some((person) => person.relationshipType === 'Myself') ?? false);
  }

  function selectMyself() {
    // Feeds a pre-populated "Myself" draft through the exact same
    // relationshipSummary -> identity pass -> peopleReview pipeline a
    // manually chosen relationship would go through, so back navigation,
    // add-another and edit all reuse existing, already-tested behaviour
    // rather than needing a parallel fast path.
    const draft = createOnboardingDraft(state.onboardingComplete);
    const person: SupportedPersonDraft = {
      ...createPersonDraft('Myself', 0),
      displayName: auth.profile?.displayName?.trim() || '',
    };
    update({
      onboardingDraft: { ...draft, people: [person] },
      stage: 'relationshipSummary',
    });
  }

  function selectSomeoneElse() {
    go('relationship');
  }

  function toggleDraftRelationship(relationship: Relationship) {
    const draft = state.onboardingDraft ?? createOnboardingDraft(state.onboardingComplete);
    if (addingRelationship) {
      setPendingRelationship((current) => current === relationship ? undefined : relationship);
      return;
    }
    const existing = draft.people.find((person) => person.relationshipType === relationship);
    const people = existing
      ? draft.people.filter((person) => person.draftId !== existing.draftId)
      : [...draft.people, createPersonDraft(relationship, draft.people.length)];
    setDraft({ people });
  }

  function finishRelationshipSelection() {
    const draft = state.onboardingDraft ?? createOnboardingDraft(state.onboardingComplete);
    if (addingRelationship && pendingRelationship) {
      const person = createPersonDraft(pendingRelationship, draft.people.length);
      setAddingRelationship(false);
      setPendingRelationship(undefined);
      update({
        onboardingDraft: { ...draft, people: [...draft.people, person], currentDraftId: person.draftId },
        stage: draft.stage === 'review' ? 'name' : 'relationshipSummary',
      });
      return;
    }
    if (draft.people.length > 0) go('relationshipSummary');
  }

  function removeDraftPerson(draftId: string) {
    const draft = state.onboardingDraft;
    if (!draft) return;
    const people = draft.people.filter((item) => item.draftId !== draftId).map((item, order) => ({ ...item, order }));
    update({
      onboardingDraft: { ...draft, people, currentDraftId: draft.currentDraftId === draftId ? undefined : draft.currentDraftId },
      stage: people.length ? 'relationshipSummary' : 'relationship',
    });
  }

  function beginIdentityPass() {
    const draft = state.onboardingDraft ?? createOnboardingDraft(state.onboardingComplete);
    const next = draft.people.find((person) => !validatePersonDraft(person)) ?? draft.people[0];
    if (!next) return;
    update({ onboardingDraft: { ...draft, stage: 'identity', currentDraftId: next.draftId }, stage: 'name' });
  }

  function updateCurrentDraft(patch: Partial<SupportedPersonDraft>) {
    const draft = state.onboardingDraft;
    if (!draft?.currentDraftId) return;
    setDraft({ people: draft.people.map((person) => person.draftId === draft.currentDraftId ? { ...person, ...patch } : person) });
  }

  function advanceIdentity() {
    const draft = state.onboardingDraft;
    if (!draft?.currentDraftId) return;
    const index = draft.people.findIndex((person) => person.draftId === draft.currentDraftId);
    const next = draft.people.slice(index + 1).find((person) => !validatePersonDraft(person));
    if (next) setDraft({ currentDraftId: next.draftId });
    else update({ onboardingDraft: { ...draft, stage: 'review', currentDraftId: undefined }, stage: 'peopleReview' });
  }

  async function provisionRoster() {
    const draft = state.onboardingDraft;
    if (!draft || draft.people.length === 0 || !draft.people.every(validatePersonDraft) || provisioning) return;
    setProvisioning(true);
    setProvisionError(undefined);
    const result = await provisionSupportedPeople(draft.people);
    setProvisioning(false);
    if (!result.ok) {
      setProvisionError(result.message);
      return;
    }
    const integrated = integrateProvisionedPeople(state, draft.people, result.people);
    const selected = result.people[0]?.careSpaceId;
    setState({
      ...integrated,
      activeCareSpaceId: selected,
      onboardingDraft: {
        ...draft,
        stage: 'choose_active',
        selectedSetupDraftId: draft.addingAfterOnboarding ? draft.selectedSetupDraftId : draft.people[0]?.draftId,
      },
      stage: 'chooseActivePerson',
    });
  }

  function selectActiveSpace(careSpaceId: string) {
    setState((current) => projectActiveCareSpace({ ...current, activeCareSpaceId: careSpaceId }));
  }

  function startAddPerson() {
    const draft = createOnboardingDraft(true);
    draft.selectedSetupDraftId = currentSpace?.bootstrapId;
    setAddingRelationship(false);
    setPendingRelationship(undefined);
    update({ onboardingDraft: draft, stage: 'relationship' });
  }

  function continueActiveSetup() {
    if (!currentSpace) return;
    const stage = currentSpace.setupStatus === 'identity_only' || currentSpace.setupStatus === 'privacy_pending'
      ? 'privacyConsent'
      : currentSpace.setupStatus === 'interests_pending'
        ? 'interests'
        : 'firstThing';
    go(stage);
  }

  async function completeProfile(displayName: string) {
    const result = await auth.saveProfile(displayName);
    if (result.ok) {
      update({ stage: state.onboardingComplete ? 'home' : initialPersonStage(state) });
    }
    return result;
  }

  async function signOut() {
    setSigningOut(true);
    setSignOutError(undefined);
    const result = await auth.signOut();
    setSigningOut(false);
    if (!result.ok) setSignOutError(result.message);
    else setActiveTab('home');
  }

  // Shared by Calendar, To Do and Person: all open a tapped item through
  // the same established record editor, never a projection-specific one.
  function openRecordFromProjection(recordId: string) {
    setCalendarOpenRecordId(recordId);
    go('firstThing');
  }

  // Person's per-section Add links: jump straight into a NEW draft of that
  // category via the same established category/record creation
  // architecture -- never a separate "Add" form.
  function openNewFromProjection(type: LilicaRecordType) {
    setProjectionOpenType(type);
    go('firstThing');
  }

  function renderShell() {
    let content;

    if (activeTab === 'home') {
      content = (
        <HomeScreen
          state={state}
          people={spaces}
          activeCareSpaceId={state.activeCareSpaceId}
          setupStatus={currentSpace?.setupStatus}
          onSwitchPerson={selectActiveSpace}
          onAddPerson={startAddPerson}
          onContinueSetup={continueActiveSetup}
          onAddSomething={() => currentSpace?.setupStatus === 'ready' ? go('firstThing') : continueActiveSetup()}
          onDismissAllSet={() => {
            if (!currentSpace) return;
            setState((current) => projectActiveCareSpace(replaceCareSpace(current, currentSpace.careSpaceId, (space) => ({ ...space, allSetDismissed: true }))));
          }}
        />
      );
    } else if (activeTab === 'calendar') {
      content = currentSpace?.setupStatus === 'ready' ? (
        <CalendarScreen
          key={currentSpace.careSpaceId}
          records={state.records}
          personName={currentSpace?.displayName}
          onOpenRecord={openRecordFromProjection}
        />
      ) : (
        <FoundationScreen
          title="Calendar"
          body="Appointments, renewals and other dates will appear here."
        />
      );
    } else if (activeTab === 'todo') {
      content = currentSpace?.setupStatus === 'ready' ? (
        <ToDoScreen
          key={currentSpace.careSpaceId}
          records={state.records}
          personName={currentSpace?.displayName}
          activeMembershipId={currentSpace?.membershipId}
          onOpenRecord={openRecordFromProjection}
          onSaveRecord={saveRecord}
          onAddSomething={() => go('firstThing')}
        />
      ) : (
        <FoundationScreen
          title="To Do"
          body="Things to do will appear here as you add them."
        />
      );
    } else if (showCareCircle) {
      content = currentSpace ? (
        <CareCircleScreen
          personName={currentSpace.displayName}
          members={careCircleMembers}
          invitations={careCircleInvitations}
          careSpaceId={currentSpace.careSpaceId}
          onBack={() => setShowCareCircle(false)}
          onRefresh={refreshCareCircle}
        />
      ) : null;
    } else if (showAccount) {
      content = (
        <AccountScreen
          displayName={auth.profile?.displayName ?? 'Your profile'}
          email={auth.session?.user.email}
          signingOut={signingOut}
          error={signOutError}
          remindersEnabled={notificationSettings.remindersEnabled}
          reminderPermissionState={reminderPermissionState}
          quietHoursEnabled={notificationSettings.quietHoursEnabled}
          quietHoursLabel={`${formatQuietHour(notificationSettings.quietHours.startHour)}–${formatQuietHour(notificationSettings.quietHours.endHour)}`}
          onToggleReminders={(enabled) => void toggleGlobalReminders(enabled)}
          onToggleQuietHours={toggleQuietHours}
          onBack={() => setShowAccount(false)}
          onSignOut={() => void signOut()}
        />
      );
    } else {
      content = (
        <PersonScreen
          records={state.records}
          displayName={currentSpace?.displayName}
          relationshipLabel={currentSpace?.relationshipLabel || currentSpace?.relationshipType}
          isSelf={currentSpace?.relationshipType === 'Myself'}
          people={spaces}
          activeCareSpaceId={state.activeCareSpaceId}
          onSwitchPerson={selectActiveSpace}
          onAddPerson={startAddPerson}
          onOpenRecord={openRecordFromProjection}
          onAddType={openNewFromProjection}
          onOpenAccount={() => setShowAccount(true)}
          onOpenCareCircle={
            currentSpace && !currentSpace.careSpaceId.startsWith('local-') && currentSpace.membershipId
              ? () => setShowCareCircle(true)
              : undefined
          }
        />
      );
    }

    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.shell}>
        <View style={styles.shellContent}>{content}</View>
        <TabBar
          active={activeTab}
          personName={state.supportedPersonName}
          onChange={(tab) => {
            setActiveTab(tab);
            if (tab !== 'person') setShowAccount(false);
          }}
        />
      </SafeAreaView>
    );
  }

  function renderUnauthenticated() {
    const stage = ['welcome', 'how', 'auth', 'emailAuth', 'verifyEmail', 'recoveryRequest', 'recoveryEmailSent', 'recoveryCode'].includes(state.stage)
      ? state.stage
      : 'auth';

    switch (stage) {
      case 'welcome':
      case 'how':
        return (
          <WelcomeScreen
            onStart={() => go('auth')}
            onLogin={() => {
              setAuthMode('login');
              go('emailAuth');
            }}
          />
        );
      case 'auth':
        return (
          <AuthScreen
            onBack={goBack}
            onCreateAccount={() => {
              setAuthMode('create');
              go('emailAuth');
            }}
            onLogIn={() => {
              setAuthMode('login');
              go('emailAuth');
            }}
          />
        );
      case 'emailAuth':
        return (
          <EmailAuthScreen
            mode={authMode}
            initialEmail={pendingEmail || (state.auth?.method === 'email' ? state.auth.email : undefined)}
            onBack={goBack}
            onSubmit={authMode === 'create' ? auth.signUp : auth.signIn}
            onVerificationRequired={(email) => {
              setPendingEmail(email);
              update({ auth: { method: 'email', email }, stage: 'verifyEmail' });
            }}
            onAuthenticated={() => undefined}
            onForgotPassword={() => go('recoveryRequest')}
          />
        );
      case 'verifyEmail':
        return (
          <VerificationScreen
            email={pendingEmail || (state.auth?.method === 'email' ? state.auth.email ?? '' : '')}
            linkError={auth.linkError}
            onBack={() => go('emailAuth')}
            onResend={() => auth.resendVerification(pendingEmail || state.auth?.email || '')}
            onVerify={(code) => auth.verifySignUp(pendingEmail || state.auth?.email || '', code)}
          />
        );
      case 'recoveryRequest':
        return (
          <RecoveryRequestScreen
            onBack={() => go('emailAuth')}
            onRequest={auth.requestRecovery}
            onRequested={(email) => {
              setPendingEmail(email);
              update({ auth: { method: 'email', email, returning: true }, stage: 'recoveryEmailSent' });
            }}
          />
        );
      case 'recoveryEmailSent':
        return (
          <RecoveryEmailSentScreen
            email={pendingEmail || state.auth?.email || ''}
            onEnterCode={() => go('recoveryCode')}
          />
        );
      case 'recoveryCode':
        return (
          <RecoveryCodeScreen
            email={pendingEmail || state.auth?.email || ''}
            onBack={() => go('recoveryEmailSent')}
            onResend={() => auth.requestRecovery(pendingEmail || state.auth?.email || '')}
            onVerify={(code) => auth.verifyRecovery(pendingEmail || state.auth?.email || '', code)}
          />
        );
      default:
        return <AuthScreen onBack={() => go('welcome')} onCreateAccount={() => go('emailAuth')} onLogIn={() => { setAuthMode('login'); go('emailAuth'); }} />;
    }
  }

  function renderAuthenticatedOnboarding() {
    const stage = ['welcome', 'how', 'auth', 'emailAuth', 'verifyEmail', 'aboutYou', 'recoveryRequest', 'recoveryEmailSent', 'recoveryCode', 'recoveryPassword'].includes(state.stage)
      ? state.onboardingComplete ? 'home' : initialPersonStage(state)
      : state.stage;

    switch (stage) {
      case 'careFork':
        return (
          <CareForkScreen
            onBack={() => state.onboardingComplete ? go('home') : goBack()}
            onSelectMyself={selectMyself}
            onSelectSomeoneElse={selectSomeoneElse}
          />
        );
      case 'relationship':
        return (
          <RelationshipScreen
            people={state.onboardingDraft?.people ?? []}
            addingOne={addingRelationship}
            selected={pendingRelationship}
            selfAlreadyUsed={selfAlreadyRepresented()}
            onBack={() => state.onboardingComplete ? go('home') : goBack()}
            onToggle={toggleDraftRelationship}
            onDone={finishRelationshipSelection}
            onContinue={finishRelationshipSelection}
          />
        );
      case 'relationshipSummary':
        return (
          <RelationshipScreen
            people={state.onboardingDraft?.people ?? []}
            collapsed
            onBack={() => go('relationship')}
            onContinue={beginIdentityPass}
            onAddAnother={() => {
              setAddingRelationship(true);
              setPendingRelationship(undefined);
              go('relationship');
            }}
            onRemovePerson={removeDraftPerson}
          />
        );
      case 'name':
        const identityDraft = state.onboardingDraft;
        const person = identityDraft?.people.find((item) => item.draftId === identityDraft.currentDraftId);
        if (!identityDraft || !person) return <RelationshipScreen people={identityDraft?.people ?? []} collapsed onBack={() => go('relationship')} onContinue={beginIdentityPass} />;
        return (
          <NameScreen
            name={person.displayName}
            relationship={person.relationshipType}
            relationshipLabel={person.relationshipLabel}
            position={`${person.order + 1} of ${identityDraft.people.length}`}
            onBack={() => identityDraft.stage === 'review' ? go('peopleReview') : go('relationshipSummary')}
            onChangeName={(displayName) => updateCurrentDraft({ displayName })}
            onChangeRelationshipLabel={(relationshipLabel) => updateCurrentDraft({ relationshipLabel })}
            onContinue={advanceIdentity}
          />
        );
      case 'peopleReview':
        return (
          <PeopleReviewScreen
            people={state.onboardingDraft?.people ?? []}
            submitting={provisioning}
            error={provisionError}
            onBack={() => go('name')}
            onEdit={(draftId) => {
              const draft = state.onboardingDraft;
              if (!draft) return;
              update({ onboardingDraft: { ...draft, stage: 'review', currentDraftId: draftId }, stage: 'name' });
            }}
            onRemove={(draftId) => {
              const draft = state.onboardingDraft;
              if (!draft) return;
              const people = draft.people.filter((item) => item.draftId !== draftId).map((item, order) => ({ ...item, order }));
              update({ onboardingDraft: { ...draft, people }, stage: people.length ? 'peopleReview' : 'relationship' });
            }}
            onAdd={() => {
              const draft = state.onboardingDraft;
              if (!draft) return;
              setDraft({ stage: 'review' });
              setAddingRelationship(true);
              setPendingRelationship(undefined);
              go('relationship');
            }}
            onContinue={() => void provisionRoster()}
          />
        );
      case 'chooseActivePerson':
        const addingAfterOnboarding = state.onboardingDraft?.addingAfterOnboarding;
        return (
          <ChooseActivePersonScreen
            people={spaces}
            selectedId={state.activeCareSpaceId}
            onBack={() => go('peopleReview')}
            onSelect={selectActiveSpace}
            onContinue={() => {
              if (!currentSpace) return;
              setState((current) => projectActiveCareSpace(replaceCareSpace({ ...current, stage: 'privacyConsent' }, currentSpace.careSpaceId, (space) => ({ ...space, setupStatus: 'privacy_pending' }))));
            }}
            onLater={addingAfterOnboarding ? () => {
              const previousBootstrap = state.onboardingDraft?.selectedSetupDraftId;
              const previous = spaces.find((space) => space.bootstrapId === previousBootstrap);
              setState((current) => projectActiveCareSpace({ ...current, activeCareSpaceId: previous?.careSpaceId ?? current.activeCareSpaceId, onboardingDraft: undefined, stage: 'home' }));
            } : undefined}
          />
        );
      case 'privacyConsent':
        return (
          <PrivacyConsentScreen
            accepted={currentSpace?.privacyDeclarationAccepted ?? false}
            onBack={() => go('chooseActivePerson')}
            onToggleAccepted={() => {
              if (!currentSpace) return;
              setState((current) => projectActiveCareSpace(replaceCareSpace(current, currentSpace.careSpaceId, (space) => ({
                ...space,
                privacyDeclarationAccepted: !space.privacyDeclarationAccepted,
                privacyDeclarationVersion: !space.privacyDeclarationAccepted ? PRIVACY_DECLARATION_VERSION : undefined,
                privacyDeclarationAcceptedAt: !space.privacyDeclarationAccepted ? new Date().toISOString() : undefined,
              }))));
            }}
            onContinue={() => {
              if (!currentSpace) return;
              setState((current) => projectActiveCareSpace(replaceCareSpace({ ...current, stage: 'interests' }, currentSpace.careSpaceId, (space) => ({ ...space, setupStatus: 'interests_pending' }))));
            }}
          />
        );
      case 'interests':
        return (
          <InterestsScreen
            selected={currentSpace?.interests ?? []}
            personName={currentSpace?.displayName}
            isSelf={currentSpace?.relationshipType === 'Myself'}
            onBack={goBack}
            onToggle={toggleInterest}
            onContinue={() => {
              if (!currentSpace) return;
              setState((current) => projectActiveCareSpace(replaceCareSpace({ ...current, stage: 'firstThing' }, currentSpace.careSpaceId, (space) => ({ ...space, setupStatus: 'records_pending' }))));
            }}
            onSkip={() => {
              if (!currentSpace) return;
              setState((current) => projectActiveCareSpace(replaceCareSpace({ ...current, stage: 'firstThing' }, currentSpace.careSpaceId, (space) => ({ ...space, interests: [], setupStatus: 'records_pending' }))));
            }}
          />
        );
      case 'firstThing':
        return (
          <FirstThingScreen
            interests={currentSpace?.interests ?? []}
            personName={currentSpace?.displayName}
            supportedPersonId={currentSpace?.supportedPersonId ?? 'person-local'}
            records={currentSpace?.records ?? []}
            activeMembershipId={currentSpace?.membershipId}
            careCircleMembers={careCircleMembers}
            onRequestReminderPermission={requestReminderPermission}
            everyday={currentSpace?.setupStatus === 'ready'}
            initialOpenRecordId={calendarOpenRecordId}
            initialOpenType={projectionOpenType}
            onInitialOpenHandled={() => {
              setCalendarOpenRecordId(undefined);
              setProjectionOpenType(undefined);
            }}
            onBack={goBack}
            onSaveRecord={saveRecord}
            onRemoveRecord={removeRecord}
            onFinish={() => completeOnboarding()}
            onSkip={() => completeOnboarding()}
          />
        );
      case 'itemForm':
        return state.selectedFirstItemType ? (
          <ItemFormScreen
            type={state.selectedFirstItemType}
            personName={currentSpace?.displayName}
            onBack={goBack}
            onSave={completeOnboarding}
          />
        ) : (
          <FirstThingScreen
            interests={currentSpace?.interests ?? []}
            personName={currentSpace?.displayName}
            supportedPersonId={currentSpace?.supportedPersonId ?? 'person-local'}
            records={currentSpace?.records ?? []}
            activeMembershipId={currentSpace?.membershipId}
            careCircleMembers={careCircleMembers}
            onRequestReminderPermission={requestReminderPermission}
            everyday={currentSpace?.setupStatus === 'ready'}
            onBack={goBack}
            onSaveRecord={saveRecord}
            onRemoveRecord={removeRecord}
            onFinish={() => completeOnboarding()}
            onSkip={() => completeOnboarding()}
          />
        );
      case 'home':
        return renderShell();
      default:
        return renderShell();
    }
  }

  if (localLoading || loadedStorageOwnerId !== storageOwnerId || auth.loading || !fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <AppText variant="secondary" tone="soft" style={styles.loadingText}>
          Opening Lilica...
        </AppText>
      </View>
    );
  }

  let content;
  if (auth.recoveryMode) {
    content = <RecoveryPasswordScreen linkError={auth.linkError} onUpdate={auth.updatePassword} />;
  } else if (!auth.session) {
    content = renderUnauthenticated();
  } else if (auth.profileLoading) {
    content = (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <AppText variant="secondary" tone="soft" style={styles.loadingText}>Opening your profile...</AppText>
      </View>
    );
  } else if (auth.profileError) {
    content = (
      <ProfileErrorScreen
        message={auth.profileError}
        onRetry={() => void auth.retryProfile()}
        onSignOut={() => void signOut()}
      />
    );
  } else if (!auth.profile) {
    content = <AboutYouScreen onSave={completeProfile} />;
  } else {
    content = renderAuthenticatedOnboarding();
  }

  return (
      <View style={styles.app}>
        <StatusBar style={!auth.session && (state.stage === 'welcome' || state.stage === 'how') ? 'light' : 'dark'} />
        {saveError ? (
          <View style={styles.saveBanner}>
            <AppText variant="secondary" tone="white">
              Your progress could not be saved just now. You can keep going.
            </AppText>
          </View>
        ) : null}
        {content}
      </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  loadingText: {
    marginTop: 12,
  },
  saveBanner: {
    backgroundColor: colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  shell: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  shellContent: {
    flex: 1,
  },
});

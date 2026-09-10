import { Fraunces_800ExtraBold, useFonts } from '@expo-google-fonts/fraunces';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { TabBar } from './src/components/TabBar';
import { AppText } from './src/components/Text';
import { AboutYouScreen } from './src/screens/AboutYouScreen';
import { AccountScreen, ProfileErrorScreen } from './src/screens/AccountScreen';
import { AuthScreen } from './src/screens/AuthScreen';
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
  linkProvisionedCareSpaces,
  projectActiveCareSpace,
  replaceCareSpace,
  validatePersonDraft,
} from './src/careSpaceState';
import { provisionSupportedPeople } from './src/careSpaces';
import { colors } from './src/theme';
import {
  AppTab,
  FirstItem,
  Interest,
  LilicaRecord,
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
  const legacyBootstrapInFlight = useRef(false);
  const [fontsLoaded] = useFonts({
    Fraunces_800ExtraBold,
  });
  const storageOwnerId = auth.session?.user.id ?? null;
  const currentSpace = activeCareSpace(state);
  const spaces = Object.values(state.careSpaces).sort((left, right) => left.displayName.localeCompare(right.displayName));

  useEffect(() => {
    if (auth.loading) return;

    let cancelled = false;
    setLocalLoading(true);
    loadOnboardingState(storageOwnerId ?? undefined)
      .then((loaded) => {
        if (cancelled) return;
        setState(prepareOnboardingStateForStartup(loaded, storageOwnerId ?? undefined));
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
    setState((current) => projectActiveCareSpace(replaceCareSpace(current, currentSpace.careSpaceId, (space) => ({
      ...space,
      records: upsertRecord(space.records, { ...record, supportedPersonId: space.supportedPersonId }),
    }))));
  }

  function removeRecord(recordId: string) {
    if (!currentSpace) return;
    setState((current) => projectActiveCareSpace(replaceCareSpace(current, currentSpace.careSpaceId, (space) => ({
      ...space,
      records: removeRecordById(space.records, recordId),
    }))));
  }

  function completeOnboarding(firstItem?: FirstItem) {
    if (!currentSpace) return;
    setState((current) => projectActiveCareSpace(replaceCareSpace({ ...current, onboardingComplete: true, stage: 'home', onboardingDraft: undefined }, currentSpace.careSpaceId, (space) => ({
      ...space,
      records: firstItem ? upsertRecord(space.records, { ...firstItem, supportedPersonId: space.supportedPersonId }) : space.records,
      setupStatus: 'ready',
      allSetDismissed: false,
    }))));
    setActiveTab('home');
  }

  function setDraft(patch: Partial<NonNullable<OnboardingState['onboardingDraft']>>) {
    const draft = state.onboardingDraft ?? createOnboardingDraft(state.onboardingComplete);
    update({ onboardingDraft: { ...draft, ...patch } });
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
      update({ stage: state.onboardingComplete ? 'home' : 'relationship' });
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
      content = (
        <FoundationScreen
          title="Calendar"
          body="Appointments, renewals and other dates will appear here."
        />
      );
    } else if (activeTab === 'todo') {
      content = (
        <FoundationScreen
          title="To Do"
          body="Things to do will appear here as you add them."
        />
      );
    } else {
      content = (
        <AccountScreen
          supportedPersonName={currentSpace?.displayName}
          displayName={auth.profile?.displayName ?? 'Your profile'}
          email={auth.session?.user.email}
          signingOut={signingOut}
          error={signOutError}
          onSignOut={() => void signOut()}
        />
      );
    }

    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.shell}>
        <View style={styles.shellContent}>{content}</View>
        <TabBar
          active={activeTab}
          personName={state.supportedPersonName}
          onChange={setActiveTab}
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
      ? state.onboardingComplete ? 'home' : 'relationship'
      : state.stage;

    switch (stage) {
      case 'relationship':
        return (
          <RelationshipScreen
            people={state.onboardingDraft?.people ?? []}
            addingOne={addingRelationship}
            selected={pendingRelationship}
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

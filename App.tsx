import { Fraunces_800ExtraBold, useFonts } from '@expo-google-fonts/fraunces';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TabBar } from './src/components/TabBar';
import { AppText } from './src/components/Text';
import { AuthScreen } from './src/screens/AuthScreen';
import { EmailAuthScreen } from './src/screens/EmailAuthScreen';
import { FirstThingScreen } from './src/screens/FirstThingScreen';
import { FoundationScreen } from './src/screens/FoundationScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { InterestsScreen } from './src/screens/InterestsScreen';
import { ItemFormScreen } from './src/screens/ItemFormScreen';
import { NameScreen } from './src/screens/NameScreen';
import {
  PrivacyConsentScreen,
  PRIVACY_DECLARATION_VERSION,
} from './src/screens/PrivacyConsentScreen';
import { RelationshipScreen } from './src/screens/RelationshipScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import {
  initialOnboardingState,
  loadOnboardingState,
  saveOnboardingState,
} from './src/storage';
import { colors } from './src/theme';
import {
  AppTab,
  AuthState,
  FirstItem,
  Interest,
  LilicaRecord,
  OnboardingStage,
  OnboardingState,
  Relationship,
} from './src/types';

const stageOrder: OnboardingStage[] = [
  'welcome',
  'auth',
  'emailAuth',
  'relationship',
  'name',
  'privacyConsent',
  'interests',
  'firstThing',
  'home',
];

const stagesAfterPrivacy: OnboardingStage[] = ['interests', 'firstThing', 'itemForm', 'home'];

export default function App() {
  const [state, setState] = useState<OnboardingState>(initialOnboardingState);
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [fontsLoaded] = useFonts({
    Fraunces_800ExtraBold,
  });

  useEffect(() => {
    loadOnboardingState()
      .then((loaded) => {
        if (loaded.onboardingComplete) {
          setState({ ...loaded, stage: 'home' });
          return;
        }

        if (!loaded.privacyDeclarationAccepted && stagesAfterPrivacy.includes(loaded.stage)) {
          setState({ ...loaded, stage: 'privacyConsent' });
          return;
        }

        setState(loaded);
      })
      .catch(() => {
        setSaveError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;

    saveOnboardingState(state).catch(() => {
      setSaveError(true);
    });
  }, [loading, state]);

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

  function setAuth(auth: AuthState) {
    update({ auth, stage: 'relationship' });
  }

  function continueWithEmail(email: string) {
    update({ auth: { method: 'email', email: email.trim() }, stage: 'relationship' });
  }

  function setRelationship(relationship: Relationship) {
    update({ relationship });
  }

  function toggleInterest(interest: Interest) {
    const exists = state.interests.includes(interest);
    update({
      interests: exists
        ? state.interests.filter((item) => item !== interest)
        : [...state.interests, interest],
    });
  }

  function saveRecord(record: LilicaRecord) {
    const records = state.records.some((item) => item.id === record.id)
      ? state.records.map((item) => item.id === record.id ? record : item)
      : [...state.records, record];

    update({
      supportedPersonId: state.supportedPersonId ?? record.supportedPersonId,
      records,
      firstItem: state.firstItem?.id === record.id ? record : state.firstItem ?? records[0],
    });
  }

  function completeOnboarding(firstItem?: FirstItem) {
    const supportedPersonId = state.supportedPersonId ?? firstItem?.supportedPersonId ?? `person-${Date.now()}`;
    const migratedItem = firstItem ? {
      ...firstItem,
      supportedPersonId,
      status: firstItem.status ?? 'saved' as const,
      updatedAt: firstItem.updatedAt ?? new Date().toISOString(),
    } : undefined;
    const records = migratedItem
      ? state.records.some((item) => item.id === migratedItem.id)
        ? state.records.map((item) => item.id === migratedItem.id ? migratedItem : item)
        : [...state.records, migratedItem]
      : state.records;

    update({
      supportedPersonId,
      records,
      firstItem: migratedItem ?? state.firstItem ?? records[0],
      onboardingComplete: true,
      stage: 'home',
      allSetDismissed: false,
    });
    setActiveTab('home');
  }

  function renderShell() {
    let content;

    if (activeTab === 'home') {
      content = (
        <HomeScreen
          state={state}
          onAddSomething={() => go('firstThing')}
          onDismissAllSet={() => update({ allSetDismissed: true })}
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
        <FoundationScreen
          title={state.supportedPersonName || 'Person'}
          body="Keep their appointments, home details, documents and contacts together here."
        />
      );
    }

    return (
      <View style={styles.shell}>
        <View style={styles.shellContent}>{content}</View>
        <TabBar
          active={activeTab}
          personName={state.supportedPersonName}
          onChange={setActiveTab}
        />
      </View>
    );
  }

  function renderOnboarding() {
    switch (state.stage) {
      case 'welcome':
      case 'how':
        return <WelcomeScreen onStart={() => go('auth')} onLogin={() => go('auth')} />;
      case 'auth':
        return <AuthScreen onBack={goBack} onAuth={setAuth} onEmail={() => go('emailAuth')} />;
      case 'emailAuth':
        return (
          <EmailAuthScreen
            email={state.auth?.method === 'email' ? state.auth.email : undefined}
            onBack={goBack}
            onContinue={continueWithEmail}
          />
        );
      case 'relationship':
        return (
          <RelationshipScreen
            selected={state.relationship}
            onBack={goBack}
            onSelect={setRelationship}
            onContinue={() => go('name')}
          />
        );
      case 'name':
        return (
          <NameScreen
            name={state.supportedPersonName}
            onBack={goBack}
            onChangeName={(supportedPersonName) => update({ supportedPersonName })}
            onContinue={() => go('privacyConsent')}
          />
        );
      case 'privacyConsent':
        return (
          <PrivacyConsentScreen
            accepted={state.privacyDeclarationAccepted}
            onBack={goBack}
            onToggleAccepted={() =>
              update({
                privacyDeclarationAccepted: !state.privacyDeclarationAccepted,
                privacyDeclarationVersion: !state.privacyDeclarationAccepted
                  ? PRIVACY_DECLARATION_VERSION
                  : undefined,
                privacyDeclarationAcceptedAt: !state.privacyDeclarationAccepted
                  ? new Date().toISOString()
                  : undefined,
              })
            }
            onContinue={() => go('interests')}
          />
        );
      case 'interests':
        return (
          <InterestsScreen
            selected={state.interests}
            personName={state.supportedPersonName}
            onBack={goBack}
            onToggle={toggleInterest}
            onContinue={() => update({
              supportedPersonId: state.supportedPersonId ?? `person-${Date.now()}`,
              stage: 'firstThing',
            })}
            onSkip={() => update({
              interests: [],
              supportedPersonId: state.supportedPersonId ?? `person-${Date.now()}`,
              stage: 'firstThing',
            })}
          />
        );
      case 'firstThing':
        return (
          <FirstThingScreen
            interests={state.interests}
            personName={state.supportedPersonName}
            supportedPersonId={state.supportedPersonId ?? 'person-local'}
            records={state.records}
            onBack={goBack}
            onSaveRecord={saveRecord}
            onFinish={() => completeOnboarding()}
            onSkip={() => completeOnboarding()}
          />
        );
      case 'itemForm':
        return state.selectedFirstItemType ? (
          <ItemFormScreen
            type={state.selectedFirstItemType}
            personName={state.supportedPersonName}
            onBack={goBack}
            onSave={completeOnboarding}
          />
        ) : (
          <FirstThingScreen
            interests={state.interests}
            personName={state.supportedPersonName}
            supportedPersonId={state.supportedPersonId ?? 'person-local'}
            records={state.records}
            onBack={goBack}
            onSaveRecord={saveRecord}
            onFinish={() => completeOnboarding()}
            onSkip={() => completeOnboarding()}
          />
        );
      case 'home':
        return renderShell();
      default:
        return <WelcomeScreen onStart={() => go('auth')} onLogin={() => go('auth')} />;
    }
  }

  if (loading || !fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <AppText variant="secondary" tone="soft" style={styles.loadingText}>
          Opening Lilica...
        </AppText>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.app}>
        <StatusBar style={state.stage === 'welcome' || state.stage === 'how' ? 'light' : 'dark'} />
        {saveError ? (
          <View style={styles.saveBanner}>
            <AppText variant="secondary" tone="white">
              Your progress could not be saved just now. You can keep going.
            </AppText>
          </View>
        ) : null}
        {renderOnboarding()}
      </View>
    </SafeAreaProvider>
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

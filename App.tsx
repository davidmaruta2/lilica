import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import {
  authenticate as authenticateBiometric,
  biometricLabel,
  getBiometricAvailability,
  setBiometricLockEnabled,
  useBiometricLock,
  BiometricAvailability,
} from './src/biometricLock';
import { BiometricLockScreen } from './src/components/BiometricLockScreen';
import { RecordQuickEditor } from './src/components/RecordQuickEditor';
import type { RecordSheetOrigin } from './src/components/RecordSheet';
import { SettingsMenu } from './src/components/SettingsMenu';
import { NotificationCentre } from './src/components/NotificationCentre';
import type { NotificationAnchor } from './src/components/NotificationBellButton';
import { TabBar } from './src/components/TabBar';
import { AppText } from './src/components/Text';
import { AboutYouScreen } from './src/screens/AboutYouScreen';
import { AccountScreen, ProfileErrorScreen } from './src/screens/AccountScreen';
import { PrivacyDataScreen } from './src/screens/PrivacyDataScreen';
import { pickProfilePhoto, uploadProfilePhoto } from './src/profileAvatar';
import { AuthScreen } from './src/screens/AuthScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { CareForkScreen } from './src/screens/CareForkScreen';
import { JoinOrSetupScreen } from './src/screens/JoinOrSetupScreen';
import { JoinCareCircleScreen } from './src/screens/JoinCareCircleScreen';
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
import { ContactsListScreen } from './src/screens/ContactsListScreen';
import { ChatThreadScreen } from './src/screens/ChatThreadScreen';
import { CareCircleScreen } from './src/screens/CareCircleScreen';
import { ToDoScreen } from './src/screens/ToDoScreen';
import { WellbeingUpdatesScreen } from './src/screens/WellbeingUpdatesScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import {
  initialOnboardingState,
  loadOnboardingState,
  prepareOnboardingStateForStartup,
  saveOnboardingState,
} from './src/storage';
import { queuePendingAttachmentUploads } from './src/attachments';
import { enqueueDocumentCleanup, retryPendingCareSpaceStorageCleanup, retryPendingDocumentCleanup } from './src/documentCleanupQueue';
import { clearLocalDataForOwner } from './src/localData';
import { removeRecordById, upsertRecord } from './src/records';
import {
  activeCareSpace,
  activeCareSpaces,
  archivedCareSpaces,
  createOnboardingDraft,
  createPersonDraft,
  integrateProvisionedPeople,
  integrateReconnectedCareSpaces,
  linkProvisionedCareSpaces,
  projectActiveCareSpace,
  removeCareSpace,
  replaceCareSpace,
  resolveBackStage,
  resolveOnboardingStateAfterAccountReconnect,
  resolveOnboardingStateAfterAcceptingInvitation,
  setCareSpaceStatus,
  validatePersonDraft,
} from './src/careSpaceState';
import { archiveCareSpace, deleteCareSpace, provisionSupportedPeople, reconnectCareSpaces, renameSupportedPerson, restoreCareSpace } from './src/careSpaces';
import {
  acceptInvitation,
  acceptInvitationGroup,
  approveCareSpaceDeletion,
  cancelCareSpaceDeletion,
  CareCircleInvitation,
  CareCircleMember,
  CareSpaceDeletionStatus,
  declineCareSpaceDeletion,
  declineInvitation,
  declineInvitationGroup,
  DeletionReason,
  getCareSpaceDeletionStatus,
  listCareSpaceInvitations,
  listCareSpaceMembers,
  listMyInvitations,
  MyInvitation,
  promoteToOrganiser,
  resolveInvitationByCode,
  requestCareSpaceDeletion,
} from './src/careCircle';
import { InvitationsScreen } from './src/screens/InvitationsScreen';
import { useInvitationDeepLink } from './src/invitationDeepLink';
import { ActivityEvent, listRecentActivity } from './src/activity';
import { ChatMessage, getChatUnreadCount, getOrCreateCareCircleThread, listChatMessages, previewChatMessage } from './src/chat';
import {
  buildNotificationCentreItems,
  loadNotificationLastViewedAt,
  saveNotificationLastViewedAt,
  unreadNotificationCount,
} from './src/notificationCentre';
import {
  CareSpaceCommercialStatus,
  cacheCommercialStatus,
  describeEntitlement,
  getCareSpaceCommercialStatus,
  getMyEntitlement,
  isEntitlementActiveNow,
  MyEntitlement,
  readCachedCommercialStatus,
} from './src/entitlement';
import { configureBilling, getAnnualPackage, isBillingConfigured, logOutBilling, purchaseAnnualSubscription, restorePurchases } from './src/billing';
import { SubscriptionScreen } from './src/screens/SubscriptionScreen';
import { ArchivedGate } from './src/components/ArchivedGate';
import { ReadOnlyGate } from './src/components/ReadOnlyGate';
import { RecentActivityScreen } from './src/screens/RecentActivityScreen';
import { CareSummaryScreen } from './src/screens/CareSummaryScreen';
import { ArchivedCareScreen } from './src/screens/ArchivedCareScreen';
import { ContactScreen } from './src/screens/ContactScreen';
import { DocumentsScreen } from './src/screens/DocumentsScreen';
import { MedicalLogScreen } from './src/screens/MedicalLogScreen';
import { FaqScreen } from './src/screens/FaqScreen';
import { HowToUseScreen } from './src/screens/HowToUseScreen';
import { FeatureRequestScreen } from './src/screens/FeatureRequestScreen';
import { ManageCareScreen } from './src/screens/ManageCareScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import {
  enqueueRecordDelete,
  enqueueRecordUpsert,
  hasEntitlementHeldMutations,
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
import { colors, radius, spacing } from './src/theme';
import { appFontAssets } from './src/fontAssets';
import {
  AppTab,
  CategoryOptionId,
  FirstItem,
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
  'joinOrSetup',
  'joinCareCircle',
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
  // Care Circle invitation & joining flow completion (`\downloads\carecircle.txt`,
  // 14 September 2026): a genuinely new user (never started onboarding
  // at all) sees the join/setup fork instead of jumping straight to
  // careFork -- the SAME `!hasStarted` condition, no new check added.
  // Both of this function's own callers in App.tsx already only reach
  // it once showInvitations has been checked and is false, so "no
  // auto-surfaced invitation already handles this" is already
  // guaranteed by the time this runs.
  return hasStarted ? 'relationship' : 'joinOrSetup';
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
  // Post-build implementation batch (lilbatch.txt, 17 September 2026):
  // biometric app lock. See src/biometricLock.ts's own header comment --
  // this hook re-reads the per-account preference fresh whenever the
  // signed-in user changes, which is what keeps two accounts on the same
  // device correctly isolated.
  const biometricLock = useBiometricLock(auth.session?.user.id);
  const [biometricAvailability, setBiometricAvailability] = useState<BiometricAvailability>({ supported: false });
  useEffect(() => {
    let active = true;
    getBiometricAvailability().then((result) => { if (active) setBiometricAvailability(result); });
    return () => { active = false; };
  }, []);
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
  // "Open this record's editor" request from Home/Calendar/To Do/Care
  // Circle/Wellbeing updates, rendered by the RecordQuickEditor overlay in
  // renderShell -- see openRecordFromProjection and RecordQuickEditor.tsx
  // for why this is an overlay and not a screen/stage switch.
  const [calendarOpenRecordId, setCalendarOpenRecordId] = useState<string>();
  const [recordOpenOrigin, setRecordOpenOrigin] = useState<RecordSheetOrigin>();
  // "Open a NEW draft of this category" request from Person's per-section
  // Add links -- same overlay, only one of these two is ever set at once.
  const [projectionOpenType, setProjectionOpenType] = useState<LilicaRecordType>();
  // Corrective task 2: Home's at-a-glance strip tiles navigate to To Do
  // with one of these pre-set as a ToDoScreen mount-time initial value.
  // Cleared whenever the tab bar itself is used to switch tabs (see its
  // onChange below), so navigating to To Do directly never inherits a
  // stale target from an earlier chip tap.
  const [todoInitialFilter, setTodoInitialFilter] = useState<'mine'>();
  const [todoInitialFocusGroup, setTodoInitialFocusGroup] = useState<'overdue' | 'today'>();
  // Corrective task 4 / Phase 18 revision: Account, Care Circle (when
  // reached from the drawer) and Privacy & Data are no longer separate
  // top-level screens that replace the current tab -- that made the
  // Settings drawer feel like it "flicked" the user to another page, and
  // its own Back button dropped them on the dashboard instead of back
  // into the drawer. They now render INSIDE the SettingsMenu drawer
  // itself (see its `section`/children below); this tracks which one.
  // Care Circle keeps a second, separate direct entry point from People's
  // own "Manage care circle" link -- see showCareCircle below -- which is
  // deliberately unchanged (full-screen, not the drawer).
  const [settingsSection, setSettingsSection] = useState<'menu' | 'careSummary' | 'documents' | 'medicalLog' | 'manageCare' | 'archivedCare' | 'account' | 'careCircle' | 'joinCareCircle' | 'privacyData' | 'subscription' | 'faq' | 'howTo' | 'featureRequest' | 'contact'>('menu');
  // Add flow's Medical Log card (see FirstThingScreen's onOpenMedicalLog):
  // swaps MedicalLogScreen in for FirstThingScreen at the same stage,
  // returning to it on back -- deliberately separate from `settingsSection`
  // above, which only covers the Settings-drawer entry point.
  const [firstThingMedicalLogOpen, setFirstThingMedicalLogOpen] = useState(false);
  // Care Circle invitation final closure (`\downloads\carecircle-final-
  // closure.txt`, 15 September 2026): "Join a Care Circle" inside the
  // Settings drawer is reachable from two different places -- the main
  // Settings menu directly, or "Join a Care Circle" INSIDE an already-
  // open Care Circle section -- and Back/Cancel must return to whichever
  // one it was actually opened from (the menu in the first case, Care
  // Circle in the second), never always the same fixed target.
  const [joinCareCircleReturnSection, setJoinCareCircleReturnSection] = useState<'menu' | 'careCircle'>('menu');
  // Phase 21B: the signed-in account's own commercial entitlement --
  // fetched once sign-in is known, refetched after a subscribe/restore
  // action. Never trusted as the actual mutation gate (the server always
  // re-checks) -- this is display-only, for the Subscription Settings
  // surface and its own Settings-row summary line.
  const [myEntitlement, setMyEntitlement] = useState<MyEntitlement>();
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [entitlementError, setEntitlementError] = useState<string>();
  const [annualSubscriptionPrice, setAnnualSubscriptionPrice] = useState<string>();
  const [annualProductLoading, setAnnualProductLoading] = useState(false);
  const [annualProductError, setAnnualProductError] = useState<string>();
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  // Phase 15: the active care space's real members, for the record
  // editor's assignment selector and the Care Circle screen. Never
  // includes pending/declined/expired/revoked/removed/left memberships --
  // list_care_space_members() only returns active ones.
  const [careCircleMembers, setCareCircleMembers] = useState<CareCircleMember[]>([]);
  const [careCircleInvitations, setCareCircleInvitations] = useState<CareCircleInvitation[]>([]);
  const [showCareCircle, setShowCareCircle] = useState(false);
  // Care Circle invitation & joining flow completion (`\downloads\carecircle.txt`,
  // 14 September 2026): an already-onboarded existing user's own manual
  // entry point into the code-joining flow (CareCircleScreen's own "Join
  // another Care Circle") -- same app-level-overlay pattern as
  // showCareCircle above. The onboarding-time fork (stage 'joinCareCircle')
  // is a completely separate render path that reaches the SAME
  // JoinCareCircleScreen component, never a second implementation.
  const [showJoinCareCircle, setShowJoinCareCircle] = useState(false);
  // Final People-screen mock: Key Contacts is a bounded preview (at most
  // four) with "View all" opening the complete list -- same app-level-
  // overlay pattern as showCareCircle above.
  const [showAllContacts, setShowAllContacts] = useState(false);
  // Home's "Updates this week" tile opens this real destination screen
  // (WellbeingUpdatesScreen) rather than an in-page scroll, on explicit
  // product instruction -- same app-level-overlay pattern as showCareCircle
  // above.
  const [showWellbeingUpdates, setShowWellbeingUpdates] = useState(false);
  // Phase 15: invitations addressed to the signed-in account itself
  // (never a care space this account already organises). Auto-surfaces
  // once per app session the first time any are found; "Not now" or
  // clearing the list both return to normal use without acting on them.
  const [myInvitations, setMyInvitations] = useState<MyInvitation[]>([]);
  const [showInvitations, setShowInvitations] = useState(false);
  const invitationsAutoOpened = useRef(false);
  // Phase 20B: Recent Activity's own bounded first page, refetched
  // whenever the active care space changes -- mirrors the careCircleMembers
  // effect below exactly, including the local-only-care-space guard (there
  // is no server activity feed for a space that was never synced). Care
  // Summary and Recent Activity share this same array rather than each
  // fetching their own copy -- one source of truth, multiple projections.
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [showRecentActivity, setShowRecentActivity] = useState(false);
  const [showNotificationCentre, setShowNotificationCentre] = useState(false);
  const [notificationOrigin, setNotificationOrigin] = useState<NotificationAnchor>();
  const [notificationLastViewedAt, setNotificationLastViewedAt] = useState<string>();
  const [notificationReadStateLoaded, setNotificationReadStateLoaded] = useState(false);
  const [notificationUnreadIds, setNotificationUnreadIds] = useState<Set<string>>(new Set());
  const [showCareSummary, setShowCareSummary] = useState(false);
  // Phase 23 slice 1: Lilica Chat's own app-level-overlay pattern, exactly
  // like showCareSummary/showRecentActivity above. chatUnreadCount and
  // chatPreviewMessage feed the Care Circle tab badge and the Care Circle
  // page's Chat card -- refetched below whenever the active care space
  // changes or the chat screen is opened/closed (onMessagesChanged also
  // refetches immediately after sending/editing/deleting a message).
  const [showChat, setShowChat] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatPreviewMessage, setChatPreviewMessage] = useState<ChatMessage>();
  const [chatRefreshToken, setChatRefreshToken] = useState(0);
  // Phase 23 slice 2: set only when Chat is opened via a member's "Message
  // privately" action -- undefined means showChat opens the shared Lilica
  // Chat thread instead. Cleared whenever chat is closed or the active
  // tab changes, same as every other secondary-screen flag.
  const [directChatPartner, setDirectChatPartner] = useState<{ membershipId: string; displayName: string }>();
  // Phase 20B: Search is keyed by the active care space id in renderShell
  // below, so switching supported person while it's open always remounts
  // it fresh rather than risk showing a stale query/result set (brief
  // section 19/35) -- closing it outright on a switch is simpler still and
  // is what this flag does.
  const [showSearch, setShowSearch] = useState(false);
  const storageOwnerId = auth.session?.user.id ?? null;
  const legacyBootstrapInFlight = useRef(false);
  const reconnectedOwnerId = useRef<string | undefined>(undefined);
  const [careSpacesReadyOwnerId, setCareSpacesReadyOwnerId] = useState<string>();
  const localRecordRevision = useRef(0);
  // Phase 17: which attachment ids this session has already queued for
  // upload -- see the retry effect below.
  const uploadAttemptedThisSession = useRef<Set<string>>(new Set());
  const recordRetryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeStorageOwnerId = useRef<string | null>(storageOwnerId);
  activeStorageOwnerId.current = storageOwnerId;
  const [fontsLoaded] = useFonts(appFontAssets);
  const currentSpace = activeCareSpace(state);
  const notificationItems = useMemo(() => buildNotificationCentreItems({
    records: currentSpace?.records ?? [],
    activity: recentActivity,
    activeMembershipId: currentSpace?.membershipId,
    personName: currentSpace?.displayName,
    remindersEnabled: notificationSettings.remindersEnabled,
  }), [currentSpace?.records, currentSpace?.membershipId, currentSpace?.displayName, recentActivity, notificationSettings.remindersEnabled]);
  const notificationUnreadCount = notificationReadStateLoaded
    ? unreadNotificationCount(notificationItems, notificationLastViewedAt)
    : 0;
  // Phase 20D: the ordinary active-person switcher must never surface an
  // archived care space (brief section 6) -- archivedCareSpaces() below
  // feeds the separate, intentional "Archived care" destination instead.
  const spaces = activeCareSpaces(state).sort((left, right) => left.displayName.localeCompare(right.displayName));
  // Multi-person Care Circle invitation scope (`\downloads\perm.txt`, 15
  // September 2026): brief section 5 -- ONLY the supported people this
  // account is an active ORGANISER of are ever offered for selection in
  // "Invite someone". This is a UX convenience for what to show; it is
  // never the security boundary -- invite_member_group() independently
  // re-checks organiser authority per selected care space server-side
  // regardless of what this list contains (brief section 29). A
  // never-synced local-only space has no server-side organiser role at
  // all yet, so it is excluded here exactly as it already is from the
  // Care Circle screen's own member/invitation fetch.
  const organiserEligiblePeople = spaces
    .filter((space) => space.role === 'organiser' && !space.careSpaceId.startsWith('local-') && space.displayName)
    .map((space) => ({ careSpaceId: space.careSpaceId, displayName: space.displayName as string }));

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
    if (settingsSection === 'account') getPermissionState().then(setReminderPermissionState).catch(() => undefined);
  }, [settingsSection]);

  // Phase 21B: fetch this account's own entitlement once sign-in is
  // known, and identify RevenueCat's own session to this exact account
  // (auth.uid()-derived, never an email -- see src/billing.ts). On
  // sign-out, log RevenueCat back out first, so a different account
  // signing in on the same device afterward can never inherit this one's
  // cached entitlement.
  useEffect(() => {
    if (!storageOwnerId) {
      setMyEntitlement(undefined);
      void logOutBilling();
      return;
    }
    let cancelled = false;
    setEntitlementLoading(true);
    void configureBilling(storageOwnerId);
    getMyEntitlement().then((result) => {
      if (cancelled) return;
      setEntitlementLoading(false);
      if (result.ok) { setMyEntitlement(result.data); setEntitlementError(undefined); }
      else setEntitlementError(result.message);
    });
    return () => { cancelled = true; };
  }, [storageOwnerId]);

  async function refreshMyEntitlement() {
    const result = await getMyEntitlement();
    if (result.ok) { setMyEntitlement(result.data); setEntitlementError(undefined); }
    return result;
  }

  // Phase 21C: the ONE central read-only signal for the whole app. Fetched
  // for the currently active care space via the already-existing,
  // minimal-disclosure get_care_space_commercial_status() RPC (Phase 21B) --
  // no new table, no new RPC, no client-authoritative state. A local-only
  // care space (never synced -- careSpaceId starts with "local-") has no
  // commercial concept at all and is never read-only. Undefined (not yet
  // loaded) deliberately means "not read-only" -- brief section 21's own
  // explicit "never assume expired" default -- rather than flashing a gate
  // on every care-space switch while the real answer is still in flight.
  const [careSpaceCommercialStatus, setCareSpaceCommercialStatus] = useState<CareSpaceCommercialStatus>();
  useEffect(() => {
    if (!currentSpace || currentSpace.careSpaceId.startsWith('local-')) {
      setCareSpaceCommercialStatus(undefined);
      return;
    }
    const careSpaceId = currentSpace.careSpaceId;
    let cancelled = false;
    getCareSpaceCommercialStatus(careSpaceId).then(async (result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        setCareSpaceCommercialStatus(result.data);
        if (storageOwnerId) await cacheCommercialStatus(storageOwnerId, careSpaceId, result.data);
        return;
      }
      // Offline/unreachable: fall back to the last server-verified value
      // for this exact care space within the 72-hour grace window, rather
      // than assuming either expired (would wrongly block real work while
      // offline) or active forever (would defeat the entitlement entirely).
      if (storageOwnerId) {
        const cached = await readCachedCommercialStatus(storageOwnerId, careSpaceId);
        if (!cancelled && cached.state !== 'none') setCareSpaceCommercialStatus(cached.status);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentSpace?.careSpaceId, storageOwnerId]);

  const isReadOnly = careSpaceCommercialStatus ? !careSpaceCommercialStatus.isActive : false;
  const [showReadOnlyGate, setShowReadOnlyGate] = useState(false);

  // Phase 21C: the friendly-translation half of "server rejection remains
  // the final safety net" (brief section 22). The proactive gate above
  // stops the common case before a mutation is even attempted; this
  // covers the rare remaining race -- entitlement lapsed after a form was
  // already open, or a queued offline mutation is replayed after expiry
  // -- so the app never surfaces recordSync's raw rejection silently.
  // Re-checked whenever this care space's own records change (every
  // successful/attempted sync pass updates that array) or the space
  // itself is switched.
  const [hasHeldMutation, setHasHeldMutation] = useState(false);
  const [heldMutationNoticeDismissed, setHeldMutationNoticeDismissed] = useState(false);
  useEffect(() => {
    if (!storageOwnerId || !currentSpace || currentSpace.careSpaceId.startsWith('local-')) {
      setHasHeldMutation(false);
      return;
    }
    let cancelled = false;
    hasEntitlementHeldMutations(storageOwnerId, currentSpace.careSpaceId).then((held) => {
      if (!cancelled) setHasHeldMutation(held);
    });
    return () => {
      cancelled = true;
    };
  }, [storageOwnerId, currentSpace?.careSpaceId, currentSpace?.records]);
  useEffect(() => {
    setHeldMutationNoticeDismissed(false);
  }, [currentSpace?.careSpaceId]);

  // Phase 20D: the SAME proactive-gate mechanism Phase 21C established,
  // extended with a second, distinct reason a care space can be read-only
  // -- archived. Deliberately its own state/component (ArchivedGate.tsx),
  // never the billing wording (brief section 7: "Archive is a different
  // reason for read-only state"). Checked first -- archiving is a
  // deliberate organiser choice, unrelated to and unaffected by billing
  // status, so it takes precedence if somehow both were ever true at once.
  const isArchived = currentSpace?.status === 'archived';
  const [showArchivedGate, setShowArchivedGate] = useState(false);

  // Central gate: every mutation-entry point calls this instead of its
  // real action directly. Read-only shows the one shared explanation
  // (src/components/ReadOnlyGate.tsx) instead of entering the flow; the
  // server remains the actual, final authority regardless (brief section
  // 22) -- this is only ever a proactive courtesy, never the security
  // boundary.
  function guardMutation(action: () => void) {
    if (isArchived) {
      setShowArchivedGate(true);
      return;
    }
    if (isReadOnly) {
      setShowReadOnlyGate(true);
      return;
    }
    action();
  }

  // Shared by every OTHER blocked-mutation entry point below (Care
  // Circle's Invite, the shared Edit trigger) that already receives its
  // own `isReadOnly` prop directly rather than going through
  // guardMutation() -- same precedence as guardMutation() itself.
  function showBlockedGate() {
    if (isArchived) setShowArchivedGate(true);
    else setShowReadOnlyGate(true);
  }

  async function handleSubscribe(): Promise<{ ok: boolean; message?: string }> {
    if (myEntitlement?.status === 'TRIAL_ACTIVE' && isEntitlementActiveNow(myEntitlement)) {
      return { ok: false, message: 'Your free period is still active. You will not be charged before it ends.' };
    }
    const offer = await getAnnualPackage();
    if (!offer.ok) return { ok: false, message: offer.message };
    if (!offer.data) return { ok: false, message: 'No subscription product is available yet.' };
    const purchase = await purchaseAnnualSubscription(offer.data);
    if (!purchase.ok) return { ok: false, message: purchase.message };
    // The webhook (supabase/functions/entitlement-webhook) is what makes
    // the server's own entitlements row authoritative -- this refetch is
    // an optimistic best-effort follow-up, not the real confirmation.
    // See docs/PHASE_21_ARCHITECTURE.md's purchase-flow section.
    await refreshMyEntitlement();
    return { ok: true };
  }

  async function handleRestore(): Promise<{ ok: boolean; message?: string }> {
    const result = await restorePurchases();
    if (!result.ok) return { ok: false, message: result.message };
    await refreshMyEntitlement();
    return { ok: true };
  }

  // Store metadata is loaded only when the Subscription section is open.
  // The store's own formatted price is the only price used for a purchase
  // CTA, so non-UK users never see a hard-coded GBP amount immediately
  // before the native purchase sheet shows a different local currency.
  useEffect(() => {
    if (settingsSection !== 'subscription' || !isBillingConfigured()) {
      setAnnualSubscriptionPrice(undefined);
      setAnnualProductLoading(false);
      setAnnualProductError(undefined);
      return;
    }
    let cancelled = false;
    setAnnualProductLoading(true);
    setAnnualProductError(undefined);
    getAnnualPackage().then((result) => {
      if (cancelled) return;
      setAnnualProductLoading(false);
      if (!result.ok) {
        setAnnualSubscriptionPrice(undefined);
        setAnnualProductError(result.message);
      } else if (!result.data) {
        setAnnualSubscriptionPrice(undefined);
        setAnnualProductError('The annual subscription is not available from the store just now.');
      } else {
        setAnnualSubscriptionPrice(result.data.product.priceString);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [settingsSection]);

  // Care Circle can be opened two ways -- People's own direct link
  // (showCareCircle) or the Settings drawer (settingsSection) -- both
  // should refresh the membership/invitation lists on open.
  const careCircleScreenActive = showCareCircle || settingsSection === 'careCircle';

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
    // Real defect found while tracing the "Who can they help with?"
    // checkbox path (`\downloads\carecircle-final-invitation-scope-
    // correction.txt`, 15 September 2026): organiserEligiblePeople relies
    // entirely on each care space's local `role` field, but that field
    // was previously only ever populated by a ONE-SHOT reconnectCareSpaces()
    // call fired once per signed-in session, with no retry -- if that
    // single attempt hadn't yet completed (or ever failed) by the time
    // the organiser opened Care Circle, the multi-person selection
    // silently never appeared, for the rest of that session, with no way
    // to recover except restarting the app. Reusing the EXISTING
    // reconnectCareSpaces()/integrateReconnectedCareSpaces() pair here
    // (never a new RPC) guarantees this list is genuinely current every
    // single time Care Circle is opened, matching the same
    // already-established refresh-on-open pattern this effect already
    // uses for members/invitations.
    if (careCircleScreenActive) {
      reconnectCareSpaces().then((result) => {
        if (!cancelled && result.ok) setState((current) => integrateReconnectedCareSpaces(current, result.people));
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSpace?.careSpaceId, careCircleScreenActive]);

  // Phase 20B: a person switch closes Search/Recent Activity/Care Summary
  // outright -- never show one supported person's results/activity/summary
  // a moment after switching to another (brief section 19/35). A ref
  // tracks the previous care space id so this only fires on a genuine
  // switch, never on the reload below (which intentionally leaves the
  // screen open).
  const previousCareSpaceId = useRef(currentSpace?.careSpaceId);
  useEffect(() => {
    if (previousCareSpaceId.current !== currentSpace?.careSpaceId) {
      previousCareSpaceId.current = currentSpace?.careSpaceId;
      setShowSearch(false);
      setShowRecentActivity(false);
      setShowCareSummary(false);
      setShowNotificationCentre(false);
    }
  }, [currentSpace?.careSpaceId]);

  useEffect(() => {
    setNotificationReadStateLoaded(false);
    setNotificationLastViewedAt(undefined);
    if (!storageOwnerId || !currentSpace?.careSpaceId) {
      setNotificationReadStateLoaded(true);
      return;
    }
    let cancelled = false;
    loadNotificationLastViewedAt(storageOwnerId, currentSpace.careSpaceId).then((value) => {
      if (!cancelled) {
        setNotificationLastViewedAt(value);
        setNotificationReadStateLoaded(true);
      }
    }).catch(() => { if (!cancelled) setNotificationReadStateLoaded(true); });
    return () => { cancelled = true; };
  }, [storageOwnerId, currentSpace?.careSpaceId]);

  // Phase 20B: reload the active care space's first page of recent
  // activity whenever the active space changes, and again whenever Recent
  // Activity or Care Summary is opened (something may have just happened
  // since it was last fetched).
  useEffect(() => {
    if (!currentSpace || currentSpace.careSpaceId.startsWith('local-')) {
      setRecentActivity([]);
      return;
    }
    let cancelled = false;
    listRecentActivity(currentSpace.careSpaceId).then((result) => {
      if (!cancelled && result.ok) setRecentActivity(result.data.events);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSpace?.careSpaceId, showRecentActivity, showCareSummary, showNotificationCentre]);

  // Phase 23 slice 1: unread Lilica Chat count (Care Circle tab badge +
  // Chat card badge) and a short preview of the most recent message
  // (Chat card). Reloaded on the same triggers as Recent Activity above,
  // plus chatRefreshToken -- bumped by ChatThreadScreen's onMessagesChanged
  // so the badge/preview update immediately after sending, editing or
  // deleting a message, not only the next time the space changes.
  useEffect(() => {
    if (!currentSpace || currentSpace.careSpaceId.startsWith('local-')) {
      setChatUnreadCount(0);
      setChatPreviewMessage(undefined);
      return;
    }
    let cancelled = false;
    getChatUnreadCount(currentSpace.careSpaceId).then((result) => {
      if (!cancelled && result.ok) setChatUnreadCount(result.data);
    });
    getOrCreateCareCircleThread(currentSpace.careSpaceId).then((threadResult) => {
      if (cancelled || !threadResult.ok) return;
      listChatMessages(threadResult.data).then((messagesResult) => {
        if (!cancelled && messagesResult.ok) {
          setChatPreviewMessage(messagesResult.data.messages[messagesResult.data.messages.length - 1]);
        }
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSpace?.careSpaceId, showChat, chatRefreshToken]);

  // Phase 15: surface the invitations screen automatically the first time
  // this session finds any pending invitation -- but only once, so a user
  // who dismisses it with "Not now" isn't interrupted again on every
  // render. They can still return to it manually (see Person's header).
  useEffect(() => {
    if (myInvitations.length > 0 && !invitationsAutoOpened.current) {
      invitationsAutoOpened.current = true;
      setShowInvitations(true);
    }
  }, [myInvitations.length]);

  // Care Circle invitation delivery: a signed-in user tapping an
  // invitation link (lilica://invite/<id> or https://lilica.co.uk/
  // invite/<id> once foregrounded/opened by one) jumps straight to the
  // review screen -- a deliberate link tap is a stronger, more explicit
  // signal than the passive auto-open heuristic above, so this fires
  // even if that one-time auto-open already happened earlier this
  // session. This never bypasses accept_invitation()'s own server-side
  // identity check (src/invitationLinks.ts's own header comment) -- it
  // only ever decides whether to SHOW the existing, already-correct
  // review screen sooner; a signed-out tap does nothing special here and
  // relies entirely on the same pending-invitation discovery once the
  // user authenticates, exactly as it already does without any link at
  // all.
  const invitationDeepLink = useInvitationDeepLink();
  useEffect(() => {
    if (!invitationDeepLink.invitationId || !auth.session) return;
    invitationsAutoOpened.current = true;
    void refreshMyInvitations();
    setShowInvitations(true);
    invitationDeepLink.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitationDeepLink.invitationId, auth.session]);

  async function refreshMyInvitations() {
    const result = await listMyInvitations();
    if (result.ok) {
      setMyInvitations(result.data);
      if (result.data.length === 0) setShowInvitations(false);
    }
    return result;
  }

  // Shared tail for every acceptance route (legacy single invitation OR
  // multi-person group) -- reconnects/integrates care spaces and
  // resolves onboarding state exactly once, so the two entry points
  // below never duplicate this logic.
  async function finishAcceptance() {
    const reconnected = await reconnectCareSpaces();
    if (reconnected.ok) {
      setState((current) => {
        const next = integrateReconnectedCareSpaces(current, reconnected.people);
        // Real bug found by direct tracing (`\downloads\perm.txt`'s own
        // brand-new-invitee closure check) -- see
        // resolveOnboardingStateAfterAcceptingInvitation()'s own header
        // comment in src/careSpaceState.ts for the full explanation and
        // its now-real, isolated unit-test coverage.
        return resolveOnboardingStateAfterAcceptingInvitation(next);
      });
    }
    await refreshMyInvitations();
  }

  // Multi-person Care Circle invitation scope (`\downloads\perm.txt`, 15
  // September 2026): dispatches to accept_invitation() (legacy, one
  // care space) or accept_invitation_group() (a multi-person bundle) --
  // never both, and the caller decides which by which id it has. Every
  // existing single-invitation acceptance path continues calling this
  // with only invitationId set, completely unchanged in effect.
  async function handleAcceptInvitation(target: { invitationId?: string; groupId?: string }) {
    const result = target.groupId
      ? await acceptInvitationGroup(target.groupId)
      : await acceptInvitation(target.invitationId as string);
    if (!result.ok) return result;
    await finishAcceptance();
    return { ok: true as const };
  }

  // Phase 18: after leaving succeeds server-side, re-run the exact same
  // reconciliation the app already uses after accepting an invitation --
  // the (now revoked) space simply won't come back from it.
  async function handlePrivacyCareSpaceLeft() {
    const reconnected = await reconnectCareSpaces();
    if (reconnected.ok) setState((current) => integrateReconnectedCareSpaces(current, reconnected.people));
    // Leaving a care space changes what the rest of the app shows -- exit
    // the drawer entirely here rather than returning to its menu list.
    setShowSettingsMenu(false);
    setSettingsSection('menu');
  }

  // Remove-supported-person: a real organiser capability that was simply
  // missing (delete_my_account() only ever detaches memberships; leave/
  // remove-member only ever end one membership). A local-only care space
  // (never synced) has nothing server-side to delete, so this only ever
  // removes it from local state directly; a synced space is genuinely,
  // irreversibly deleted server-side first (src/careSpaces.ts's
  // deleteCareSpace()), and local state is only updated once that has
  // actually succeeded. Takes an explicit target id -- direct
  // product-owner report: "I have two supported people but it only
  // offers to remove one" -- Privacy & data now lists every care space
  // this account organises, not only whichever is currently active.
  async function handleRemoveCareSpace(targetId: string): Promise<{ ok: boolean; message?: string }> {
    if (!targetId.startsWith('local-')) {
      if (!storageOwnerId) return { ok: false, message: 'Please log in again to continue.' };
      const result = await deleteCareSpace(storageOwnerId, targetId);
      if (!result.ok) return { ok: false, message: result.message };
    }
    setState((current) => removeCareSpace(current, targetId));
    setShowSettingsMenu(false);
    setSettingsSection('menu');
    return { ok: true };
  }

  // 20 September 2026, direct product-owner request: renaming a supported
  // person after initial setup. Same discipline as archive/restore below --
  // local state only updates once the server call has genuinely succeeded.
  async function handleRenameSupportedPerson(targetId: string, newDisplayName: string): Promise<{ ok: boolean; message?: string }> {
    const result = await renameSupportedPerson(targetId, newDisplayName);
    if (!result.ok) return result;
    setState((current) => projectActiveCareSpace(replaceCareSpace(current, targetId, (space) => ({ ...space, displayName: newDisplayName.trim() }))));
    return { ok: true };
  }

  // Phase 20D: ARCHIVE/RESTORE -- the reversible, non-destructive
  // alternative to the permanent removal above. Local state only ever
  // updates once the server call has genuinely succeeded, same discipline
  // as every other care-space mutation in this file.
  async function handleArchiveCareSpace(targetId: string): Promise<{ ok: boolean; message?: string }> {
    const result = await archiveCareSpace(targetId);
    if (!result.ok) return result;
    setState((current) => setCareSpaceStatus(current, targetId, 'archived'));
    return { ok: true };
  }

  async function handleRestoreCurrentCareSpace(targetId: string): Promise<{ ok: boolean; message?: string }> {
    const result = await restoreCareSpace(targetId);
    if (!result.ok) return result;
    setState((current) => setCareSpaceStatus(current, targetId, 'active'));
    return { ok: true };
  }

  // Every care space this account organises that is currently ARCHIVED --
  // feeds the "Archived care" destination (Account group). Local-only
  // spaces have no archive concept (see LocalCareSpaceState.status's own
  // comment) so never appear here.
  const archivedSpaces = archivedCareSpaces(state).map((space) => ({ careSpaceId: space.careSpaceId, displayName: space.displayName }));

  // Phase 20D: organiser handoff. Re-runs the exact same Care Circle
  // refresh already used after every other membership change (invite,
  // role change, removal) -- promoting someone changes their own role,
  // which this app already re-fetches from listCareSpaceMembers()
  // elsewhere; here it's the caller's own explicit action, so refresh
  // immediately rather than waiting for the next natural refresh point.
  async function handlePromoteToOrganiser(membershipId: string): Promise<{ ok: boolean; message?: string }> {
    if (!currentSpace) return { ok: false, message: 'No active care space.' };
    const result = await promoteToOrganiser(currentSpace.careSpaceId, membershipId);
    if (!result.ok) return result;
    await refreshCareCircle();
    return { ok: true };
  }

  // Phase 20D: multi-organiser permanent-deletion consent -- Manage
  // [Name]'s care's own "Permanent removal" section. deletionStatus is
  // refreshed explicitly (not on every render) since it involves a
  // network round-trip; ManageCareScreen calls onRefreshDeletionStatus on
  // mount and after every action.
  const [deletionStatus, setDeletionStatus] = useState<CareSpaceDeletionStatus>();

  function refreshDeletionStatus() {
    if (!currentSpace) return;
    getCareSpaceDeletionStatus(currentSpace.careSpaceId).then((result) => {
      if (result.ok) setDeletionStatus(result.data);
    });
  }

  async function handleRequestDeletion(reason?: DeletionReason): Promise<{ ok: boolean; message?: string; deletedImmediately?: boolean }> {
    if (!currentSpace) return { ok: false, message: 'No active care space.' };
    const result = await requestCareSpaceDeletion(currentSpace.careSpaceId, reason);
    if (!result.ok) return result;
    if (result.data.deletedImmediately) {
      // Sole organiser -- the server already performed the actual
      // deletion. Mirror handleRemoveCareSpace()'s own local-state update.
      setState((current) => removeCareSpace(current, currentSpace.careSpaceId));
      setShowSettingsMenu(false);
      setSettingsSection('menu');
    }
    return { ok: true, deletedImmediately: result.data.deletedImmediately };
  }

  async function handleApproveDeletion(): Promise<{ ok: boolean; message?: string }> {
    if (!currentSpace || !deletionStatus) return { ok: false, message: 'No pending request.' };
    const result = await approveCareSpaceDeletion(deletionStatus.requestId);
    if (!result.ok) return result;
    if (result.data) {
      // Consensus reached -- the care space has genuinely been deleted.
      setState((current) => removeCareSpace(current, currentSpace.careSpaceId));
      setShowSettingsMenu(false);
      setSettingsSection('menu');
    }
    return { ok: true };
  }

  async function handleDeclineDeletion(): Promise<{ ok: boolean; message?: string }> {
    if (!deletionStatus) return { ok: false, message: 'No pending request.' };
    const result = await declineCareSpaceDeletion(deletionStatus.requestId);
    if (!result.ok) return result;
    setDeletionStatus(undefined);
    return { ok: true };
  }

  async function handleCancelDeletion(): Promise<{ ok: boolean; message?: string }> {
    if (!deletionStatus) return { ok: false, message: 'No pending request.' };
    const result = await cancelCareSpaceDeletion(deletionStatus.requestId);
    if (!result.ok) return result;
    setDeletionStatus(undefined);
    return { ok: true };
  }

  // Every care space this account actively organises -- local-only
  // spaces always qualify (no membership round-trip needed, this account
  // is their sole implicit organiser); a synced space qualifies once its
  // own `role` (refreshed by reconnectCareSpaces(), see
  // integrateReconnectedCareSpaces()) says so. The collaborator count is
  // only known live for the CURRENTLY active space (careCircleMembers is
  // only ever fetched for that one) -- an honest simplification, not a
  // wrong answer: other organised spaces simply show no collaborator line
  // in their own confirmation, never a fabricated count.
  const removableCareSpaces = Object.values(state.careSpaces)
    .filter((space) => space.careSpaceId.startsWith('local-') || space.role === 'organiser')
    .map((space) => ({
      careSpaceId: space.careSpaceId,
      displayName: space.displayName,
      collaboratorCount: space.careSpaceId === currentSpace?.careSpaceId
        ? careCircleMembers.filter((member) => !member.isSelf).length
        : 0,
    }));

  // Phase 18: the safest resolution to "what happens after I clear local
  // data" -- rather than attempting a risky live rebuild of in-memory
  // state from an AsyncStorage cache that was just wiped out from under
  // it, sign out immediately afterward. Signing back in reconstructs
  // everything fresh from the cloud, exactly as a genuinely fresh device
  // would.
  async function handlePrivacyClearLocalData() {
    if (!storageOwnerId) return;
    await clearLocalDataForOwner(storageOwnerId);
    await signOut();
  }

  // Phase 18B: called only after PrivacyDataScreen's own deleteMyAccount()
  // call has genuinely succeeded server-side (brief section 24 -- server
  // deletion always happens first). Reuses the exact same local-cleanup +
  // sign-out sequence as clearing local data, above -- deletion and
  // "clear this device" remain two distinct user-facing actions (section
  // 52), they just happen to share this one low-level cleanup step.
  async function handleAccountDeleted() {
    if (!storageOwnerId) return;
    await clearLocalDataForOwner(storageOwnerId);
    await signOut();
  }

  // Profile picture: picks a photo from the device library, uploads it
  // to the private profile-avatars bucket, then refreshes the in-memory
  // profile (auth.retryProfile() re-reads profiles including the new
  // avatar_path) so AccountScreen shows it immediately. A cancelled
  // picker is not an error; a denied permission or a failed upload
  // surfaces its own real message.
  async function handlePickProfilePhoto(): Promise<{ ok: boolean; message?: string; cancelled?: boolean }> {
    if (!storageOwnerId) return { ok: false, message: 'Please log in again to change your photo.' };
    const picked = await pickProfilePhoto();
    if (picked.status === 'cancelled') return { ok: true, cancelled: true };
    if (picked.status === 'denied') return { ok: false, message: picked.message };
    const result = await uploadProfilePhoto(storageOwnerId, picked.uri);
    if (!result.ok) return result;
    await auth.retryProfile();
    return { ok: true };
  }

  async function handleDeclineInvitation(target: { invitationId?: string; groupId?: string }) {
    const result = target.groupId
      ? await declineInvitationGroup(target.groupId)
      : await declineInvitation(target.invitationId as string);
    if (!result.ok) return result;
    await refreshMyInvitations();
    return { ok: true as const };
  }

  function refreshCareCircle() {
    if (!currentSpace || currentSpace.careSpaceId.startsWith('local-')) return;
    listCareSpaceMembers(currentSpace.careSpaceId).then((result) => {
      if (result.ok) setCareCircleMembers(result.data);
    });
    listCareSpaceInvitations(currentSpace.careSpaceId).then((result) => {
      if (result.ok) setCareCircleInvitations(result.data);
    });
  }

  // Invitation delivery UX correction (14 September 2026) originally
  // persisted delivery state locally (LocalCareSpaceState/AsyncStorage),
  // since care_space_invitations had no delivery-state column at the
  // time. Superseded the same day by the final architectural closure:
  // last_email_sent_at/email_send_count/last_share_opened_at now live
  // on the invitation row itself (supabase/migrations/20260916160000_
  // invitation_delivery_and_rate_limit.sql), set only by
  // record_invitation_email_sent()/record_invitation_share_opened() --
  // genuinely server-authoritative, surviving app restart, reinstall,
  // and device change. CareCircleScreen now reads these fields directly
  // from its own `invitations` prop; no client-side recording function
  // is needed here any more.

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
      if (result.ok) setState((current) => resolveOnboardingStateAfterAccountReconnect(current, result.people));
    }).finally(() => {
      setCareSpacesReadyOwnerId(storageOwnerId);
    });
    // Phase 15: check once per signed-in owner for pending invitations
    // addressed to this account's own email -- never inferred from any
    // local state, matching accept_invitation()'s own server-side check.
    listMyInvitations().then((result) => {
      if (result.ok) setMyInvitations(result.data);
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

  // Phase 17: retries/resumes pending document uploads at existing
  // lifecycle points -- app startup once an authenticated, non-local care
  // space's records are available, and after each successful
  // reconciliation pass above (both land here, since both update
  // `currentSpace.records`). `uploadAttemptedThisSession` is the smallest
  // reliable guard against re-attempting the same attachment id every
  // render within one app session -- queuePendingAttachmentUploads()
  // itself is already idempotent, so this is purely to avoid wasted RPC
  // calls, not a correctness requirement. A genuine restart (a fresh
  // session) naturally retries anything still pending, satisfying "a
  // restart must not strand a valid pending upload forever" without a
  // separate background-job system.
  useEffect(() => {
    if (!currentSpace || currentSpace.careSpaceId.startsWith('local-')) return;
    const careSpaceId = currentSpace.careSpaceId;
    for (const record of currentSpace.records) {
      if (record.type !== 'document') continue;
      const pending = record.attachments?.filter((attachment) => attachment.uri && attachment.uploadStatus !== 'uploaded');
      if (!pending || pending.length === 0) continue;
      if (pending.every((attachment) => uploadAttemptedThisSession.current.has(attachment.id))) continue;
      pending.forEach((attachment) => uploadAttemptedThisSession.current.add(attachment.id));
      queuePendingAttachmentUploads(careSpaceId, record).then((uploaded) => {
        if (uploaded) saveRecord({ ...record, attachments: uploaded });
      });
    }
  }, [currentSpace?.careSpaceId, currentSpace?.records]);

  // Phase 18: the same lifecycle points also retry any still-pending
  // document cloud cleanup (see src/documentCleanupQueue.ts) -- app
  // startup once authenticated, and every reconciliation pass. Guarded
  // only by storageOwnerId being known; the queue itself is empty in the
  // common case, so this is a cheap no-op read most of the time.
  useEffect(() => {
    if (!storageOwnerId) return;
    void retryPendingDocumentCleanup(storageOwnerId);
    // Remove-supported-person: the sibling retry for a whole-care-space
    // Storage cleanup that couldn't complete immediately (offline, a
    // transient error) -- see src/careSpaces.ts's deleteCareSpace().
    void retryPendingCareSpaceStorageCleanup(storageOwnerId);
  }, [storageOwnerId, currentSpace?.records]);

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

    // See resolveBackStage() in src/careSpaceState.ts for why this needs
    // setupStatus, not just stage position, to correctly distinguish
    // Home's everyday Add from genuine onboarding -- both reach the
    // identical 'firstThing' stage.
    const target = resolveBackStage(state.stage, currentSpace?.setupStatus, stageOrder);
    if (target) go(target);
  }

  function toggleInterest(type: CategoryOptionId) {
    if (!currentSpace) return;
    setState((current) => projectActiveCareSpace(replaceCareSpace(current, currentSpace.careSpaceId, (space) => {
      const exists = space.interests.includes(type);
      return { ...space, interests: exists ? space.interests.filter((item) => item !== type) : [...space.interests, type] };
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
    // Phase 18: durably queues the file/link cleanup Phase 16 left
    // unwired and Phase 17 only attempted best-effort -- enqueue() is
    // awaited (a synchronous AsyncStorage write) before any network
    // attempt, so an offline delete or app kill mid-attempt can never
    // forget this record still owes cloud cleanup; the immediate retry
    // right after is just today's best chance to finish it right away.
    if (existing && storageOwnerId) {
      const ownerId = storageOwnerId;
      void enqueueDocumentCleanup(ownerId, existing).then(() => retryPendingDocumentCleanup(ownerId));
    }
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

    // Defence in depth for a returning account whose first startup
    // reconciliation failed transiently: immediately before first-time
    // provisioning, ask the server once more. Existing remote people win
    // and first-time setup is abandoned rather than creating another set
    // under newly generated draft ids. Later Add Person flows are allowed
    // through because onboardingComplete is already true for them.
    if (!state.onboardingComplete) {
      const existing = await reconnectCareSpaces();
      if (existing.ok && existing.people.length > 0) {
        setState((current) => resolveOnboardingStateAfterAccountReconnect(current, existing.people));
        setProvisioning(false);
        return;
      }
    }

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

  // Post-build implementation batch (lilbatch.txt, 17 September 2026):
  // the ONE place biometric protection is turned on/off. Turning it ON
  // requires a real, successful biometric confirmation first (brief
  // section 6: "only mark biometric protection enabled after successful
  // confirmation") -- never just a UI toggle flip. Turning it off does
  // not require re-authentication; the account is already signed in and
  // this only removes an additional local device-unlock layer.
  async function handleToggleBiometric(enabled: boolean): Promise<{ ok: boolean; message?: string }> {
    const userId = auth.session?.user.id;
    if (!userId) return { ok: false, message: 'Please log in again to change this setting.' };

    if (!enabled) {
      await setBiometricLockEnabled(userId, false);
      biometricLock.setEnabled(false);
      return { ok: true };
    }

    const availability = await getBiometricAvailability();
    setBiometricAvailability(availability);
    if (!availability.supported) {
      return { ok: false, message: "This device doesn't support biometric unlock." };
    }
    if (!availability.enrolled) {
      return { ok: false, message: `Set up ${biometricLabel(availability.kind)} in your device settings first, then try again.` };
    }

    const label = biometricLabel(availability.kind);
    const result = await authenticateBiometric(`Confirm to turn on ${label} for Lilica`);
    if (result === 'success') {
      await setBiometricLockEnabled(userId, true);
      biometricLock.setEnabled(true);
      biometricLock.markUnlocked();
      return { ok: true };
    }
    if (result === 'cancelled') return { ok: false };
    return { ok: false, message: "That didn't work. Please try again." };
  }

  // Shared by Home, Calendar, To Do, Person and Wellbeing updates: all open
  // a tapped item through the same established record editor, never a
  // projection-specific one. Bug fix: this used to also switch stage to
  // 'firstThing', which replaced the whole screen (Home/Calendar/etc.)
  // with FirstThingScreen just to host the editor -- that extra screen
  // swap, both on open and on close, was the actual cause of the "flash"
  // reported against every tile on every tab. Setting only the target
  // here (rendered by the RecordQuickEditor overlay in renderShell, below)
  // opens the sheet directly on top of whichever screen is already
  // showing, which never unmounts.
  function openRecordFromProjection(recordId: string, origin?: RecordSheetOrigin) {
    setRecordOpenOrigin(origin);
    setCalendarOpenRecordId(recordId);
  }

  // Person's per-section Add links: jump straight into a NEW draft of that
  // category via the same established record creation architecture --
  // never a separate "Add" form. Same fix as above: no stage switch.
  function openNewFromProjection(type: LilicaRecordType) {
    setProjectionOpenType(type);
  }

  // The RecordQuickEditor overlay itself, extracted so both renderShell()
  // (Home/Calendar/To Do/People) AND the Medical Log screen reached via
  // the Add flow/onboarding (rendered by renderAuthenticatedOnboarding()'s
  // own stage switch, a separate render path that never calls
  // renderShell()) can host it. Bug found and fixed 20 September 2026:
  // Medical Log's per-section "Add" links call openNewFromProjection()
  // exactly like every other onAddType consumer, but when Medical Log was
  // reached from the Add flow (not Settings, which lives inside
  // renderShell()), nothing rendered this overlay at all -- tapping Add
  // silently did nothing, since setProjectionOpenType() had no listener in
  // that part of the tree.
  function renderProjectionEditor() {
    if (!calendarOpenRecordId && !projectionOpenType) return null;
    return (
      <RecordQuickEditor
        key={calendarOpenRecordId ?? projectionOpenType}
        records={state.records}
        recordId={calendarOpenRecordId}
        origin={calendarOpenRecordId ? recordOpenOrigin : undefined}
        newType={calendarOpenRecordId ? undefined : projectionOpenType}
        supportedPersonId={currentSpace?.supportedPersonId ?? 'person-local'}
        careSpaceId={currentSpace?.careSpaceId ?? ''}
        activeMembershipId={currentSpace?.membershipId}
        careCircleMembers={careCircleMembers}
        onRequestReminderPermission={requestReminderPermission}
        onSaveRecord={saveRecord}
        onRemoveRecord={removeRecord}
        onDismiss={() => {
          setCalendarOpenRecordId(undefined);
          setRecordOpenOrigin(undefined);
          setProjectionOpenType(undefined);
        }}
        isReadOnly={isReadOnly || isArchived}
        onBlockedEdit={() => showBlockedGate()}
      />
    );
  }

  // Corrective task 2: Home's Overdue/Due today/Assigned to you tiles
  // land here. This only switches which tab is active and what To Do
  // opens focused on -- the active care space (and so activeCareSpaceId)
  // is never touched, exactly like every other tab switch in this app.
  function openToDoFocusedOn(group: 'overdue' | 'today') {
    setTodoInitialFilter(undefined);
    setTodoInitialFocusGroup(group);
    setActiveTab('todo');
  }

  function openToDoAssignedToMe() {
    setTodoInitialFocusGroup(undefined);
    setTodoInitialFilter('mine');
    setActiveTab('todo');
  }

  function openNotifications(origin?: NotificationAnchor) {
    const viewedAt = new Date().toISOString();
    setNotificationOrigin(origin);
    setNotificationUnreadIds(new Set(
      notificationItems
        .filter((item) => !notificationLastViewedAt || item.occurredAt > notificationLastViewedAt)
        .map((item) => item.id),
    ));
    setShowNotificationCentre(true);
    setNotificationLastViewedAt(viewedAt);
    if (storageOwnerId && currentSpace?.careSpaceId) {
      void saveNotificationLastViewedAt(storageOwnerId, currentSpace.careSpaceId, viewedAt);
    }
  }

  // Corrective task 4: Settings is app-level, so Account/Care Circle must
  // override whichever tab is active, not only Person's -- checked here
  // BEFORE the activeTab branches (previously these were only reachable
  // as Person-tab fallbacks, meaning they could not have been opened from
  // Home/Calendar/To Do at all).
  const careCircleAvailable = Boolean(currentSpace && !currentSpace.careSpaceId.startsWith('local-') && currentSpace.membershipId);

  function renderShell() {
    let content;

    if (showSearch) {
      // Phase 20B, Feature B: keyed by the active care space id so a
      // person switch (which also closes this screen -- see the effect
      // above) can never leave a stale query/result set mounted underneath
      // a fresh remount for a different person.
      content = (
        <SearchScreen
          key={currentSpace?.careSpaceId}
          records={state.records}
          personName={currentSpace?.displayName}
          onBack={() => setShowSearch(false)}
          onOpenRecord={openRecordFromProjection}
        />
      );
    } else if (showRecentActivity) {
      content = (
        <RecentActivityScreen
          careSpaceId={currentSpace && !currentSpace.careSpaceId.startsWith('local-') ? currentSpace.careSpaceId : undefined}
          personName={currentSpace?.displayName}
          onBack={() => setShowRecentActivity(false)}
          onOpenRecord={openRecordFromProjection}
        />
      );
    } else if (showCareSummary) {
      content = (
        <CareSummaryScreen
          records={state.records}
          careCircleMembers={careCircleMembers}
          recentActivity={recentActivity}
          personName={currentSpace?.displayName}
          onBack={() => setShowCareSummary(false)}
          onOpenRecord={openRecordFromProjection}
        />
      );
    } else if (showChat) {
      content = (
        <ChatThreadScreen
          careSpaceId={currentSpace && !currentSpace.careSpaceId.startsWith('local-') ? currentSpace.careSpaceId : undefined}
          directPartnerMembershipId={directChatPartner?.membershipId}
          directPartnerDisplayName={directChatPartner?.displayName}
          onBack={() => { setShowChat(false); setDirectChatPartner(undefined); }}
          onMessagesChanged={() => setChatRefreshToken((token) => token + 1)}
        />
      );
    } else if (showWellbeingUpdates) {
      content = (
        <WellbeingUpdatesScreen
          records={state.records}
          personName={currentSpace?.displayName}
          onOpenRecord={openRecordFromProjection}
          onBack={() => setShowWellbeingUpdates(false)}
        />
      );
    } else if (showCareCircle) {
      // People's own direct "Manage care circle" link -- deliberately
      // still a full top-level screen, not the Settings drawer below.
      content = currentSpace ? (
        <CareCircleScreen
          personName={currentSpace.displayName}
          members={careCircleMembers}
          invitations={careCircleInvitations}
          careSpaceId={currentSpace.careSpaceId}
          onBack={() => setShowCareCircle(false)}
          onRefresh={refreshCareCircle}
          isReadOnly={isReadOnly || isArchived}
          onInviteBlocked={() => showBlockedGate()}
          inviterDisplayName={auth.profile?.displayName}
          // Real, pre-existing bug found while fixing discoverability
          // (`\downloads\carecircle-final-closure.txt`, 15 September
          // 2026): setting only showJoinCareCircle had no visible effect
          // at all -- showCareCircle is checked FIRST in this same
          // else-if chain below, so it always intercepted the render
          // before showJoinCareCircle was ever reached. Both must toggle
          // together.
          onJoinAnotherCareCircle={() => { setShowCareCircle(false); setShowJoinCareCircle(true); }}
          organiserEligiblePeople={organiserEligiblePeople}
        />
      ) : null;
    } else if (showJoinCareCircle) {
      // Care Circle invitation & joining flow completion: an existing
      // user's own manual entry point (CareCircleScreen's "Join a Care
      // Circle") -- the SAME screen and the SAME acceptance path
      // (handleAcceptInvitation) the onboarding-time fork uses. Back/
      // Cancel returns to Care Circle, not Home (brief's own explicit
      // requirement) -- a successful join falls through to the normal
      // Home/person view instead, since by then there is new, real
      // content worth landing on rather than the (now possibly
      // stale-context) Care Circle screen it was opened from.
      content = (
        <JoinCareCircleScreen
          onResolveCode={resolveInvitationByCode}
          onAccept={handleAcceptInvitation}
          onClose={() => { setShowJoinCareCircle(false); setShowCareCircle(true); }}
          onJoined={() => setShowJoinCareCircle(false)}
        />
      );
    } else if (showAllContacts) {
      // Final People-screen mock: "View all (N)" from the bounded Key
      // Contacts preview -- same filter/sort PersonScreen's own preview
      // already uses, just unbounded here.
      const allContacts = (currentSpace?.records ?? [])
        .filter((record) => record.type === 'contact' && record.status !== 'cancelled')
        .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
      content = (
        <ContactsListScreen
          contacts={allContacts}
          personName={currentSpace?.displayName}
          onBack={() => setShowAllContacts(false)}
          onOpenRecord={openRecordFromProjection}
          onAddContact={() => guardMutation(() => openNewFromProjection('contact'))}
        />
      );
    } else if (activeTab === 'home') {
      content = (
        <HomeScreen
          state={state}
          people={spaces}
          activeCareSpaceId={state.activeCareSpaceId}
          setupStatus={currentSpace?.setupStatus}
          onSwitchPerson={selectActiveSpace}
          onAddPerson={startAddPerson}
          onContinueSetup={continueActiveSetup}
          onAddSomething={() => guardMutation(() => currentSpace?.setupStatus === 'ready' ? go('firstThing') : continueActiveSetup())}
          onDismissAllSet={() => {
            if (!currentSpace) return;
            setState((current) => projectActiveCareSpace(replaceCareSpace(current, currentSpace.careSpaceId, (space) => ({ ...space, allSetDismissed: true }))));
          }}
          onOpenRecord={openRecordFromProjection}
          onOpenOverdue={() => openToDoFocusedOn('overdue')}
          onOpenDueToday={() => openToDoFocusedOn('today')}
          onOpenAssignedToYou={openToDoAssignedToMe}
          onOpenWellbeingUpdates={() => setShowWellbeingUpdates(true)}
          notificationCount={notificationUnreadCount}
          onOpenNotifications={openNotifications}
          onOpenSettings={() => setShowSettingsMenu(true)}
          onOpenSearch={() => setShowSearch(true)}
        />
      );
    } else if (activeTab === 'calendar') {
      content = currentSpace?.setupStatus === 'ready' ? (
        <CalendarScreen
          key={currentSpace.careSpaceId}
          records={state.records}
          personName={currentSpace?.displayName}
          onOpenRecord={openRecordFromProjection}
          notificationCount={notificationUnreadCount}
          onOpenNotifications={openNotifications}
          onOpenSettings={() => setShowSettingsMenu(true)}
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
          careCircleMembers={careCircleMembers}
          initialFilter={todoInitialFilter}
          initialFocusGroup={todoInitialFocusGroup}
          onOpenRecord={openRecordFromProjection}
          onSaveRecord={saveRecord}
          onAddSomething={() => guardMutation(() => go('firstThing'))}
          notificationCount={notificationUnreadCount}
          onOpenNotifications={openNotifications}
          onOpenSettings={() => setShowSettingsMenu(true)}
          onBack={todoInitialFilter || todoInitialFocusGroup ? () => {
            setTodoInitialFilter(undefined);
            setTodoInitialFocusGroup(undefined);
            setActiveTab('home');
          } : undefined}
        />
      ) : (
        <FoundationScreen
          title="To Do"
          body="Things to do will appear here as you add them."
        />
      );
    } else {
      content = (
        <PersonScreen
          displayName={currentSpace?.displayName}
          relationshipLabel={currentSpace?.relationshipLabel || currentSpace?.relationshipType}
          isSelf={currentSpace?.relationshipType === 'Myself'}
          people={spaces}
          activeCareSpaceId={state.activeCareSpaceId}
          onSwitchPerson={selectActiveSpace}
          onAddPerson={startAddPerson}
          notificationCount={notificationUnreadCount}
          onOpenNotifications={openNotifications}
          onOpenSettings={() => setShowSettingsMenu(true)}
          onOpenCareCircle={careCircleAvailable ? () => setShowCareCircle(true) : undefined}
          careCircleMembers={careCircleMembers}
          pendingInvitationCount={myInvitations.length}
          onOpenInvitations={() => setShowInvitations(true)}
          selfAvatarPath={auth.profile?.avatarPath}
          onOpenCareSummary={careCircleAvailable ? () => setShowCareSummary(true) : undefined}
          onOpenRecentActivity={careCircleAvailable ? () => setShowRecentActivity(true) : undefined}
          onOpenChat={careCircleAvailable ? () => { setDirectChatPartner(undefined); setShowChat(true); } : undefined}
          onOpenDirectChat={careCircleAvailable ? (member) => { setDirectChatPartner({ membershipId: member.membershipId, displayName: member.displayName }); setShowChat(true); } : undefined}
          chatUnreadCount={chatUnreadCount}
          chatPreviewText={chatPreviewMessage ? previewChatMessage(chatPreviewMessage) : undefined}
        />
      );
    }

    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.shell}>
        {hasHeldMutation && !heldMutationNoticeDismissed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss: a change couldn't be saved yet"
            onPress={() => setHeldMutationNoticeDismissed(true)}
            style={styles.heldMutationNotice}
          >
            <AppText variant="secondary" tone="primary">
              A change you made couldn't be saved because this care space's subscription isn't active. Nothing is lost -- it will save automatically once the subscription is active again.
            </AppText>
          </Pressable>
        ) : null}
        <View style={styles.shellContent}>{content}</View>
        {renderProjectionEditor()}
        <NotificationCentre
          visible={showNotificationCentre}
          origin={notificationOrigin}
          items={notificationItems}
          unreadIds={notificationUnreadIds}
          personName={currentSpace?.displayName}
          onDismiss={() => setShowNotificationCentre(false)}
          onOpenRecord={openRecordFromProjection}
          onViewActivity={careCircleAvailable ? () => setShowRecentActivity(true) : undefined}
        />
        <SettingsMenu
          visible={showSettingsMenu}
          section={settingsSection}
          onClose={() => { setShowSettingsMenu(false); setSettingsSection('menu'); }}
          personName={currentSpace?.displayName}
          onOpenCareSummary={careCircleAvailable ? () => setSettingsSection('careSummary') : undefined}
          onOpenDocuments={careCircleAvailable ? () => setSettingsSection('documents') : undefined}
          onOpenMedicalLog={careCircleAvailable ? () => setSettingsSection('medicalLog') : undefined}
          onOpenManageCare={careCircleAvailable && currentSpace?.role === 'organiser' ? () => setSettingsSection('manageCare') : undefined}
          onOpenContacts={() => { setShowSettingsMenu(false); setShowAllContacts(true); }}
          onOpenAccount={() => setSettingsSection('account')}
          onOpenPrivacyData={() => setSettingsSection('privacyData')}
          onOpenCareCircle={careCircleAvailable ? () => setSettingsSection('careCircle') : undefined}
          onOpenJoinCareCircle={() => { setJoinCareCircleReturnSection('menu'); setSettingsSection('joinCareCircle'); }}
          onOpenSubscription={() => setSettingsSection('subscription')}
          subscriptionSummary={myEntitlement ? describeEntitlement(myEntitlement) : undefined}
          onOpenArchivedCare={archivedSpaces.length > 0 ? () => setSettingsSection('archivedCare') : undefined}
          onOpenHowTo={() => setSettingsSection('howTo')}
          onOpenFaq={() => setSettingsSection('faq')}
          onOpenFeatureRequest={() => setSettingsSection('featureRequest')}
          onOpenContact={() => setSettingsSection('contact')}
        >
          {settingsSection === 'careSummary' ? (
            <CareSummaryScreen
              records={state.records}
              careCircleMembers={careCircleMembers}
              recentActivity={recentActivity}
              personName={currentSpace?.displayName}
              onBack={() => setSettingsSection('menu')}
              onOpenRecord={openRecordFromProjection}
            />
          ) : settingsSection === 'documents' ? (
            <DocumentsScreen
              careSpaceId={currentSpace && !currentSpace.careSpaceId.startsWith('local-') ? currentSpace.careSpaceId : undefined}
              personName={currentSpace?.displayName}
              onBack={() => setSettingsSection('menu')}
              onOpenRecord={openRecordFromProjection}
            />
          ) : settingsSection === 'medicalLog' ? (
            <MedicalLogScreen
              personName={currentSpace?.displayName}
              isSelf={currentSpace?.relationshipType === 'Myself'}
              records={state.records}
              onBack={() => setSettingsSection('menu')}
              onOpenRecord={openRecordFromProjection}
              onAddType={(type) => guardMutation(() => openNewFromProjection(type))}
            />
          ) : settingsSection === 'manageCare' && currentSpace ? (
            <ManageCareScreen
              careSpaceId={currentSpace.careSpaceId}
              personName={currentSpace.displayName}
              status={currentSpace.status ?? 'active'}
              members={careCircleMembers}
              deletionStatus={deletionStatus}
              selfMembershipId={currentSpace.membershipId}
              onBack={() => setSettingsSection('menu')}
              onOpenCareCircle={() => setSettingsSection('careCircle')}
              onRename={(newDisplayName) => handleRenameSupportedPerson(currentSpace.careSpaceId, newDisplayName)}
              onArchive={() => handleArchiveCareSpace(currentSpace.careSpaceId)}
              onRestore={() => handleRestoreCurrentCareSpace(currentSpace.careSpaceId)}
              onPromote={handlePromoteToOrganiser}
              onRemove={() => handleRemoveCareSpace(currentSpace.careSpaceId)}
              onRequestDeletion={handleRequestDeletion}
              onApproveDeletion={handleApproveDeletion}
              onDeclineDeletion={handleDeclineDeletion}
              onCancelDeletion={handleCancelDeletion}
              onRefreshDeletionStatus={refreshDeletionStatus}
            />
          ) : settingsSection === 'archivedCare' ? (
            <ArchivedCareScreen
              archivedSpaces={archivedSpaces}
              onBack={() => setSettingsSection('menu')}
              onRestore={handleRestoreCurrentCareSpace}
            />
          ) : settingsSection === 'account' ? (
            <AccountScreen
              displayName={auth.profile?.displayName ?? 'Your profile'}
              email={auth.session?.user.email}
              avatarPath={auth.profile?.avatarPath}
              signingOut={signingOut}
              error={signOutError}
              remindersEnabled={notificationSettings.remindersEnabled}
              reminderPermissionState={reminderPermissionState}
              quietHoursEnabled={notificationSettings.quietHoursEnabled}
              quietHoursLabel={`${formatQuietHour(notificationSettings.quietHours.startHour)}-${formatQuietHour(notificationSettings.quietHours.endHour)}`}
              onToggleReminders={(enabled) => void toggleGlobalReminders(enabled)}
              onToggleQuietHours={toggleQuietHours}
              onSaveDisplayName={auth.saveProfile}
              onChangePhoto={handlePickProfilePhoto}
              biometricSupported={biometricAvailability.supported}
              biometricEnrolled={biometricAvailability.supported && biometricAvailability.enrolled}
              biometricLabel={biometricAvailability.supported ? biometricLabel(biometricAvailability.kind) : 'biometric unlock'}
              biometricEnabled={Boolean(biometricLock.enabled)}
              onToggleBiometric={handleToggleBiometric}
              onBack={() => setSettingsSection('menu')}
              onSignOut={() => void signOut()}
            />
          ) : settingsSection === 'careCircle' && currentSpace ? (
            <CareCircleScreen
              personName={currentSpace.displayName}
              members={careCircleMembers}
              invitations={careCircleInvitations}
              careSpaceId={currentSpace.careSpaceId}
              onBack={() => setSettingsSection('menu')}
              onRefresh={refreshCareCircle}
              isReadOnly={isReadOnly || isArchived}
              onInviteBlocked={() => showBlockedGate()}
              inviterDisplayName={auth.profile?.displayName}
              organiserEligiblePeople={organiserEligiblePeople}
              onJoinAnotherCareCircle={() => { setJoinCareCircleReturnSection('careCircle'); setSettingsSection('joinCareCircle'); }}
            />
          ) : settingsSection === 'joinCareCircle' ? (
            // Real gap reported directly (15 September 2026): this was
            // previously only reachable from inside an already-open Care
            // Circle screen, itself gated behind having a care space of
            // one's own -- someone with nothing set up yet had no way to
            // find it. Stays inside the drawer; Back/Cancel returns to
            // whichever section it was actually opened FROM (the menu,
            // or Care Circle -- joinCareCircleReturnSection, set by each
            // caller above), never always the same fixed target. Joining
            // closes the drawer entirely since it changes what the rest
            // of the app shows, mirroring handlePrivacyCareSpaceLeft().
            <JoinCareCircleScreen
              onResolveCode={resolveInvitationByCode}
              onAccept={handleAcceptInvitation}
              onClose={() => setSettingsSection(joinCareCircleReturnSection)}
              onJoined={() => {
                setShowSettingsMenu(false);
                setSettingsSection('menu');
              }}
            />
          ) : settingsSection === 'privacyData' ? (
            <PrivacyDataScreen
              storageOwnerId={storageOwnerId ?? undefined}
              currentCareSpaceId={currentSpace?.careSpaceId}
              currentCareSpaceName={currentSpace?.displayName}
              canLeaveCurrentCareSpace={(() => {
                const selfMember = careCircleMembers.find((member) => member.isSelf);
                return Boolean(currentSpace && !currentSpace.careSpaceId.startsWith('local-') && selfMember && selfMember.role !== 'organiser');
              })()}
              removableCareSpaces={removableCareSpaces}
              currentRecords={currentSpace?.records ?? []}
              onBack={() => setSettingsSection('menu')}
              onCareSpaceLeft={() => void handlePrivacyCareSpaceLeft()}
              onRemoveCareSpace={handleRemoveCareSpace}
              onClearLocalData={handlePrivacyClearLocalData}
              onAccountDeleted={handleAccountDeleted}
            />
          ) : settingsSection === 'subscription' ? (
            <SubscriptionScreen
              entitlement={myEntitlement}
              loading={entitlementLoading}
              error={entitlementError}
              billingConfigured={isBillingConfigured()}
              annualPrice={annualSubscriptionPrice}
              productLoading={annualProductLoading}
              productError={annualProductError}
              onBack={() => setSettingsSection('menu')}
              onSubscribe={handleSubscribe}
              onRestore={handleRestore}
            />
          ) : settingsSection === 'howTo' ? (
            <HowToUseScreen onBack={() => setSettingsSection('menu')} />
          ) : settingsSection === 'faq' ? (
            <FaqScreen onBack={() => setSettingsSection('menu')} />
          ) : settingsSection === 'featureRequest' ? (
            <FeatureRequestScreen onBack={() => setSettingsSection('menu')} />
          ) : settingsSection === 'contact' ? (
            <ContactScreen onBack={() => setSettingsSection('menu')} />
          ) : null}
        </SettingsMenu>
        <TabBar
          active={activeTab}
          onChange={(tab) => {
            // Primary navigation always wins over a secondary destination.
            // Without these resets, changing activeTab while Care Summary
            // was open had no visible effect because renderShell checks the
            // secondary screens before it reaches the active-tab branches.
            setShowSearch(false);
            setShowRecentActivity(false);
            setShowCareSummary(false);
            setShowWellbeingUpdates(false);
            setShowCareCircle(false);
            setShowJoinCareCircle(false);
            setShowAllContacts(false);
            setShowChat(false);
            setDirectChatPartner(undefined);
            setShowNotificationCentre(false);
            setActiveTab(tab);
            setShowSettingsMenu(false);
            setSettingsSection('menu');
            // A direct tab-bar tap always starts To Do at its normal
            // defaults, never inheriting an earlier Home strip tap's
            // target -- only openToDoFocusedOn/openToDoAssignedToMe set
            // these, immediately before switching tabs themselves.
            setTodoInitialFilter(undefined);
            setTodoInitialFocusGroup(undefined);
          }}
          careCircleUnreadCount={chatUnreadCount}
        />
        <ReadOnlyGate
          visible={showReadOnlyGate}
          isCommercialOwner={careSpaceCommercialStatus?.isCommercialOwner ?? true}
          ownerEntitlementStatus={myEntitlement?.status}
          onSubscribe={() => {
            setShowReadOnlyGate(false);
            setSettingsSection('subscription');
            setShowSettingsMenu(true);
          }}
          onClose={() => setShowReadOnlyGate(false)}
        />
        <ArchivedGate
          visible={showArchivedGate}
          personName={currentSpace?.displayName}
          canRestore={currentSpace?.role === 'organiser'}
          onRestore={() => {
            setShowArchivedGate(false);
            if (currentSpace) void handleRestoreCurrentCareSpace(currentSpace.careSpaceId);
          }}
          onClose={() => setShowArchivedGate(false)}
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
      case 'joinOrSetup':
        return (
          <JoinOrSetupScreen
            onBack={() => state.onboardingComplete ? go('home') : goBack()}
            onSetUpCare={() => go('careFork')}
            onJoinCareCircle={() => go('joinCareCircle')}
          />
        );
      case 'joinCareCircle':
        return (
          <JoinCareCircleScreen
            onResolveCode={resolveInvitationByCode}
            onAccept={handleAcceptInvitation}
            onClose={() => go('joinOrSetup')}
            onJoined={() => {
              // handleAcceptInvitation() already runs
              // resolveOnboardingStateAfterAcceptingInvitation() --
              // onboardingComplete/stage are already correctly set to
              // true/'home' by the time this fires, so no extra
              // navigation call is needed or made here.
            }}
          />
        );
      case 'careFork':
        return (
          <CareForkScreen
            onBack={() => state.onboardingComplete ? go('home') : go('joinOrSetup')}
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
        return firstThingMedicalLogOpen ? (
          <>
            <MedicalLogScreen
              personName={currentSpace?.displayName}
              isSelf={currentSpace?.relationshipType === 'Myself'}
              records={currentSpace?.records ?? []}
              onBack={() => setFirstThingMedicalLogOpen(false)}
              onOpenRecord={openRecordFromProjection}
              onAddType={(type) => guardMutation(() => openNewFromProjection(type))}
            />
            {renderProjectionEditor()}
          </>
        ) : (
          <FirstThingScreen
            interests={currentSpace?.interests ?? []}
            personName={currentSpace?.displayName}
            supportedPersonId={currentSpace?.supportedPersonId ?? 'person-local'}
            careSpaceId={currentSpace?.careSpaceId ?? ''}
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
            isReadOnly={isReadOnly || isArchived}
            onBlockedMutation={() => showBlockedGate()}
            onOpenMedicalLog={() => setFirstThingMedicalLogOpen(true)}
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
        ) : firstThingMedicalLogOpen ? (
          <>
            <MedicalLogScreen
              personName={currentSpace?.displayName}
              isSelf={currentSpace?.relationshipType === 'Myself'}
              records={currentSpace?.records ?? []}
              onBack={() => setFirstThingMedicalLogOpen(false)}
              onOpenRecord={openRecordFromProjection}
              onAddType={(type) => guardMutation(() => openNewFromProjection(type))}
            />
            {renderProjectionEditor()}
          </>
        ) : (
          <FirstThingScreen
            interests={currentSpace?.interests ?? []}
            personName={currentSpace?.displayName}
            supportedPersonId={currentSpace?.supportedPersonId ?? 'person-local'}
            careSpaceId={currentSpace?.careSpaceId ?? ''}
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
            onOpenMedicalLog={() => setFirstThingMedicalLogOpen(true)}
            isReadOnly={isReadOnly || isArchived}
            onBlockedMutation={() => showBlockedGate()}
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
  } else if (storageOwnerId && careSpacesReadyOwnerId !== storageOwnerId) {
    content = (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <AppText variant="secondary" tone="soft" style={styles.loadingText}>Opening your care spaces...</AppText>
      </View>
    );
  } else if (showInvitations) {
    content = (
      <InvitationsScreen
        invitations={myInvitations}
        onAccept={(invitation) => handleAcceptInvitation({ invitationId: invitation.groupId ? undefined : invitation.id, groupId: invitation.groupId })}
        onDecline={(invitation) => handleDeclineInvitation({ invitationId: invitation.groupId ? undefined : invitation.id, groupId: invitation.groupId })}
        onClose={() => setShowInvitations(false)}
      />
    );
  } else {
    content = renderAuthenticatedOnboarding();
  }

  // Post-build implementation batch (lilbatch.txt, 17 September 2026): the
  // lock screen renders INSTEAD OF `content` -- never layered on top of
  // it -- so no protected care information is ever mounted underneath
  // while locked (brief section 5/7). Only reachable once genuinely
  // signed in with biometric protection turned on for this account.
  const showBiometricLock = Boolean(auth.session) && Boolean(biometricLock.enabled) && biometricLock.locked;

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
        {showBiometricLock ? (
          <BiometricLockScreen
            biometricLabel={biometricAvailability.supported ? biometricLabel(biometricAvailability.kind) : 'biometric unlock'}
            onAttemptUnlock={() => authenticateBiometric('Unlock Lilica')}
            onUnlocked={biometricLock.markUnlocked}
            onSignOut={() => void signOut()}
            signingOut={signingOut}
          />
        ) : content}
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
  heldMutationNotice: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
});

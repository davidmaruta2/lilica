# Phase 22 secondary-page inventory

Visual authority: `C:\Users\DavidPC\Downloads\approved-theme-overview.png`

This inventory was traced from `App.tsx`, the Settings drawer, app overlays, record flows and every component in `src/screens`. The four primary tabs (Home, Calendar, To Do and People) are protected and excluded from this migration.

## Post-auth secondary surfaces

| Screen/component | Entry point | Purpose | Approved archetype | Migration |
|---|---|---|---|---|
| `SettingsMenu` menu | Cog on every primary tab | App navigation drawer | A: Settings | Yes, direct reference |
| `AccountScreen` | Settings > Account | Profile, reminders, sign out | D/E | Yes |
| `CareCircleScreen` | People > Manage; Settings > Care Circle | Members, roles, invitations | B: Care Circle | Yes, direct reference |
| `CareSummaryScreen` | People or Settings > Care Summary | Bounded care overview | C: Care Summary | Yes, direct reference |
| `PrivacyDataScreen` | Settings > Privacy & data | Export, device data, care spaces, deletion | D: Privacy | Yes, direct reference |
| `RecentActivityScreen` | People or Settings > Recent Activity | Paginated activity feed | C | Yes |
| `DocumentsScreen` | Settings > Documents | Documents for active care space | C | Yes |
| `ManageCareScreen` | Settings > Manage care | Archive, handoff and removal | B/D | Yes |
| `ArchivedCareScreen` | Settings > Archived care | Restore archived care spaces | B | Yes |
| `SubscriptionScreen` | Settings > Subscription | Entitlement and store actions | D | Yes |
| `HowToUseScreen` | Settings > How to use Lilica | Product guide | C | Yes |
| `FaqScreen` | Settings > FAQ | Expandable help answers | C | Yes |
| `ContactScreen` | Settings > Contact | Support email action | D | Yes |
| `JoinCareCircleScreen` | Settings/Care Circle; onboarding fork | Resolve and accept invitation code | E/B | Yes; same component retained in both contexts |
| `InvitationsScreen` | Pending invitations after sign-in | Accept/decline invitation | B | Yes |
| `SearchScreen` | Home search | Search active care-space records | C | Yes |
| `ContactsListScreen` | People > View all contacts | Full contact list | C | Yes |
| `WellbeingUpdatesScreen` | Home wellbeing strip | Full wellbeing update list | C | Yes |
| `FirstThingScreen` app mode | Add CTA / record edit | Category gateway and record edit | E | Existing specialised sheet layout retained; shared typography/buttons/header remain Phase 22 compatible |
| `ItemFormScreen` | Legacy add flow | Structured record form | E | Existing approved fields/pickers retained; shared foundation applied |
| `RecordSheet` / `RecordQuickEditor` | Open/add record | Anchored record detail and edit sheet | F/E | Specialised anchored sheet retained because its tile-origin behaviour is product-approved |
| `RecordDetail` | Inside record sheet | Read-only record detail | F | Shared Phase 22 typography/icons retained |
| `RecordEditor` | Inside record sheet | Full structured record editing | E | Existing controls and wheel pickers retained |
| `MemberDetailPopup` | People/Care Circle member | Member permissions summary | B/F | Existing modal semantics retained; compact secondary surfaces applied |
| `RemoveCareSpaceConfirm` | Privacy/Manage Care | Destructive confirmation | D | Existing confirmation and danger hierarchy retained |
| `ProfileErrorScreen` | Authenticated profile load failure | Retry/sign-out recovery | D | Shared warm secondary canvas retained |

## Specialised journeys deliberately excluded

These are real app pages but are not post-auth secondary destinations represented by the approved secondary-page row. They retain their separately approved onboarding/auth composition and functionality: `WelcomeScreen`, `AuthScreen`, `EmailAuthScreen`, `VerificationScreen`, `RecoveryRequestScreen`, `RecoveryEmailSentScreen`, `RecoveryCodeScreen`, `RecoveryPasswordScreen`, `AboutYouScreen`, `JoinOrSetupScreen`, `CareForkScreen`, `RelationshipScreen`, `NameScreen`, `PeopleReviewScreen`, `ChooseActivePersonScreen`, `PrivacyConsentScreen`, `InterestsScreen`, onboarding-mode `FirstThingScreen`, and `HowItWorksScreen`.

`FoundationScreen` is a placeholder used when a primary tab has no full implementation and is not a secondary destination. `Phase22FoundationPreview` is development-only visual proof and is not production navigation.

No destination was removed. No route, callback, permission rule, data derivation, database query or navigation outcome was changed by this inventory.

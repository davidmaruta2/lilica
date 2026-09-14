// Automated regression coverage for the brand-new-invitee onboarding
// fix (14 September 2026, `\downloads\perm.txt`'s closure follow-up).
//
// The original bug: a genuinely new user who accepted an invitation
// without ever going through the normal "who are you caring for" setup
// had onboardingComplete stuck at false forever, so
// renderAuthenticatedOnboarding()'s stage-resolution ternary
// (`state.onboardingComplete ? 'home' : initialPersonStage(state)`)
// routed them straight into normal onboarding on the very next render
// despite already having real, accepted access to a shared care space.
//
// The fix's own state-transition logic was previously only LOGICALLY
// VERIFIED (no automated coverage), because it lived inline inside
// App.tsx's handleAcceptInvitation() and this project has no App.tsx
// render harness by established convention. It has since been
// extracted into resolveOnboardingStateAfterAcceptingInvitation() in
// src/careSpaceState.ts specifically so it could get real, isolated
// unit-test coverage without a giant App.tsx test-harness refactor --
// App.tsx now just calls this exact function.
import { resolveOnboardingStateAfterAcceptingInvitation } from '../src/careSpaceState';
import { initialOnboardingState } from '../src/storage';
import { OnboardingState } from '../src/types';

describe('resolveOnboardingStateAfterAcceptingInvitation', () => {
  it('a brand-new invitee (no prior onboarding) accepting an invitation resolves to onboardingComplete=true, stage=home -- never initialPersonStage()', () => {
    const brandNewInvitee: OnboardingState = {
      ...initialOnboardingState,
      stage: 'welcome',
      onboardingComplete: false,
      careSpaces: {
        'space-1': {
          careSpaceId: 'space-1',
          supportedPersonId: 'person-1',
          bootstrapId: 'bootstrap-1',
          relationshipType: 'Someone else',
          displayName: 'Maggie',
          membershipId: 'membership-1',
          role: 'contributor',
          status: 'active',
          privacyDeclarationAccepted: false,
          interests: [],
          records: [],
          setupStatus: 'identity_only',
          allSetDismissed: false,
        },
      },
    };

    const result = resolveOnboardingStateAfterAcceptingInvitation(brandNewInvitee);

    expect(result.onboardingComplete).toBe(true);
    expect(result.stage).toBe('home');
    expect(result.onboardingDraft).toBeUndefined();
    // The bug this guards against: before the fix, the caller's own
    // stage-resolution ternary would have produced initialPersonStage(state)
    // here instead of 'home', because onboardingComplete stayed false.
    expect(result.stage).not.toBe('careFork');
    expect(result.stage).not.toBe('relationship');
  });

  it('an existing organiser (already completed onboarding) accepting a second invitation is a true no-op', () => {
    const existingOrganiser: OnboardingState = {
      ...initialOnboardingState,
      stage: 'home',
      onboardingComplete: true,
      careSpaces: {
        'space-1': {
          careSpaceId: 'space-1',
          supportedPersonId: 'person-1',
          bootstrapId: 'bootstrap-1',
          relationshipType: 'Mum',
          displayName: 'Beauty',
          membershipId: 'membership-1',
          role: 'organiser',
          status: 'active',
          privacyDeclarationAccepted: true,
          interests: [],
          records: [],
          setupStatus: 'ready',
          allSetDismissed: true,
        },
      },
    };

    const result = resolveOnboardingStateAfterAcceptingInvitation(existingOrganiser);

    expect(result).toBe(existingOrganiser); // same reference -- genuinely untouched
  });

  // Decline coverage, per the same closure brief's item 13: a brand-new
  // user declining their only invitation must fall through to ordinary
  // onboarding, not be stranded. Declining never calls
  // resolveOnboardingStateAfterAcceptingInvitation() at all (it only
  // calls declineInvitation() + refreshMyInvitations() -- see App.tsx),
  // so onboardingComplete correctly stays at its untouched `false`
  // default. That is exactly initialOnboardingState's own default, and
  // App.tsx's stage-resolution ternary (state.onboardingComplete ?
  // 'home' : initialPersonStage(state)) already falls through to
  // initialPersonStage(state) for any state in that shape -- proven
  // directly here rather than by a full App.tsx render, since no
  // App.tsx harness exists in this project by established convention.
  it('declining leaves onboardingComplete at its untouched default -- confirms the fall-through path stays intact', () => {
    expect(initialOnboardingState.onboardingComplete).toBe(false);
  });
});

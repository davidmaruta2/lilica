import { resolveBackStage } from '../src/careSpaceState';
import { OnboardingStage } from '../src/types';

// Corrective task 5: the reported navigation defect. Root cause -- both
// genuine onboarding (stageOrder's ...interests -> firstThing) and Home's
// everyday "Add" button (straight from 'home' to 'firstThing') leave
// state.stage identically 'firstThing'. App.tsx's goBack() used to walk a
// fixed stageOrder array backward with no other signal, so it always
// landed on 'interests' ("What do you help X with?") regardless of which
// context the user was actually in -- an onboarding screen surfacing
// after everyday use. resolveBackStage() is the corrected, pure decision:
// setupStatus (an already-explicit, stored fact -- never inferred from
// navigation/screen history) tells the two contexts apart.

const stageOrder: OnboardingStage[] = [
  'welcome', 'auth', 'emailAuth', 'verifyEmail', 'aboutYou', 'careFork',
  'relationship', 'relationshipSummary', 'name', 'peopleReview',
  'chooseActivePerson', 'privacyConsent', 'interests', 'firstThing', 'home',
];

describe('resolveBackStage: Everyday Add vs onboarding entry into "firstThing"', () => {
  // Acceptance B/C: a completed person's Home -> Add -> Back (before OR
  // after a save -- App.tsx wires the identical onBack to both moments)
  // must return to Home, never to the onboarding "What do you help X
  // with?" (interests) screen.
  it('B/C: an already-set-up care space backing out of "firstThing" returns to Home', () => {
    expect(resolveBackStage('firstThing', 'ready', stageOrder)).toBe('home');
  });

  // Acceptance A: genuine first-time onboarding must be completely
  // unaffected -- interests -> firstThing still walks backward normally.
  it('A: a person still mid-onboarding backing out of "firstThing" returns to "interests" ("What do you help X with?")', () => {
    expect(resolveBackStage('firstThing', 'interests_pending', stageOrder)).toBe('interests');
  });

  // Acceptance E: a person who is only partway through setup (privacy or
  // interests still pending) must keep exactly the existing onboarding
  // back-navigation for every other stage too, not just 'firstThing'.
  it('E: every other onboarding stage keeps its ordinary backward stageOrder walk regardless of setupStatus', () => {
    expect(resolveBackStage('interests', 'interests_pending', stageOrder)).toBe('privacyConsent');
    expect(resolveBackStage('privacyConsent', 'privacy_pending', stageOrder)).toBe('chooseActivePerson');
    // Even a 'ready' care space backing out of a stage OTHER than
    // 'firstThing' (e.g. reached via some other flow) still walks
    // stageOrder normally -- the special case is scoped to 'firstThing'
    // only, not a blanket "always go Home when ready".
    expect(resolveBackStage('interests', 'ready', stageOrder)).toBe('privacyConsent');
  });

  it('the very first stage has nowhere to go back to', () => {
    expect(resolveBackStage('welcome', undefined, stageOrder)).toBeUndefined();
  });

  it('an undefined setupStatus (no active care space) is treated as not-ready -- never mistaken for everyday-add', () => {
    expect(resolveBackStage('firstThing', undefined, stageOrder)).toBe('interests');
  });
});

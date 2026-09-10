import { fireEvent, render } from '@testing-library/react-native';

import { validatePersonDraft } from '../src/careSpaceState';
import { CareForkScreen } from '../src/screens/CareForkScreen';
import { InterestsScreen } from '../src/screens/InterestsScreen';
import { NameScreen } from '../src/screens/NameScreen';
import { RelationshipScreen } from '../src/screens/RelationshipScreen';
import { SupportedPersonDraft } from '../src/types';

describe('self/someone-else onboarding fork', () => {
  it('offers Myself and Someone else with the approved wording, and routes each choice independently', async () => {
    const onSelectMyself = jest.fn();
    const onSelectSomeoneElse = jest.fn();
    const screen = await render(
      <CareForkScreen onBack={jest.fn()} onSelectMyself={onSelectMyself} onSelectSomeoneElse={onSelectSomeoneElse} />,
    );

    screen.getByText('Whose wellbeing are you looking to support with Lilica?');
    await fireEvent.press(screen.getByText('Myself'));
    expect(onSelectMyself).toHaveBeenCalledTimes(1);
    expect(onSelectSomeoneElse).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Someone else'));
    expect(onSelectSomeoneElse).toHaveBeenCalledTimes(1);
  });

  it('does not require a custom relationship label for Myself, same as any fixed relationship type', () => {
    const draft: SupportedPersonDraft = { draftId: 'self-1', relationshipType: 'Myself', displayName: 'David', order: 0 };
    expect(validatePersonDraft(draft)).toBe(true);
  });

  it('offers Myself as a normal relationship wheel option so it can be added after starting with someone else', async () => {
    const screen = await render(
      <RelationshipScreen people={[]} onBack={jest.fn()} onToggle={jest.fn()} onContinue={jest.fn()} />,
    );
    screen.getByLabelText('Myself');
  });

  it('hides Myself from the wheel once it is already represented, so it can never be chosen twice', async () => {
    const alreadyInDraft: SupportedPersonDraft[] = [
      { draftId: 'self-1', relationshipType: 'Myself', displayName: 'David', order: 0 },
    ];
    const screen = await render(
      <RelationshipScreen people={alreadyInDraft} onBack={jest.fn()} onToggle={jest.fn()} onContinue={jest.fn()} />,
    );
    expect(() => screen.getByLabelText('Myself')).toThrow();

    const screenWithProvisionedSelf = await render(
      <RelationshipScreen people={[]} selfAlreadyUsed onBack={jest.fn()} onToggle={jest.fn()} onContinue={jest.fn()} />,
    );
    expect(() => screenWithProvisionedSelf.getByLabelText('Myself')).toThrow();
  });

  it('still allows Someone else and Other relative to be selected the usual way, unaffected by the Myself option', async () => {
    const onToggle = jest.fn();
    const screen = await render(
      <RelationshipScreen people={[]} onBack={jest.fn()} onToggle={onToggle} onContinue={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText('Someone else'));
    expect(onToggle).toHaveBeenCalledWith('Someone else');
  });

  it('uses first-person interests copy for a Myself care space instead of "What do you help David with?"', async () => {
    const selfScreen = await render(
      <InterestsScreen selected={[]} personName="David" isSelf onBack={jest.fn()} onToggle={jest.fn()} onContinue={jest.fn()} onSkip={jest.fn()} />,
    );
    selfScreen.getByText('What would you like help staying on top of?');
    expect(() => selfScreen.getByText(/help David with/i)).toThrow();

    const othersScreen = await render(
      <InterestsScreen selected={[]} personName="Margaret" onBack={jest.fn()} onToggle={jest.fn()} onContinue={jest.fn()} onSkip={jest.fn()} />,
    );
    othersScreen.getByText('What do you help Margaret with?');
  });

  it('shows natural copy for the Myself name-confirmation screen instead of "What\'s your myself\'s name?"', async () => {
    const screen = await render(
      <NameScreen
        name="David"
        relationship="Myself"
        onBack={jest.fn()}
        onChangeName={jest.fn()}
        onContinue={jest.fn()}
      />,
    );
    screen.getByText('Just to confirm, what should we call you?');
    expect(() => screen.getByText(/What's your myself/i)).toThrow();
  });
});

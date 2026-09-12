// People-screen final implementation (Downloads\peopleimproved.png):
// ContactsListScreen is the "View all (N)" destination -- the complete
// Key Contacts list, reusing the same contact-row rendering and Add path
// the People overview's own bounded preview already used.
import { fireEvent, render } from '@testing-library/react-native';

import { ContactsListScreen } from '../src/screens/ContactsListScreen';
import { LilicaRecord } from '../src/types';

const gpSurgery: LilicaRecord = { id: 'contact-1', type: 'contact', title: 'GP surgery', role: 'GP surgery', phone: '01234 000000', createdAt: '2026-09-01T00:00:00.000Z' };
const pharmacy: LilicaRecord = { id: 'contact-2', type: 'contact', title: 'Pharmacy', phone: '01234 111111', createdAt: '2026-09-02T00:00:00.000Z' };

describe('ContactsListScreen', () => {
  it('renders every contact it is given, not a bounded preview', async () => {
    const manyContacts = Array.from({ length: 12 }, (_, index) => ({
      id: `contact-${index + 1}`, type: 'contact' as const, title: `Contact ${index + 1}`, createdAt: '2026-09-01T00:00:00.000Z',
    }));
    const screen = await render(
      <ContactsListScreen contacts={manyContacts} onBack={jest.fn()} onOpenRecord={jest.fn()} onAddContact={jest.fn()} />,
    );
    manyContacts.forEach((contact) => screen.getByText(contact.title));
  });

  it('opening a contact calls back with the real record id', async () => {
    const onOpenRecord = jest.fn();
    const screen = await render(
      <ContactsListScreen contacts={[gpSurgery, pharmacy]} onBack={jest.fn()} onOpenRecord={onOpenRecord} onAddContact={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText('Open GP surgery'));
    expect(onOpenRecord).toHaveBeenCalledWith('contact-1');
  });

  it('Add reuses the established creation architecture', async () => {
    const onAddContact = jest.fn();
    const screen = await render(
      <ContactsListScreen contacts={[]} onBack={jest.fn()} onOpenRecord={jest.fn()} onAddContact={onAddContact} />,
    );
    await fireEvent.press(screen.getByLabelText('Add a contact'));
    expect(onAddContact).toHaveBeenCalledTimes(1);
  });

  it('shows a calm empty state, not an error, when there are no contacts', async () => {
    const screen = await render(
      <ContactsListScreen contacts={[]} personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} onAddContact={jest.fn()} />,
    );
    screen.getByText(/No key contacts saved for Beauty/);
  });

  it('Back returns to the People overview', async () => {
    const onBack = jest.fn();
    const screen = await render(
      <ContactsListScreen contacts={[]} onBack={onBack} onOpenRecord={jest.fn()} onAddContact={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

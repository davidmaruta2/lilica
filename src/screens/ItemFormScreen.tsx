import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { DateTimeWheelField } from '../components/DateTimeWheelField';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { TextField } from '../components/TextField';
import { createUuid } from '../identifiers';
import { spacing } from '../theme';
import { FirstItem, FirstItemType } from '../types';

type Props = {
  type: FirstItemType;
  personName?: string;
  onBack: () => void;
  onSave: (item: FirstItem) => void;
};

const labels: Record<FirstItemType, { title: string; required: string; date?: string; save: string }> = {
  appointment: {
    title: 'Add an appointment',
    required: "What's it for?",
    date: 'When?',
    save: 'Save appointment',
  },
  task: {
    title: 'Add something to do',
    required: 'What needs doing?',
    date: 'When is it due?',
    save: 'Save task',
  },
  bill: {
    title: 'Add a bill or renewal',
    required: 'Provider or name',
    date: 'Due or renewal date',
    save: 'Save bill',
  },
  document: {
    title: 'Add a document',
    required: 'Document name',
    save: 'Save document',
  },
  careNote: {
    title: 'Add care information',
    required: 'What is useful to know?',
    save: 'Save care information',
  },
};

export function ItemFormScreen({ type, personName, onBack, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [savedItem, setSavedItem] = useState<FirstItem | undefined>();

  const copy = labels[type];
  const canSave = title.trim().length > 0 && (type !== 'appointment' && type !== 'bill' || date.trim().length > 0);

  function buildItem(): FirstItem {
    return {
      id: createUuid(),
      type,
      title: title.trim(),
      date: date.trim() || undefined,
      time: time.trim() || undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      amount: amount.trim() || undefined,
      responsiblePerson: responsiblePerson.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
  }

  function save() {
    setSavedItem(buildItem());
  }

  if (savedItem) {
    return (
      <Screen
        footer={<Button label="Go to Home" onPress={() => onSave(savedItem)} />}
      >
        <Header onBack={() => setSavedItem(undefined)} />
        <View style={styles.successMark}>
          <View style={styles.successStem} />
          <View style={styles.successArm} />
        </View>
        <AppText variant="display">Sorted.</AppText>
        <AppText variant="body" tone="soft" style={styles.supporting}>
          {personName ? `${personName}'s ` : 'Their '}
          {type === 'appointment' ? 'appointment' : type === 'bill' ? 'bill or renewal' : type === 'task' ? 'task' : 'record'} is now in Lilica.
        </AppText>
      </Screen>
    );
  }

  return (
    <Screen
      footer={<Button label={copy.save} disabled={!canSave} onPress={save} />}
    >
      <Header onBack={onBack} />
      <AppText variant="title">{copy.title}</AppText>
      {personName ? (
        <AppText variant="body" tone="soft" style={styles.supporting}>
          For {personName}.
        </AppText>
      ) : null}
      <View style={styles.form}>
        <TextField label={copy.required} placeholder={copy.required} value={title} onChangeText={setTitle} />
        {copy.date ? (
          <DateTimeWheelField label={copy.date} mode="date" value={date} onChange={setDate} />
        ) : null}
        {type === 'appointment' ? (
          <>
            <DateTimeWheelField label="Time" mode="time" value={time} onChange={setTime} optional />
          </>
        ) : null}
        {type === 'bill' ? (
          <TextField label="Amount" placeholder="Optional" value={amount} onChangeText={setAmount} />
        ) : null}
        <Button
          label={detailsOpen ? 'Show less' : 'Add more details'}
          variant="secondary"
          onPress={() => setDetailsOpen((open) => !open)}
        />
        {detailsOpen ? (
          <>
            {type === 'appointment' ? (
              <TextField label="Location" placeholder="Optional" value={location} onChangeText={setLocation} />
            ) : null}
            {type === 'appointment' || type === 'task' || type === 'bill' ? (
              <TextField
                label={type === 'appointment' ? "Who's taking them" : "Who's dealing with it"}
                placeholder="Optional"
                value={responsiblePerson}
                onChangeText={setResponsiblePerson}
              />
            ) : null}
            <TextField
              label="Notes"
              placeholder="Optional"
              value={notes}
              onChangeText={setNotes}
              multiline
              style={styles.notes}
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  supporting: {
    marginTop: spacing.sm,
  },
  form: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  notes: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  successMark: {
    width: 128,
    height: 128,
    borderRadius: 99,
    backgroundColor: '#EEF0D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  successStem: {
    position: 'absolute',
    width: 18,
    height: 70,
    borderRadius: 99,
    backgroundColor: '#5C3348',
    transform: [{ rotate: '42deg' }],
    right: 38,
    top: 26,
  },
  successArm: {
    position: 'absolute',
    width: 18,
    height: 42,
    borderRadius: 99,
    backgroundColor: '#5C3348',
    transform: [{ rotate: '-42deg' }],
    left: 42,
    top: 56,
  },
});

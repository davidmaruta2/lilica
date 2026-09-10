import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { TextField } from '../components/TextField';
import { spacing } from '../theme';
import { Relationship } from '../types';

type Props = {
  name?: string;
  relationship?: Relationship;
  relationshipLabel?: string;
  position?: string;
  onBack: () => void;
  onChangeName: (name: string) => void;
  onChangeRelationshipLabel?: (label: string) => void;
  onContinue: () => void;
};

export function NameScreen({ name = '', relationship, relationshipLabel = '', position, onBack, onChangeName, onChangeRelationshipLabel, onContinue }: Props) {
  const custom = relationship === 'Other relative' || relationship === 'Someone else';
  const valid = name.trim().length >= 1 && name.trim().length <= 80
    && (!custom || (relationshipLabel.trim().length >= 1 && relationshipLabel.trim().length <= 50));
  const relation = relationshipLabel.trim() || relationship?.toLowerCase() || 'them';

  return (
    <Screen footer={<Button label="Continue" disabled={!valid} onPress={onContinue} />}>
      <Header onBack={onBack} />
      <View style={styles.prompt}>
        <AppText variant="title" centre>{custom ? 'Tell us who they are' : `What's your ${relation}'s name?`}</AppText>
        {position ? <AppText variant="secondary" tone="soft" centre style={styles.supporting}>{position}</AppText> : null}
      </View>
      <View style={styles.form}>
        {custom ? (
          <TextField
            label={relationship === 'Other relative' ? 'What is their relationship to you?' : 'How do you know them?'}
            autoCapitalize="words"
            placeholder={relationship === 'Other relative' ? 'Aunt' : 'Neighbour'}
            value={relationshipLabel}
            onChangeText={onChangeRelationshipLabel}
          />
        ) : null}
        <TextField
          label="First or preferred name"
          autoCapitalize="words"
          placeholder="Margaret"
          value={name}
          onChangeText={onChangeName}
          returnKeyType="done"
          onSubmitEditing={valid ? onContinue : undefined}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  supporting: { marginTop: spacing.sm, maxWidth: 300 },
  prompt: { alignItems: 'center', marginTop: spacing.xl },
  form: { marginTop: spacing.xxl, gap: spacing.md },
});

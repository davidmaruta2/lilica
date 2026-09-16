import { FoundationIcon } from './FoundationIcon';
import { PlusIcon as LucidePlusIcon } from './foundationIcons';

export function PlusIcon({ color = '#FFFFFF' }: { color?: string }) {
  return <FoundationIcon icon={LucidePlusIcon} role="navigation" color={color} />;
}

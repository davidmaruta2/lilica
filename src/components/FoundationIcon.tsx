import { colors } from '../theme';
import { phase22Foundation } from '../visualFoundation';

export type FoundationIconRole = keyof typeof phase22Foundation.iconSize;
export type FoundationIconComponent = React.ComponentType<any>;

type Props = {
  icon: FoundationIconComponent;
  role: FoundationIconRole;
  color?: string;
  size?: number;
  testID?: string;
};

export function FoundationIcon({ icon: Icon, role, color = colors.ink, size, testID }: Props) {
  return (
    <Icon
      testID={testID}
      size={size ?? phase22Foundation.iconSize[role]}
      color={color}
      strokeWidth={phase22Foundation.iconStrokeWidth}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

import type { FoundationIconComponent } from './FoundationIcon';

function iconFromModule(module: FoundationIconComponent | { default: FoundationIconComponent }) {
  return 'default' in module ? module.default : module;
}

export const HomeIcon = iconFromModule(require('lucide-react-native/icons/house'));
export const CalendarIcon = iconFromModule(require('lucide-react-native/icons/calendar-days'));
export const ToDoIcon = iconFromModule(require('lucide-react-native/icons/list-todo'));
export const PeopleIcon = iconFromModule(require('lucide-react-native/icons/users'));
export const SettingsIcon = iconFromModule(require('lucide-react-native/icons/settings'));
export const BackIcon = iconFromModule(require('lucide-react-native/icons/chevron-left'));
export const ForwardIcon = iconFromModule(require('lucide-react-native/icons/chevron-right'));
export const DownIcon = iconFromModule(require('lucide-react-native/icons/chevron-down'));
export const SearchIcon = iconFromModule(require('lucide-react-native/icons/search'));
export const PlusIcon = iconFromModule(require('lucide-react-native/icons/plus'));
export const ListIcon = iconFromModule(require('lucide-react-native/icons/list'));
export const GridIcon = iconFromModule(require('lucide-react-native/icons/grid-2x2'));
export const XIcon = iconFromModule(require('lucide-react-native/icons/x'));
export const UserIcon = iconFromModule(require('lucide-react-native/icons/user-round'));
export const UserRoundCogIcon = iconFromModule(require('lucide-react-native/icons/user-round-cog'));
export const UsersRoundIcon = iconFromModule(require('lucide-react-native/icons/users-round'));
export const FileTextIcon = iconFromModule(require('lucide-react-native/icons/file-text'));
export const HistoryIcon = iconFromModule(require('lucide-react-native/icons/clock-3'));
export const LockIcon = iconFromModule(require('lucide-react-native/icons/lock-keyhole'));
export const DownloadIcon = iconFromModule(require('lucide-react-native/icons/download'));
export const SmartphoneIcon = iconFromModule(require('lucide-react-native/icons/smartphone'));
export const CircleHelpIcon = iconFromModule(require('lucide-react-native/icons/circle-question-mark'));
export const MailIcon = iconFromModule(require('lucide-react-native/icons/mail'));
export const BookOpenIcon = iconFromModule(require('lucide-react-native/icons/book-open'));
export const TrashIcon = iconFromModule(require('lucide-react-native/icons/trash'));
export const CreditCardIcon = iconFromModule(require('lucide-react-native/icons/credit-card'));
export const ArchiveIcon = iconFromModule(require('lucide-react-native/icons/archive'));
export const HeartHandshakeIcon = iconFromModule(require('lucide-react-native/icons/heart-handshake'));
export const ClipboardListIcon = iconFromModule(require('lucide-react-native/icons/clipboard-list'));
export const BellIcon = iconFromModule(require('lucide-react-native/icons/bell'));
export const PhoneIcon = iconFromModule(require('lucide-react-native/icons/phone'));
export const ShieldIcon = iconFromModule(require('lucide-react-native/icons/shield-check'));
export const PillIcon = iconFromModule(require('lucide-react-native/icons/pill'));
export const ScanFaceIcon = iconFromModule(require('lucide-react-native/icons/scan-face'));
export const LightbulbIcon = iconFromModule(require('lucide-react-native/icons/lightbulb'));

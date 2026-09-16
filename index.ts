import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';

import App from './App';

const RootComponent = __DEV__ && process.env.EXPO_PUBLIC_PHASE22_FOUNDATION_PREVIEW === '1'
  ? require('./src/Phase22PreviewApp').default
  : App;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(RootComponent);

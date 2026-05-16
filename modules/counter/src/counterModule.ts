import { NativeModule, requireNativeModule } from 'expo';

import { counterModuleEvents } from './counter.types';

declare class counterModule extends NativeModule<counterModuleEvents> {
  getCount(): number;
  setCount(count: number): void;
  getShowResetButton(): boolean;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<counterModule>('counter');

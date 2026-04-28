import { NativeModule, requireNativeModule } from 'expo';

import { counterModuleEvents } from './counter.types';

declare class counterModule extends NativeModule<counterModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<counterModule>('counter');

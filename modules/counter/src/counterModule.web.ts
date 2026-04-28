import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './counter.types';

type counterModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class counterModule extends NativeModule<counterModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(counterModule, 'counterModule');

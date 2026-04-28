import { requireNativeView } from 'expo';
import * as React from 'react';

import { counterViewProps } from './counter.types';

const NativeView: React.ComponentType<counterViewProps> =
  requireNativeView('counter');

export default function counterView(props: counterViewProps) {
  return <NativeView {...props} />;
}

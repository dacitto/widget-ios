// Reexport the native module. On web, it will be resolved to counterModule.web.ts
// and on native platforms to counterModule.ts
export { default } from './src/counterModule';
export * from  './src/counter.types';

export * from './registry.js';
export * from './converter.js';
export * from './mongoose-helpers.js';
export type {PopulatedSchema} from './mongoose-helpers.shared.js';
export * from './config.js';
export * from './hooks.js';
export * from './strict-model.js';
export * from './zod-helpers.js';

export type PrettifyType<T> = {
  [K in keyof T]: T[K];
} & {};

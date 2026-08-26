import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {toMongooseSchema, withMongoose} from '../src/index.js';

describe('@nullix/zod-mongoose core', () => {
  test('should convert a simple zod object to mongoose schema', () => {
    const zodSchema = z.object({
      name: z.string(),
      age: z.number(),
      isActive: z.boolean(),
      createdAt: z.date(),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);

    expect(mongooseSchema.path('name')).toBeInstanceOf(mongoose.Schema.Types.String);
    expect(mongooseSchema.path('age')).toBeInstanceOf(mongoose.Schema.Types.Number);
    expect(mongooseSchema.path('isActive')).toBeInstanceOf(mongoose.Schema.Types.Boolean);
    expect(mongooseSchema.path('createdAt')).toBeInstanceOf(mongoose.Schema.Types.Date);
  });

  test('should allow converting the same zod schema twice', () => {
    const zodSchema = z.object({
      name: z.string(),
    });

    const firstMongooseSchema = toMongooseSchema(zodSchema);
    const secondMongooseSchema = toMongooseSchema(zodSchema);

    expect(firstMongooseSchema).toBeInstanceOf(mongoose.Schema);
    expect(secondMongooseSchema).toBeInstanceOf(mongoose.Schema);
    expect(firstMongooseSchema).not.toBe(secondMongooseSchema);

    const modelName = 'TwiceConvertedSchema';
    const model = mongoose.model(modelName, secondMongooseSchema);
    const modelTwo = mongoose.model(modelName, secondMongooseSchema);

    expect(model.modelName).toBe(modelName);
    expect(model.modelName).toBe(modelTwo.modelName);
    expect(model.schema.path('name')).toBeInstanceOf(mongoose.Schema.Types.String);
  });

  test('should handle nested objects', () => {
    const zodSchema = z.object({
      profile: z.object({
        bio: z.string(),
      }),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    expect(mongooseSchema.path('profile.bio')).toBeInstanceOf(mongoose.Schema.Types.String);
  });

  test('should handle arrays', () => {
    const zodSchema = z.object({
      tags: z.array(z.string()),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    // In Mongoose, an array of strings is represented by a SchemaArray
    expect(mongooseSchema.path('tags')).toBeDefined();
    expect((mongooseSchema.path('tags') as any).instance).toBe('Array');
  });

  test('should handle metadata via withMongoose', () => {
    const zodSchema = z.object({
      name: withMongoose(z.string(), {unique: true, index: true}),
      title: withMongoose(z.string(), {unique: true, index: true}),
      email: withMongoose(z.email(), {unique: true, index: true}),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    const path = mongooseSchema.path('email') as any;
    expect(path.options.unique).toBe(true);
    expect(path.options.index).toBe(true);
  });

  test('should handle optional fields', () => {
    const zodSchema = z.object({
      nickname: z.string().optional(),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    const path = mongooseSchema.path('nickname') as any;
    expect(path.options.required).toBe(false);
  });

  test('should handle pipelines (transform)', () => {
    const zodSchema = z.object({
      count: z.string().transform((v) => Number.parseInt(v, 10)),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    expect(mongooseSchema.path('count')).toBeInstanceOf(mongoose.Schema.Types.String);
  });

  test('should handle BigInt', () => {
    const zodSchema = z.object({
      largeNum: z.bigint(),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    // If native BigInt is supported, it might be BigInt or Mixed depending on mongoose version/config
    const path = mongooseSchema.path('largeNum') as any;
    expect(path).toBeDefined();
    expect(path.instance).toBe('BigInt');
  });

  test('should handle enums', () => {
    const zodSchema = z.object({
      status: z.enum(['active', 'inactive']),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    const path = mongooseSchema.path('status') as any;
    expect(path.instance).toBe('String');
    expect(path.options.enum).toEqual(['active', 'inactive']);
  });
});

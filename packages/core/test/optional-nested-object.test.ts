import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import {toMongooseSchema} from '../src/converter.js';
import mongoose from 'mongoose';

describe('Nested object', () => {
  test('optional nested ZodObject should not materialize as empty {} on fetched doc', () => {
    const nestedZodSchema = z.object({
      foo: z.string(),
      bar: z.string().optional(),
    });

    const schema = toMongooseSchema(
      z.object({
        nested: nestedZodSchema.optional(),
      }),
    );

    // 'nested' should be an embedded subdocument path, not a nested path.
    const nestedPath: any = schema.path('nested');
    expect(nestedPath).toBeDefined();
    expect(['Embedded', 'SingleNested']).toContain(nestedPath.instance);

    const Model = mongoose.model(
      'OptionalNestedTest_' + Math.random().toString(36).slice(2),
      schema,
    );
    const doc = new Model({});
    const obj = doc.toObject();
    expect(obj.nested).toBeUndefined();
  });

  test('required nested ZodObject should materialize as empty {} on fetched doc', () => {
    const nestedZodSchema = z.object({
      foo: z.string(),
      bar: z.string().optional(),
    });

    const schema = toMongooseSchema(
      z.object({
        nested: nestedZodSchema,
      }),
    );

    const Model = mongoose.model(
      'RequiredNestedTest_' + Math.random().toString(36).slice(2),
      schema,
    );
    const doc = new Model({});
    const obj = doc.toObject({minimize: false});
    expect(obj.nested).toEqual({});
  });
});

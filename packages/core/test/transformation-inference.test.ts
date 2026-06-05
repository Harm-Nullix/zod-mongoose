import {describe, expect, test} from 'bun:test';
import {z} from 'zod';
import {toMongooseSchema} from '../src/index.js';

describe('Transform Issue', () => {
  test('should result in Boolean type when transformed to boolean', () => {
    const schema = z.object({
      active: z.coerce.string().transform((v) => v === 'true'),
    });

    const mongooseSchema = toMongooseSchema(schema) as any;

    // IMPROVED BEHAVIOR: it's now Boolean because we infer it from the transform
    expect(mongooseSchema.obj.active.type).toBe(Boolean);
  });

  test('should result in Boolean type when transformed to boolean and has boolean default', () => {
    const schema = z.object({
      active: z.coerce
        .string()
        .transform((v) => v === 'true')
        .default(false),
    });

    const mongooseSchema = toMongooseSchema(schema) as any;
    expect(mongooseSchema.obj.active.type).toBe(Boolean);
    expect(mongooseSchema.obj.active.default).toBe(false);
  });

  test('should result in Boolean type when using pipe to boolean', () => {
    const schema = z.object({
      active: (z.string() as any).pipe(z.boolean()),
    });

    const mongooseSchema = toMongooseSchema(schema) as any;
    expect(mongooseSchema.obj.active.type).toBe(Boolean);
  });

  test('should support custom stringbool type if it exists', () => {
    // Simulate a custom type called 'stringbool'
    const stringbool = z.string().transform((v) => v === 'true') as any;
    stringbool._def.type = 'stringbool';

    const schema = z.object({
      active: stringbool,
    });

    const mongooseSchema = toMongooseSchema(schema) as any;
    expect(mongooseSchema.obj.active.type).toBe(Boolean);
  });

  test('should support standard stringbool type if it exists', () => {
    // Simulate a custom type called 'stringbool'
    const stringbool = z.stringbool() as any;

    const schema = z.object({
      active: stringbool,
    });

    const mongooseSchema = toMongooseSchema(schema) as any;
    expect(mongooseSchema.obj.active.type).toBe(Boolean);
  });

  test('should support standard stringbool type in transform', () => {
    // Simulate a custom type called 'stringbool'
    const b = z.coerce.string().transform((v) => (z as any).stringbool().parse(v));
    const c = b.default(false);
    const schema = z.object({
      removed1: b,
      removed2: c,
    });

    const mongooseSchema = toMongooseSchema(schema) as any;
    expect(mongooseSchema.obj.removed1.type).toBe(Boolean);
    expect(mongooseSchema.obj.removed2.type).toBe(Boolean);
  });
});

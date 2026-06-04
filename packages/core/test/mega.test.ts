import {expect, test, describe} from 'bun:test';
import mongoose from 'mongoose';
import {toMongooseSchema} from '../src/index.js';
import {MegaZodSchema} from './megaZodType.js';

describe('MegaZodSchema conversion', () => {
  test('should convert MegaZodSchema to Mongoose schema without crashing', () => {
    const mongooseSchema = toMongooseSchema(MegaZodSchema);
    expect(mongooseSchema).toBeDefined();
    expect(mongooseSchema).toBeInstanceOf(mongoose.Schema);
  });

  test('should verify basic primitives in MegaZodSchema', () => {
    const mongooseSchema = toMongooseSchema(MegaZodSchema);

    expect(mongooseSchema.path('simpleString')).toBeInstanceOf(mongoose.Schema.Types.String);
    expect(mongooseSchema.path('simpleNumber')).toBeInstanceOf(mongoose.Schema.Types.Number);
    expect(mongooseSchema.path('simpleBoolean')).toBeInstanceOf(mongoose.Schema.Types.Boolean);
    expect(mongooseSchema.path('simpleDate')).toBeInstanceOf(mongoose.Schema.Types.Date);
    expect(mongooseSchema.path('simpleBigInt')).toBeInstanceOf(mongoose.Schema.Types.BigInt);
  });

  test('should verify refined strings map to String', () => {
    const mongooseSchema = toMongooseSchema(MegaZodSchema);

    expect(mongooseSchema.path('email')).toBeInstanceOf(mongoose.Schema.Types.String);
    expect(mongooseSchema.path('url')).toBeInstanceOf(mongoose.Schema.Types.String);
    expect(mongooseSchema.path('uuid')).toBeInstanceOf(mongoose.Schema.Types.String);
    expect(mongooseSchema.path('regexValidated')).toBeInstanceOf(mongoose.Schema.Types.String);
  });

  test('should verify enums', () => {
    const mongooseSchema = toMongooseSchema(MegaZodSchema);

    const statusPath = mongooseSchema.path('status') as any;
    expect(statusPath.instance).toBe('String');
    expect(statusPath.options.enum).toEqual(['ACTIVE', 'SUSPENDED', 'DELETED']);
  });

  test('should verify arrays', () => {
    const mongooseSchema = toMongooseSchema(MegaZodSchema);

    expect(mongooseSchema.path('stringArray')).toBeDefined();
    expect((mongooseSchema.path('stringArray') as any).instance).toBe('Array');

    expect(mongooseSchema.path('chainedArray')).toBeDefined();
    expect((mongooseSchema.path('chainedArray') as any).instance).toBe('Array');
  });

  test('should verify nested objects and recursion', () => {
    const mongooseSchema = toMongooseSchema(MegaZodSchema);

    // categoryTree is recursive (lazy)
    expect(mongooseSchema.path('categoryTree.id')).toBeInstanceOf(mongoose.Schema.Types.String);
    expect(mongooseSchema.path('categoryTree.subCategories')).toBeDefined();
    expect((mongooseSchema.path('categoryTree.subCategories') as any).instance).toBe('Array');
  });

  test('should verify complex wrappers (optional, nullable, default)', () => {
    const mongooseSchema = toMongooseSchema(MegaZodSchema);

    const optionalField = mongooseSchema.path('optionalField') as any;
    expect(optionalField.options.required).toBe(false);

    const defaultField = mongooseSchema.path('defaultField') as any;
    expect(defaultField.options.default).toBe('anonymous');
  });

  test('should verify transformations and refinements', () => {
    const mongooseSchema = toMongooseSchema(MegaZodSchema);

    expect(mongooseSchema.path('customValidated')).toBeInstanceOf(mongoose.Schema.Types.String);
    expect(mongooseSchema.path('transformed')).toBeInstanceOf(mongoose.Schema.Types.String);
  });

  test('should verify fallback to Mixed for unsupported types', () => {
    const mongooseSchema = toMongooseSchema(MegaZodSchema);

    // z.symbol(), z.function(), z.promise() etc. should likely fall back to Mixed
    expect(mongooseSchema.path('simpleSymbol')).toBeInstanceOf(mongoose.Schema.Types.Mixed);
    expect(mongooseSchema.path('functionValidator')).toBeInstanceOf(mongoose.Schema.Types.Mixed);
    expect(mongooseSchema.path('promiseData')).toBeInstanceOf(mongoose.Schema.Types.Mixed);
  });

  test('should verify unions and intersections', () => {
    const mongooseSchema = toMongooseSchema(MegaZodSchema);

    expect(mongooseSchema.path('stringOrNumber').instance).toBe('Union');
    expect(mongooseSchema.path('alternativeUnion').instance).toBe('Union');

    // Discriminated Unions of objects are now flattened into the parent path
    // Let's verify the parent path exists and is a sub-document (or has the fields)
    expect(mongooseSchema.path('eventPayload')).toBeDefined();

    // Intersections of objects are now subschemas by default
    expect(mongooseSchema.path('personWithEmployeeData')).toBeDefined();
    expect(mongooseSchema.path('personWithEmployeeData')).not.toBeInstanceOf(mongoose.Schema.Types.Mixed);
    expect(mongooseSchema.path('personWithEmployeeData.firstName')).toBeDefined();
  });

  test('should verify new _id and refs fields', () => {
    const mongooseSchema = toMongooseSchema(MegaZodSchema);

    expect(mongooseSchema.path('_id')).toBeInstanceOf(mongoose.Schema.Types.ObjectId);
    expect(mongooseSchema.path('refs')).toBeDefined();
    expect((mongooseSchema.path('refs') as any).instance).toBe('Array');
    expect((mongooseSchema.path('refs') as any).embeddedSchemaType).toBeInstanceOf(
      mongoose.Schema.Types.ObjectId,
    );
  });

  test('should verify buffer field', () => {
    const mongooseSchema = toMongooseSchema(MegaZodSchema);

    expect(mongooseSchema.path('buffer')).toBeInstanceOf(mongoose.Schema.Types.Buffer);
  });
});

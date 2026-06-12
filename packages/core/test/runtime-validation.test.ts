import {expect, test, describe, beforeAll, afterAll} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {toMongooseSchema} from '../src/index.js';

describe('Zod Runtime Validation (post-validate hook)', () => {
  beforeAll(async () => {
    // No need for a real connection for just validation tests,
    // but Mongoose might need to be initialized.
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  test('should validate document using Zod schema on validate()', async () => {
    const zodSchema = z.object({
      name: z.string().refine(val => val.length > 10, {
        message: 'Name must be longer than 10 characters',
      }),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    const TestModel = mongoose.model('RuntimeValidation1', mongooseSchema);

    const doc = new TestModel({
      name: 'too short', // passes Mongoose (no minlength), but fails Zod refine
    });

    let error: any;
    try {
      await doc.validate();
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    // The error message should be a JSON string as per converter.ts
    const parsedError = JSON.parse(error.message);
    expect(parsedError.context.model).toBe('RuntimeValidation1');
    expect(parsedError.errors).toBeDefined();
    expect(parsedError.errors.length).toBeGreaterThan(0);

    // Check if it's Zod errors
    const nameError = parsedError.errors.find((e: any) => e.path.includes('name'));
    expect(nameError).toBeDefined();
    expect(nameError.code).toBe('custom');
  });

  test('should pass validation if data matches Zod schema', async () => {
    const zodSchema = z.object({
      name: z.string().min(5),
      age: z.number().positive(),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    const TestModel = mongoose.model('RuntimeValidation2', mongooseSchema);

    const doc = new TestModel({
      name: 'Valid Name',
      age: 25,
    });

    await doc.validate(); // should not throw
  });

  test('should disable Zod validation if validateBeforeSave is false', async () => {
    // Mongoose also has its own validations, so we use a zod validation
    // that Mongoose doesn't automatically map or one that we can easily distinguish.
    // Actually, z.string().min(5) maps to minlength: 5 in Mongoose.
    // Let's use a custom refinement that Mongoose definitely doesn't know about.
    const zodSchemaWithRefine = z.object({
      name: z.string().refine(val => val === 'specific', {
        message: 'Must be "specific"',
      }),
    });

    const mongooseSchema = toMongooseSchema(zodSchemaWithRefine, {
      validateBeforeSave: false,
    });
    const TestModel = mongoose.model('RuntimeValidation3', mongooseSchema);

    const doc = new TestModel({
      name: 'not-specific',
    });

    // This should NOT throw Zod error because validateBeforeSave is false
    await doc.validate();
  });

  test('should include model name and id in error context', async () => {
    const zodSchema = z.object({
      name: z.string().refine(val => val.length > 20, {
        message: 'Too short for context test',
      }),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    const TestModel = mongoose.model('RuntimeValidation4', mongooseSchema);

    const doc = new TestModel({
      name: 'short',
    });
    const id = doc._id.toString();

    let error: any;
    try {
      await doc.validate();
    } catch (e) {
      error = e;
    }

    const parsedError = JSON.parse(error.message);
    expect(parsedError.context.model).toBe('RuntimeValidation4');
    expect(parsedError.context.id).toBe(id);
  });

  test('should validate nested objects using Zod schema', async () => {
    const zodSchema = z.object({
      user: z.object({
        email: z.string().email(),
      }),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    const TestModel = mongoose.model('RuntimeValidationNested', mongooseSchema);

    const doc = new TestModel({
      user: {
        email: 'invalid-email',
      },
    });

    let error: any;
    try {
      await doc.validate();
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    const parsedError = JSON.parse(error.message);
    const emailError = parsedError.errors.find((e: any) =>
      e.path.includes('user') && e.path.includes('email')
    );
    expect(emailError).toBeDefined();
  });
});

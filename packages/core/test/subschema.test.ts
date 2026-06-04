import {describe, test, expect} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {toMongooseSchema, withMongoose} from '../src/index.js';

describe('Subschema support', () => {
  test('should treat nested objects as subschemas by default', () => {
    const nested = z.object({
      name: z.string(),
    });

    const schema = z.object({
      child: nested,
    });

    const mongooseSchema = toMongooseSchema(schema);

    // In Mongoose, a nested document path should now have a 'type' that is a Schema by default
    expect((mongooseSchema as any).obj.child.type).toBeInstanceOf(mongoose.Schema);
    expect((mongooseSchema as any).obj.child.type.obj.name).toBeDefined();
  });

  test('should treat nested objects as POJOs when marked with schema: false', () => {
    const nested = withMongoose(
      z.object({
        name: z.string(),
      }),
      {schema: false},
    );

    const schema = z.object({
      child: nested,
    });

    const mongooseSchema = toMongooseSchema(schema);

    // Should be a POJO (nested path)
    expect((mongooseSchema as any).obj.child).not.toBeInstanceOf(mongoose.Schema);
    expect((mongooseSchema as any).obj.child.name).toBeDefined();
    expect((mongooseSchema as any).obj.child.name.type).toBe(String);
  });

  test('should treat nested objects as subschemas when marked with schema: true', () => {
    const nested = withMongoose(
      z.object({
        name: z.string(),
      }),
      {schema: true},
    );

    const schema = z.object({
      child: nested,
    });

    const mongooseSchema = toMongooseSchema(schema);

    // Check if it's a subschema
    expect((mongooseSchema as any).obj.child.type).toBeInstanceOf(mongoose.Schema);
    expect((mongooseSchema as any).obj.child.type.obj.name).toBeDefined();
  });

  test('should support schema options when passing an object to schema', () => {
    const nested = withMongoose(
      z.object({
        name: z.string(),
      }),
      {schema: {_id: true, timestamps: true}},
    );

    const schema = z.object({
      child: nested,
    });

    const mongooseSchema = toMongooseSchema(schema);

    const subSchema = (mongooseSchema as any).obj.child.type;
    expect(subSchema).toBeInstanceOf(mongoose.Schema);
    expect(subSchema.options._id).toBe(true);
    expect(subSchema.options.timestamps).toBe(true);
  });

  test('should support plugins in subschemas', () => {
    let pluginCalled = false;
    const testPlugin = () => {
      pluginCalled = true;
    };

    const nested = withMongoose(
      z.object({
        name: z.string(),
      }),
      {schema: {plugins: [testPlugin]}},
    );

    const schema = z.object({
      child: nested,
    });

    toMongooseSchema(schema);

    expect(pluginCalled).toBe(true);
  });

  test('should treat nested intersections as subschemas by default', () => {
    const left = z.object({a: z.string()});
    const right = z.object({b: z.number()});
    const intersection = z.intersection(left, right);

    const schema = z.object({
      child: intersection,
    });

    const mongooseSchema = toMongooseSchema(schema);

    const subSchema = (mongooseSchema as any).obj.child.type;
    expect(subSchema).toBeInstanceOf(mongoose.Schema);
    expect(subSchema.obj.a).toBeDefined();
    expect(subSchema.obj.b).toBeDefined();
  });

  test('should allow disabling subschema for intersections', () => {
    const left = z.object({a: z.string()});
    const right = z.object({b: z.number()});
    const intersection = withMongoose(z.intersection(left, right), {schema: false});

    const schema = z.object({
      child: intersection,
    });

    const mongooseSchema = toMongooseSchema(schema);

    expect((mongooseSchema as any).obj.child).not.toBeInstanceOf(mongoose.Schema);
    expect((mongooseSchema as any).obj.child.a).toBeDefined();
    expect((mongooseSchema as any).obj.child.b).toBeDefined();
  });
});

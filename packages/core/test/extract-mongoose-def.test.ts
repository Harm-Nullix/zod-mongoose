import { describe, it, expect } from 'bun:test';
import { z } from 'zod/v4';
import { extractMongooseDef } from '../src/extract-mongoose-def.js';
import { withMongoose } from '../src/registry.js';
import { zObjectId } from '../src/mongoose-helpers.js';

describe('extractMongooseDef', () => {
  it('should extract primitives', () => {
    expect(extractMongooseDef(z.string()).type).toBe(String);
    expect(extractMongooseDef(z.number()).type).toBe(Number);
    expect(extractMongooseDef(z.boolean()).type).toBe(Boolean);
    expect(extractMongooseDef(z.date()).type).toBe(Date);
    expect(extractMongooseDef(z.bigint()).type).toBe(BigInt);
  });

  it('should handle optional and required fields', () => {
    const optionalString = z.string().optional();
    const def = extractMongooseDef(optionalString);
    expect(def.required).toBe(false);

    const requiredString = z.string();
    const def2 = extractMongooseDef(requiredString);
    expect(def2.required).toBe(true);
  });

  it('should handle enums', () => {
    const enumSchema = z.enum(['A', 'B', 'C']);
    const def = extractMongooseDef(enumSchema);
    expect(def.type).toBe(String);
    expect(def.enum).toEqual(['A', 'B', 'C']);
  });

  it('should handle nested objects', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
      }),
    });
    const def = extractMongooseDef(schema);
    // Nested objects are now subschemas by default
    expect(def.user.type.obj.name.type).toBe(String);
  });

  it('should handle metadata from withMongoose', () => {
    const schema = withMongoose(z.string(), { index: true, unique: true });
    const def = extractMongooseDef(schema);
    expect(def.type).toBe(String);
    expect(def.index).toBe(true);
    expect(def.unique).toBe(true);
  });

  it('should handle zObjectId', () => {
    const schema = zObjectId();
    const def = extractMongooseDef(schema);
    // Depending on environment, it might be the string 'ObjectId' or the actual constructor
    expect(def.type.toString()).toContain('ObjectId');
  });

  it('should handle recursive schemas with z.lazy', () => {
    interface Category {
      name: string;
      subcategories: Category[];
    }
    const CategorySchema: z.ZodType<Category> = z.lazy(() =>
      z.object({
        name: z.string(),
        subcategories: z.array(CategorySchema),
      }));

    const def = extractMongooseDef(CategorySchema);
    expect(def.name.type).toBe(String);
    expect(Array.isArray(def.subcategories.type)).toBe(true);
    // The inner type of subcategories should be a reference back or the same structure
    // In our implementation, we use visited Map to handle recursion.
  });

  it('should handle intersections', () => {
    const schema = z.intersection(
      z.object({ a: z.string() }),
      z.object({ b: z.number() })
    );
    const def = extractMongooseDef(schema);
    expect(def.a.type).toBe(String);
    expect(def.b.type).toBe(Number);
  });
});

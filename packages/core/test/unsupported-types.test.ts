import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {extractMongooseDef} from '../src/converter.js';

describe('Improved Types behavior', () => {
  test('z.intersection should merge definitions', () => {
    const schema = z.intersection(
      z.object({ a: z.string() }),
      z.object({ b: z.number() })
    );
    const def = extractMongooseDef(schema) as any;
    expect(def.a.type).toBe(String);
    expect(def.b.type).toBe(Number);
  });

  test('z.union should map to Mongoose Union for simple types', () => {
    const schema = z.union([z.string(), z.number()]);
    const def = extractMongooseDef(schema) as any;
    expect(def.type).toBe(mongoose.Schema.Types.Union);
    expect(def.of).toHaveLength(2);
    expect(def.of[0]).toBe(String);
    expect(def.of[1]).toBe(Number);
  });

  test('z.discriminatedUnion should return structured POJO for discriminators', () => {
    const schema = z.discriminatedUnion('type', [
      z.object({type: z.literal('a'), a: z.string()}),
      z.object({type: z.literal('b'), b: z.number()}),
    ]);
    const def = extractMongooseDef(schema) as any;
    expect(def.__isDiscriminatorUnion).toBe(true);
    expect(def.discriminatorKey).toBe('type');
    expect(def.discriminators).toHaveProperty('a');
    expect(def.discriminators).toHaveProperty('b');

    expect(def.discriminators.a.a.type).toBe(String);
    expect(def.discriminators.b.b.type).toBe(Number);
  });

  test('z.record should map to Mongoose Object (POJO)', () => {
    const schema = z.record(z.string(), z.number());
    const def = extractMongooseDef(schema) as any;
    expect(def.type).toBe(Object);
    expect(def.of).toBe(Number);
  });

  test('z.map should map to Mongoose Map', () => {
    const schema = z.map(z.string(), z.number());
    const def = extractMongooseDef(schema) as any;
    expect(def.type).toBe(Map);
    expect(def.of).toBe(Number);
  });

  test('z.set should map to Mongoose Array', () => {
    const schema = z.set(z.string());
    const def = extractMongooseDef(schema) as any;
    expect(Array.isArray(def.type)).toBe(true);
    expect(def.type[0]).toBe(String);
  });

  test('z.tuple should map to Mongoose Array', () => {
    const schema = z.tuple([z.string(), z.number()]);
    const def = extractMongooseDef(schema) as any;
    expect(Array.isArray(def.type)).toBe(true);
    expect(def.type[0]).toBe(String);
  });

  test('z.promise should currently fallback to Mixed', () => {
    const schema = z.promise(z.string());
    const def = extractMongooseDef(schema) as any;
    expect(def.type).toBe(mongoose.Schema.Types.Mixed);
  });
});

import { describe, it, expect } from 'bun:test';
import { z } from 'zod/v4';
import { handleObject, handleArray, handleRecord } from '../src/schema-handlers.js';
import { extractMongooseDef } from '../src/extract-mongoose-def.js';

describe('schema-handlers', () => {
  describe('handleObject', () => {
    it('should convert a simple object', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const mongooseProp: any = {};
      const visited = new Map();

      const result = handleObject(schema, mongooseProp, visited, extractMongooseDef as any);

      expect(result.name.type).toBe(String);
      expect(result.age.type).toBe(Number);
    });

    it('should respect top-level options in objects', () => {
      const schema = z.object({
        name: z.string(),
      });

      const mongooseProp: any = { type: Object, collection: 'users_test' };
      const visited = new Map();

      const result = handleObject(schema, mongooseProp, visited, extractMongooseDef as any);

      expect(result.collection).toBe('users_test');
      expect(result.name.type).toBe(String);
    });

    it('should skip _id if not explicitly included', () => {
      const schema = z.object({
        _id: z.string(),
        name: z.string(),
      });
      const mongooseProp: any = {};
      const visited = new Map();

      const result = handleObject(schema, mongooseProp, visited, extractMongooseDef as any);

      expect(result._id).toBeUndefined();
      expect(result.name.type).toBe(String);
    });
  });

  describe('handleArray', () => {
    it('should convert a simple array', () => {
      const schema = z.array(z.string());
      const mongooseProp: any = {};
      const visited = new Map();

      handleArray(schema, mongooseProp, visited, extractMongooseDef as any);

      expect(Array.isArray(mongooseProp.type)).toBe(true);
      expect(mongooseProp.type[0]).toBe(String);
    });

    it('should handle nested objects in arrays', () => {
      const schema = z.array(z.object({ item: z.string() }));
      const mongooseProp: any = {};
      const visited = new Map();

      handleArray(schema, mongooseProp, visited, extractMongooseDef as any);

      expect(Array.isArray(mongooseProp.type)).toBe(true);
      expect(mongooseProp.type[0].item.type).toBe(String);
    });
  });

  describe('handleRecord', () => {
    it('should convert a record to an Object (POJO)', () => {
      const schema = z.record(z.string(), z.string());
      const mongooseProp: any = {};
      const visited = new Map();

      handleRecord(schema, mongooseProp, visited, extractMongooseDef as any);

      expect(mongooseProp.type).toBe(Object);
    });

    it('should convert a map to a Map instance', () => {
      const schema = z.map(z.string(), z.string());
      const mongooseProp: any = {};
      const visited = new Map();

      handleRecord(schema, mongooseProp, visited, extractMongooseDef as any);

      expect(mongooseProp.type).toBe(Map);
    });
  });
});

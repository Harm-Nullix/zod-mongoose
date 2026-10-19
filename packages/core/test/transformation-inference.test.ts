import {describe, expect, test} from 'bun:test';
import mongoose from 'mongoose';
import {z} from 'zod/v4';
import {toMongooseSchema} from '../src/index.js';

describe('Transform output mapping', () => {
  test('an opaque callback uses Mixed without executing or inspecting it', () => {
    let calls = 0;
    const callback = (value: string) => { calls++; return value === 'true'; };
    callback.toString = () => { throw new Error('Callback source must not be inspected'); };
    const schema = toMongooseSchema(z.object({active: z.string().transform(callback)}));
    expect(schema.path('active').instance).toBe('Mixed');
    expect(calls).toBe(0);
  });

  test('a default does not constrain every possible callback result', () => {
    const schema = toMongooseSchema(z.object({
      value: z.string().transform((value) => value === 'true' || value === 'false' ? value === 'true' : value).default(false),
    }));
    expect(schema.path('value').instance).toBe('Mixed');
    expect(schema.path('value').options.default).toBe(false);
  });

  test('an output pipe supplies the Boolean type', () => {
    const schema = toMongooseSchema(z.object({
      active: z.string().transform((value) => value === 'true').pipe(z.boolean()),
    }));
    expect(schema.path('active').instance).toBe('Boolean');
  });

  test('the built-in stringbool codec declares its Boolean output', async () => {
    const input = z.object({active: z.stringbool()});
    const connection = mongoose.createConnection();
    try {
      const Model = connection.model('StringboolOutput', toMongooseSchema(input));
      const doc = new Model(input.parse({active: 'yes'}));
      expect(Model.schema.path('active').instance).toBe('Boolean');
      await doc.validate();
      expect(doc.active).toBe(true);
    } finally {
      connection.deleteModel(/.*/);
    }
  });
});

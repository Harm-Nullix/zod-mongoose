import {describe, expect, test} from 'bun:test';
import {z} from 'zod/v4';
import {toMongooseSchema, extractMongooseDef} from '../src/index.js';
import mongoose from 'mongoose';

const getZodDateField = () =>
  z.codec(
    z.union([z.iso.datetime(), z.iso.date(), z.date()]), // input schema: ISO date string or Date
    z.date(), // output schema: Date object
    {
      decode: (dateLike) => (dateLike instanceof Date ? dateLike : new Date(dateLike)), // ISO string → Date
      encode: (date) => date.toISOString(), // Date → ISO string
    },
  );

const getZodEpochField = () =>
  z.codec(z.union([z.int().min(0), z.iso.datetime(), z.iso.date(), z.date()]), z.int().min(0), {
    decode: (dateLike) =>
      dateLike instanceof Date ? dateLike.getTime() : new Date(dateLike).getTime(), // ISO string → epoch
    encode: (millis) => new Date(millis).toISOString(), // Epoch → ISO string
  });
describe('Codec Issue', () => {
  test('z.codec should map to output schema (Date)', () => {
    const getZodDateField = () =>
      z.codec(
        z.union([z.string(), z.date()]), // input
        z.date(), // output
        {
          decode: (v) => new Date(v as any),
          encode: (v: Date) => v.toISOString(),
        },
      );

    const schema = z.object({
      date: getZodDateField(),
    });

    const def = extractMongooseDef(schema) as any;

    // If it's working as I expect (taking 'out' of pipe), it should be Date
    // But user says it's the Union.
    expect(def.date.type).toBe(Date);

    const mongooseSchema = toMongooseSchema(schema);
    expect(mongooseSchema.path('date')).toBeInstanceOf(mongoose.Schema.Types.Date);
  });

  test('z.codec should map bigger', () => {
    const schema = z.object({
      date: getZodDateField(),
      epoch: getZodEpochField(),
    });

    const def = extractMongooseDef(schema) as any;

    // If it's working as I expect (taking 'out' of pipe), it should be Date
    // But user says it's the Union.
    expect(def.date.type).toBe(Date);
    expect(def.epoch.type).toBe(Number);

    const mongooseSchema = toMongooseSchema(schema);
    expect(mongooseSchema.path('date')).toBeInstanceOf(mongoose.Schema.Types.Date);
    expect(mongooseSchema.path('epoch')).toBeInstanceOf(mongoose.Schema.Types.Number);
  });
});

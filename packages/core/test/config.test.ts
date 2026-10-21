import {describe, expect, mock, test} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {setFrontendMode, getFrontendMode, setMongoose, getMongoose} from '../src/config.js';
import {toMongooseSchema} from '../src/converter.js';
import {toStrictModel} from '../src/strict-model.js';

describe('Configuration & Environment Fallbacks', () => {
  test('warns that the legacy manual mode is deprecated', () => {
    const warn = mock(() => undefined);
    // eslint-disable-next-line no-console
    const originalWarn = console.warn;
    // eslint-disable-next-line no-console
    console.warn = warn;

    setFrontendMode(false);

    // eslint-disable-next-line no-console
    console.warn = originalWarn;
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
  });

  test('throws descriptive error when converting schema or creating strict model without Mongoose', () => {
    // Enable frontend mode so getMongoose() returns null
    setFrontendMode(true);
    expect(getFrontendMode()).toBe(true);
    try {
      expect(getMongoose()).toBeNull();
      expect(() => {
        toMongooseSchema(z.object({name: z.string()}));
      }).toThrow('Mongoose must be installed to use toMongooseSchema');

      expect(() => {
        toStrictModel('SampleModel', new mongoose.Schema({name: String}));
      }).toThrow('Mongoose must be installed to use toStrictModel');
    } finally {
      setFrontendMode(false);
      expect(getFrontendMode()).toBe(false);
    }
  });

  test('supports manually setting Mongoose instance via setMongoose', () => {
    const customInstance = {Schema: mongoose.Schema, model: mongoose.model};
    setMongoose(customInstance);
    expect(getMongoose()).toBe(customInstance);
    setMongoose(null);
  });

  test('auto-detects globalThis.mongoose when present', () => {
    const originalGlobalMongoose = (globalThis as any).mongoose;
    (globalThis as any).mongoose = {default: mongoose};
    expect(getMongoose()).toBe(mongoose);
    (globalThis as any).mongoose = originalGlobalMongoose;
  });
});

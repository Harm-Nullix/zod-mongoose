import {describe, it, expect} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {extractMongooseDef, toMongooseSchema, withMongoose, zObjectId} from '../src/index.js';

describe('Reverse Mapping: Zod to Mongoose (based on test/mongoose-model.ts)', () => {
  // Accessory
  const AccessoryZodSchema = z.object({
    filename: z.string().optional(),
    material: z.string().optional(),
    type: z.string().optional(),
    uuid: z.string(),
    size: z.number().optional(),
  });

  // Installed Accessory
  const InstalledAccessoryZodSchema = z.object({
    installedBy: withMongoose(z.string().optional(), {ref: 'User'}),
    updatedBy: withMongoose(z.string().optional(), {ref: 'User'}),
    dateInstalled: z.date().default(() => new Date()),
    dateChanged: z.date().default(() => new Date()),
    accessory: AccessoryZodSchema.optional(),
  });

  // Vehicle (Base Model)
  const VehicleZodSchema = withMongoose(
    z.object({
      name: z.string(),
      brand: z.string(),
      vehicleType: z.string().optional(),
      owner: withMongoose(zObjectId(), {ref: 'User', index: true}),
      serviceLogs: withMongoose(z.array(zObjectId()), {
        ref: 'ServiceLog',
        index: true,
      }).default([]),
      accessories: z.array(InstalledAccessoryZodSchema).optional(),
      isScrapped: withMongoose(z.boolean().default(false), {index: true}),
    }),
    {
      timestamps: true,
      discriminatorKey: 'vehicleType',
    },
  );

  // Sub-documents for Car: Inspections
  const InspectionHistoryZodSchema = z.object({
    inspector: withMongoose(z.string().optional(), {ref: 'User'}),
    date: z.date(),
    approved: z.boolean(),
  });

  const SafetyInspectionZodSchema = z.object({
    inspectionStandardId: withMongoose(zObjectId().optional(), {ref: 'Standard'}),
    approvalHistory: z.array(InspectionHistoryZodSchema).optional(),
    comments: z.array(z.any()).optional(),
    diagnosticResults: z.any().optional(),
  });

  // Car (Discriminator)
  const CarZodSchema = z.object({
    previousVehicleId: withMongoose(zObjectId().optional(), {ref: 'Vehicle'}),
    licensePlate: z.string().optional(),
    priceInCents: z.number().optional(),
    status: withMongoose(
      z.enum(['Draft', 'InProduction', 'Delivered', 'Maintenance']).default('Draft'),
      {},
    ),
    features: z.array(z.string()).default([]),
    inspections: z.array(SafetyInspectionZodSchema).optional(),
    contactPersons: withMongoose(z.array(zObjectId()).optional(), {
      ref: 'ContactPerson',
    }),
    warrantyInfo: z.any().default({
      engine: false,
      tires: false,
      electronics: false,
    }),
  });

  it('should convert AccessoryZodSchema to correct Mongoose definition', () => {
    const def = extractMongooseDef(AccessoryZodSchema);
    expect(def.filename.type).toBe(String);
    expect(def.uuid.type).toBe(String);
    expect(def.uuid.required).toBe(true);
    expect(def.size.type).toBe(Number);
  });

  it('should convert InstalledAccessoryZodSchema and handle nested schemas', () => {
    const def = extractMongooseDef(InstalledAccessoryZodSchema);
    expect(def.installedBy.type).toBe(String);
    expect(def.installedBy.ref).toBe('User');
    expect(def.dateInstalled.type).toBe(Date);
    expect(def.accessory).toBeDefined();
    // In our converter, nested objects are now returned as subschemas by default
    expect(def.accessory.type.obj.filename.type).toBe(String);
  });

  it('should convert VehicleZodSchema and include timestamps and discriminatorKey metadata', () => {
    const def = extractMongooseDef(VehicleZodSchema);
    expect(def.name.type).toBe(String);
    expect(def.name.required).toBe(true);
    expect(def.owner.type).toBe(mongoose.Schema.Types.ObjectId);
    expect(def.owner.ref).toBe('User');
    expect(def.owner.index).toBe(true);
    expect(def.isScrapped.type).toBe(Boolean);
    expect(def.isScrapped.index).toBe(true);
    expect(def.vehicleType.type).toBe(String);

    const schema = toMongooseSchema(VehicleZodSchema);
    expect(schema.options.timestamps).toBe(true);
    expect(schema.options.discriminatorKey).toBe('vehicleType');
  });

  it('should convert SafetyInspectionZodSchema and handle Mixed types', () => {
    const def = extractMongooseDef(SafetyInspectionZodSchema);
    expect(def.diagnosticResults.type).toBe(mongoose.Schema.Types.Mixed);
    expect((def.comments as any).type).toEqual([mongoose.Schema.Types.Mixed]);
  });

  it('should convert CarZodSchema and handle enums and defaults', () => {
    const def = extractMongooseDef(CarZodSchema);
    expect(def.status.type).toBe(String);
    expect(def.status.enum).toEqual(['Draft', 'InProduction', 'Delivered', 'Maintenance']);
    expect(def.status.default).toBe('Draft');
    expect((def.features as any).type).toEqual([String]);
    expect(def.warrantyInfo.type).toBe(mongoose.Schema.Types.Mixed);
  });

  it('should correctly handle contactPersons array of ObjectIds', () => {
    const def = extractMongooseDef(CarZodSchema);
    expect(def.contactPersons).toBeDefined();
    // contactPersons: withMongoose(z.array(zObjectId()).optional(), { ref: 'ContactPerson' })
    expect(Array.isArray((def.contactPersons as any).type)).toBe(true);
    expect((def.contactPersons as any).type[0]).toBe(mongoose.Schema.Types.ObjectId);
    expect((def.contactPersons as any).ref).toBe('ContactPerson');
  });

  it('should correctly handle inspections (SafetyInspectionZodSchema) nested structure', () => {
    const def = extractMongooseDef(SafetyInspectionZodSchema);
    expect(def.inspectionStandardId.type).toBe(mongoose.Schema.Types.ObjectId);
    expect(def.inspectionStandardId.ref).toBe('Standard');

    expect(def.approvalHistory).toBeDefined();
    expect(Array.isArray((def.approvalHistory as any).type)).toBe(true);
    const approvalHistoryItem = (def.approvalHistory as any).type[0];
    // Since it's an array of objects, it's now an array of schemas
    expect(approvalHistoryItem.obj.inspector.type).toBe(String);
    expect(approvalHistoryItem.obj.inspector.ref).toBe('User');
    expect(approvalHistoryItem.obj.date.type).toBe(Date);
    expect(approvalHistoryItem.obj.approved.type).toBe(Boolean);
  });

  it('should correctly handle nested inspections in CarZodSchema', () => {
    const def = extractMongooseDef(CarZodSchema);
    expect(def.inspections).toBeDefined();
    expect(Array.isArray((def.inspections as any).type)).toBe(true);
    const inspectionItem = (def.inspections as any).type[0];
    expect(inspectionItem.obj.inspectionStandardId.type).toBe(mongoose.Schema.Types.ObjectId);
    expect(inspectionItem.obj.inspectionStandardId.ref).toBe('Standard');
    expect(Array.isArray(inspectionItem.obj.approvalHistory.type)).toBe(true);
  });

  it('should include discriminatorKey in metadata', () => {
    const schema = toMongooseSchema(VehicleZodSchema);
    expect(schema.options.discriminatorKey).toBe('vehicleType');
  });

  it('should be able to create Mongoose models from converted schemas', () => {
    const vehicleMongooseSchema = toMongooseSchema(VehicleZodSchema);

    const VehicleModel = mongoose.model('VehicleTest', vehicleMongooseSchema);

    const carMongooseSchema = toMongooseSchema(CarZodSchema);
    const CarModel = VehicleModel.discriminator('CarTest', carMongooseSchema);

    expect(VehicleModel.modelName).toBe('VehicleTest');
    expect(CarModel.modelName).toBe('CarTest');

    const testCar = new CarModel({
      name: 'Test Car',
      brand: 'Test Brand',
      owner: new mongoose.Types.ObjectId(),
      licensePlate: 'ABC-123',
      status: 'Draft',
    });

    expect(testCar.vehicleType).toBe('CarTest');
    expect(testCar.name).toBe('Test Car');
  });
});

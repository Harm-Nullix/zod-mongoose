import {z} from 'zod/v4';
import {toMongooseSchema} from '../../src/index.js';
import {AddressSchema, AddressWithoutIdSchema} from './address.js';

export const UserZodSchema = z.object({
  name: z.string(),
  shippingAddress: AddressWithoutIdSchema,
  previousAddresses: z.array(AddressWithoutIdSchema),
});

export const AuditZodSchema = z.object({
  addressSnapshot: AddressSchema,
});

export const UserMongooseSchema = toMongooseSchema(UserZodSchema);
export const AuditMongooseSchema = toMongooseSchema(AuditZodSchema);

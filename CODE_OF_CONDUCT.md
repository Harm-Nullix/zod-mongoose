The distinction: What DOES and what DOES NOT require a helper?
❌ NO helper required (because Zod can already do this natively):

    z.any() / z.unknown() ➔ Is automatically converted to Schema.Types.Mixed by the conversion engine.

    z.map(z.string(), z.number()) ➔ Automatically becomes Mongoose Schema.Types.Map with or: Number.

    z.record(z.string()) ➔ Automatically becomes a Mongoose nested object/record.

    z.array(z.number()) ➔ Automatically becomes Mongoose [Number].

DO need a helper/modifier (because Zod does NOT support this natively):

    GeoJSON (zPoint(), zPolygon()): Zod does not support the GeoJSON concept. To construct a Polygon in pure Zod, you have to manually type z.array(z.array(z.tuple([z.number(), z.number()]))) . That’s ugly, error-prone, and lacks the Mongoose `type: ‘Polygon’` enum constraint. A `zPoint()` or `zPolygon()` helper would really add value to DX here.

    Mongoose-specific metadata (.mongooseIndex(‘2dsphere’)): Zod knows nothing about database indexes. With a fluent chaining method like .mongooseIndex(...) or .mongooseRef(...), you can link Mongoose-specific DB instructions to a standard Zod type.

    zObjectId(): By default, Zod only supports z.string(). zObjectId() bridges the gap between Zod string validation (24 hex characters) and the Mongoose/BSON Schema.Types.ObjectId type.

The “Agnostic Filter” Rule for New Features

To determine whether an idea belongs in the codebase or roadmap, you can use this simple rule of thumb:

    Can it be handled with a standard native Zod type (z.map, z.any, z.enum)?
    ➔ NO HELPER. The conversion engine should handle it silently and automatically.

    Is it a MongoDB/Mongoose-specific data structure pattern that Zod does NOT support (GeoJSON, ObjectId, Decimal128)?
    ➔ USE A TYPE-BRIDGE HELPER.

    Is it a database instruction that has nothing to do with the data format (Indexes, Unique, Populated Refs)?
    ➔ USE A METADATA MODIFIER.
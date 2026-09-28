---
"@nullix/zod-mongoose": patch
"@nullix/zod-mongoose-studio": patch
---

**Buffer validation fix:** `zBuffer()` accepts BSON `Binary` values from Mongoose `document.toObject()`, so the default Zod validation hook accepts edited Buffer fields.

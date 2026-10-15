---
'@nullix/zod-mongoose': minor
'@nullix/zod-mongoose-studio': minor
---

Preserve stored values through schema conversion and document validation. Fix array element options and explicit defaults, numeric enums, valid empty strings, and heterogeneous tuples. Primitive literals now enforce their values without inventing defaults. Keep native Mongoose primitive-union casting for compatibility.

Arrays no longer receive Mongoose's implicit empty-list default: required arrays reject omission and optional arrays stay omitted. Use an explicit `.default([])` where an empty list is intended.

Parse transformed input once before storage. Pipes, preprocessors, and codecs validate their declared output during the document lifecycle without rerunning input callbacks. Bare transforms use Mixed to avoid input-type casting and guessed return types; add `.pipe(outputSchema)` for stored-value validation. The validation and migration guides explain this boundary with construction and assignment examples.
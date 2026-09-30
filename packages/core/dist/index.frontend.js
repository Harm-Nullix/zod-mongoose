import { z } from 'zod/v4';

//#region src/utils.ts
function flatHooks(configHooks, hooks = {}, parentName) {
	for (const key in configHooks) {
		const subHook = configHooks[key];
		const name = parentName ? `${parentName}:${key}` : key;
		if (typeof subHook === "object" && subHook !== null) flatHooks(subHook, hooks, name);
		else if (typeof subHook === "function") hooks[name] = subHook;
	}
	return hooks;
}
const createTask = /* @__PURE__ */ (() => {
	if (console.createTask) return console.createTask;
	const defaultTask = { run: (fn) => fn() };
	return () => defaultTask;
})();
function callHooks(hooks, args, startIndex, task) {
	for (let i = startIndex; i < hooks.length; i += 1) try {
		const result = task ? task.run(() => hooks[i](...args)) : hooks[i](...args);
		if (result instanceof Promise) return result.then(() => callHooks(hooks, args, i + 1, task));
	} catch (error) {
		return Promise.reject(error);
	}
}
function serialTaskCaller(hooks, args, name) {
	if (hooks.length > 0) return callHooks(hooks, args, 0, createTask(name));
}
function parallelTaskCaller(hooks, args, name) {
	if (hooks.length > 0) {
		const task = createTask(name);
		return Promise.all(hooks.map((hook) => task.run(() => hook(...args))));
	}
}
function callEachWith(callbacks, arg0) {
	for (const callback of [...callbacks]) callback(arg0);
}
//#endregion
//#region src/hookable.ts
var Hookable = class {
	_hooks;
	_before;
	_after;
	_deprecatedHooks;
	_deprecatedMessages;
	constructor() {
		this._hooks = {};
		this._before = void 0;
		this._after = void 0;
		this._deprecatedMessages = void 0;
		this._deprecatedHooks = {};
		this.hook = this.hook.bind(this);
		this.callHook = this.callHook.bind(this);
		this.callHookWith = this.callHookWith.bind(this);
	}
	hook(name, function_, options = {}) {
		if (!name || typeof function_ !== "function") return () => {};
		const originalName = name;
		let dep;
		while (this._deprecatedHooks[name]) {
			dep = this._deprecatedHooks[name];
			name = dep.to;
		}
		if (dep && !options.allowDeprecated) {
			let message = dep.message;
			if (!message) message = `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : "");
			if (!this._deprecatedMessages) this._deprecatedMessages = /* @__PURE__ */ new Set();
			if (!this._deprecatedMessages.has(message)) {
				console.warn(message);
				this._deprecatedMessages.add(message);
			}
		}
		if (!function_.name) try {
			Object.defineProperty(function_, "name", {
				get: () => "_" + name.replace(/\W+/g, "_") + "_hook_cb",
				configurable: true
			});
		} catch {}
		this._hooks[name] = this._hooks[name] || [];
		this._hooks[name].push(function_);
		return () => {
			if (function_) {
				this.removeHook(name, function_);
				function_ = void 0;
			}
		};
	}
	hookOnce(name, function_) {
		let _unreg;
		let _function = (...arguments_) => {
			if (typeof _unreg === "function") _unreg();
			_unreg = void 0;
			_function = void 0;
			return function_(...arguments_);
		};
		_unreg = this.hook(name, _function);
		return _unreg;
	}
	removeHook(name, function_) {
		const hooks = this._hooks[name];
		if (hooks) {
			const index = hooks.indexOf(function_);
			if (index !== -1) hooks.splice(index, 1);
			if (hooks.length === 0) this._hooks[name] = void 0;
		}
	}
	clearHook(name) {
		this._hooks[name] = void 0;
	}
	deprecateHook(name, deprecated) {
		this._deprecatedHooks[name] = typeof deprecated === "string" ? { to: deprecated } : deprecated;
		const _hooks = this._hooks[name] || [];
		this._hooks[name] = void 0;
		for (const hook of _hooks) this.hook(name, hook);
	}
	deprecateHooks(deprecatedHooks) {
		for (const name in deprecatedHooks) this.deprecateHook(name, deprecatedHooks[name]);
	}
	addHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		const removeFns = Object.keys(hooks).map((key) => this.hook(key, hooks[key]));
		return () => {
			for (const unreg of removeFns) unreg();
			removeFns.length = 0;
		};
	}
	removeHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		for (const key in hooks) this.removeHook(key, hooks[key]);
	}
	removeAllHooks() {
		this._hooks = {};
	}
	callHook(name, ...args) {
		return this.callHookWith(serialTaskCaller, name, args);
	}
	callHookParallel(name, ...args) {
		return this.callHookWith(parallelTaskCaller, name, args);
	}
	callHookWith(caller, name, args) {
		const event = this._before || this._after ? {
			name,
			args,
			context: {}
		} : void 0;
		if (this._before) callEachWith(this._before, event);
		const result = caller(this._hooks[name] ? [...this._hooks[name]] : [], args, name);
		if (result instanceof Promise) return result.finally(() => {
			if (this._after && event) callEachWith(this._after, event);
		});
		if (this._after && event) callEachWith(this._after, event);
		return result;
	}
	beforeEach(function_) {
		this._before = this._before || [];
		this._before.push(function_);
		return () => {
			if (this._before !== void 0) {
				const index = this._before.indexOf(function_);
				if (index !== -1) this._before.splice(index, 1);
			}
		};
	}
	afterEach(function_) {
		this._after = this._after || [];
		this._after.push(function_);
		return () => {
			if (this._after !== void 0) {
				const index = this._after.indexOf(function_);
				if (index !== -1) this._after.splice(index, 1);
			}
		};
	}
};
function createHooks() {
	return new Hookable();
}

const hooks = createHooks();
function callHookSync(name, ...args) {
  hooks.callHookWith((callbacks, args2) => {
    for (const callback of callbacks) {
      callback(...args2);
    }
  }, name, args);
}

const mongooseRegistry = z.registry();
function withMongoose(schema, meta = {}) {
  callHookSync("registry:get:before", { schema });
  const existing = mongooseRegistry.get(schema) || {};
  callHookSync("registry:get", { schema, meta: existing });
  const merged = { ...existing, ...meta };
  callHookSync("registry:add", { schema, meta: merged });
  mongooseRegistry.add(schema, merged);
  callHookSync("registry:added", { schema, meta: merged });
  return schema;
}
function getMongooseMeta(schema) {
  const def = schema._def;
  if (!def) return {};
  let meta = mongooseRegistry.get(schema) || {};
  if (def.innerType) {
    meta = { ...getMongooseMeta(def.innerType), ...meta };
  } else if (def.schema) {
    meta = { ...getMongooseMeta(def.schema), ...meta };
  }
  if (def.type === "pipe") {
    meta = { ...getMongooseMeta(def.in), ...getMongooseMeta(def.out), ...meta };
  }
  return meta;
}

function objectStrictness(schema) {
  const catchall = schema._zod?.def?.catchall;
  if (!catchall) return true;
  return catchall._zod?.def?.type === "never" ? "throw" : false;
}
function unwrapZodSchema(schema, features = { required: true }, visited = /* @__PURE__ */ new Set()) {
  if (!schema) return { schema, features };
  if (visited.has(schema)) return { schema, features };
  const def = schema._def;
  if (!def) return { schema, features };
  if (!(schema instanceof z.ZodOptional) && !(schema instanceof z.ZodNullable) && !(schema instanceof z.ZodDefault) && def.type !== "pipe") {
    visited.add(schema);
  }
  if (schema instanceof z.ZodOptional) {
    const inner = schema.unwrap();
    const result = unwrapZodSchema(
      // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
      inner,
      features,
      visited
    );
    return {
      schema: result.schema,
      features: {
        ...result.features,
        required: false,
        isOptional: true,
        isExactOptional: false,
        isNonOptional: false
      }
    };
  }
  if (schema instanceof z.ZodExactOptional) {
    const result = unwrapZodSchema(schema.unwrap(), features, visited);
    return {
      schema: result.schema,
      features: {
        ...result.features,
        required: false,
        isOptional: true,
        isExactOptional: true,
        isNonOptional: false
      }
    };
  }
  if (schema instanceof z.ZodNonOptional) {
    const result = unwrapZodSchema(schema.unwrap(), features, visited);
    return {
      schema: result.schema,
      features: {
        ...result.features,
        required: true,
        isOptional: false,
        isExactOptional: false,
        isNonOptional: true
      }
    };
  }
  if (schema instanceof z.ZodNullable) {
    return unwrapZodSchema(
      // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
      schema.unwrap(),
      {
        ...features,
        isNullable: true
      },
      visited
    );
  }
  if (schema instanceof z.ZodDefault) {
    const defaultValue = typeof def.defaultValue === "function" ? def.defaultValue() : def.defaultValue;
    return unwrapZodSchema(
      def.innerType,
      {
        ...features,
        default: defaultValue
      },
      visited
    );
  }
  const { type } = def;
  if (type === "pipe") {
    const inType = def.in?._def?.type;
    const outType = def.out?._def?.type;
    if (inType === "transform") {
      return unwrapZodSchema(def.out, features, visited);
    }
    if (outType === "transform" || outType === "refinement") {
      const transformFeatures = { ...features };
      const outDef = def.out?._def;
      const effects = outDef?.effects || outDef?.transformations || (outType === "transform" ? [outDef] : []);
      if (effects && Array.isArray(effects)) {
        transformFeatures.transformations = [
          ...transformFeatures.transformations || [],
          ...effects
        ];
      }
      return unwrapZodSchema(def.in, transformFeatures, visited);
    }
    return unwrapZodSchema(def.out, features, visited);
  }
  if (type === "transform" || type === "preprocess" || type === "refinement" || type === "effects") {
    const transformFeatures = { ...features };
    const effects = def.effects || def.transformations || (def.type === "transform" || type === "transform" ? [def] : []);
    if (effects && Array.isArray(effects)) {
      transformFeatures.transformations = [
        ...transformFeatures.transformations || [],
        ...effects
      ];
    }
    const inner = def.schema || def.innerType;
    if (inner) {
      const result = unwrapZodSchema(inner, transformFeatures, visited);
      return result;
    }
  }
  if (type === "lazy") {
    return { schema, features };
  }
  if (type === "branded" || type === "readonly") {
    return unwrapZodSchema(
      schema.unwrap(),
      {
        ...features,
        ...type === "readonly" ? { readOnly: true } : {}
      },
      visited
    );
  }
  if (def.checks && Array.isArray(def.checks)) {
    features.checks = [...features.checks || [], ...def.checks];
  }
  return { schema, features };
}

function prepareForZodValidation(schema, value, mongooseSchema, pathPrefix = "") {
  if (value === null || value === void 0) return value;
  const { schema: unwrapped } = unwrapZodSchema(schema);
  const def = unwrapped?._def;
  if (def?.type === "lazy") {
    return prepareForZodValidation(def.getter(), value, mongooseSchema, pathPrefix);
  }
  if (def?.type === "object" && typeof value === "object" && !Array.isArray(value)) {
    const { shape } = unwrapped;
    const result = { ...value };
    if (mongooseSchema && !pathPrefix && mongooseSchema.options._id !== false && !Object.hasOwn(shape, "_id")) {
      delete result._id;
    }
    const versionKey = !pathPrefix && mongooseSchema?.options.versionKey;
    if (typeof versionKey === "string" && !Object.hasOwn(shape, versionKey)) {
      delete result[versionKey];
    }
    const timestamps = !pathPrefix && mongooseSchema?.options.timestamps;
    if (timestamps) {
      for (const key of ["createdAt", "updatedAt"]) {
        const configured = typeof timestamps === "object" ? timestamps[key] : void 0;
        if (configured === false) continue;
        const fieldName = typeof configured === "string" ? configured : key;
        if (!Object.hasOwn(shape, fieldName)) delete result[fieldName];
      }
    }
    for (const [key, fieldSchema] of Object.entries(shape)) {
      if (!Object.hasOwn(result, key)) continue;
      const path = pathPrefix ? `${pathPrefix}.${key}` : key;
      const nestedSchema = mongooseSchema?.path(path)?.schema;
      result[key] = prepareForZodValidation(
        fieldSchema,
        result[key],
        nestedSchema || mongooseSchema,
        nestedSchema ? "" : path
      );
    }
    return result;
  }
  if (Array.isArray(value)) {
    if (def?.type === "array" || def?.type === "set") {
      const element = unwrapped.element || def.valueType;
      return element ? value.map((item) => prepareForZodValidation(element, item, mongooseSchema, pathPrefix)) : value;
    }
    if (def?.type === "tuple") {
      return value.map((item, index) => {
        const element = def.items?.[index] || def.rest;
        return element ? prepareForZodValidation(element, item, mongooseSchema, pathPrefix) : item;
      });
    }
  }
  return value;
}

let mongooseInstance = null;
let isFrontend;
const setFrontendMode = (enabled) => {
  console.warn(
    "[zod-mongoose] setFrontendMode() is deprecated and will be removed in v4. Conditional exports select the appropriate implementation automatically."
  );
  isFrontend = enabled;
};
const getFrontendMode = () => {
  if (isFrontend === void 0 || isFrontend === null) {
    return globalThis.window !== void 0 && globalThis.document !== void 0;
  }
  return isFrontend;
};
const setMongoose = (m) => {
  mongooseInstance = m;
};
const getMongoose = () => {
  if (getFrontendMode()) {
    return null;
  }
  if (mongooseInstance) {
    return mongooseInstance;
  }
  try {
    if (typeof require !== "undefined") {
      const m = require("mongoose");
      if (m && (m.Schema || m.default?.Schema)) {
        return m.default || m;
      }
      return m;
    }
    return null;
  } catch {
    if (globalThis.mongoose) {
      return globalThis.mongoose;
    }
    return null;
  }
};

function mapZodChecksToMongoose(checks, mongooseProp) {
  if (!checks || !Array.isArray(checks)) return;
  for (const check of checks) {
    const traitSet = check._zod?.traits;
    const checkDef = check._zod?.def;
    if (!traitSet || !checkDef) continue;
    if (traitSet.has("$ZodCheckMinLength")) {
      mongooseProp.minlength = checkDef.minimum;
    }
    if (traitSet.has("$ZodCheckMaxLength")) {
      mongooseProp.maxlength = checkDef.maximum;
    }
    if (traitSet.has("$ZodCheckLengthEquals")) {
      mongooseProp.minlength = checkDef.length;
      mongooseProp.maxlength = checkDef.length;
    }
    if (traitSet.has("$ZodCheckGreaterThan")) {
      mongooseProp.min = checkDef.value;
    }
    if (traitSet.has("$ZodCheckLessThan")) {
      mongooseProp.max = checkDef.value;
    }
    if (traitSet.has("$ZodCheckRegex")) {
      mongooseProp.match = checkDef.pattern;
    }
    if (traitSet.has("$ZodUUID")) {
      const mongoose = globalThis.mongoose || globalThis.__mongoose;
      if (mongoose?.Schema.Types.UUID) {
        mongooseProp.type = mongoose.Schema.Types.UUID;
      }
    }
    if (traitSet.has("$ZodISODateTime") || traitSet.has("$ZodISODate")) {
      mongooseProp.type = Date;
    }
    if (traitSet.has("$ZodCheckOverwrite") && typeof checkDef.tx === "function") {
      const txStr = checkDef.tx.toString();
      if (txStr.includes(".trim()")) {
        mongooseProp.trim = true;
      } else if (txStr.includes(".toLowerCase()")) {
        mongooseProp.lowercase = true;
      } else if (txStr.includes(".toUpperCase()")) {
        mongooseProp.uppercase = true;
      }
    }
  }
  callHookSync("validation:mappers", { checks, mongooseProp });
}

function handleObject(unwrapped, mongooseProp, visited, extractMongooseDef, isField = false) {
  callHookSync("schema:object:before", { schema: unwrapped, mongooseProp, visited });
  const { shape } = unwrapped;
  const objDef = {};
  const placeholder = mongooseProp.type ? mongooseProp : objDef;
  visited.set(unwrapped, placeholder);
  for (const key in shape) {
    if (!Object.prototype.hasOwnProperty.call(shape, key)) continue;
    if (key === "_id") {
      const idMeta = mongooseRegistry.get(shape[key]) || {};
      const unwrappedId = unwrapZodSchema(shape[key]).schema;
      const unwrappedIdMeta = mongooseRegistry.get(unwrappedId) || {};
      if (idMeta.includeId !== true && unwrappedIdMeta.includeId !== true && mongooseProp.includeId !== true) {
        continue;
      }
    }
    const def = extractMongooseDef(shape[key], visited);
    if (def && typeof def === "object" && def.__isDiscriminatorUnion) {
      const mongoose = getMongoose();
      if (mongoose) {
        const baseSchema = new mongoose.Schema(def.baseDef, {
          discriminatorKey: def.discriminatorKey,
          _id: false
        });
        const discriminators = {};
        for (const [dKey, dDef] of Object.entries(def.discriminators)) {
          discriminators[dKey] = new mongoose.Schema(dDef, { _id: false });
        }
        objDef[key] = {
          type: baseSchema,
          discriminators
        };
      } else {
        objDef[key] = def;
      }
    } else if (typeof def === "object" && def !== null && !Array.isArray(def)) {
      const { includeId, ...cleanDef } = def;
      objDef[key] = cleanDef;
    } else {
      objDef[key] = def;
    }
    callHookSync("schema:object:field", { key, schema: shape[key], objDef, visited });
  }
  let result;
  const shouldBeSubSchema = isField && mongooseProp.schema !== false;
  if (isField && mongooseProp.schema === false && !mongooseProp.type && objectStrictness(unwrapped) !== true) {
    throw new Error(
      "A strict, loose, or catchall Zod object needs a Mongoose subschema. Remove {schema: false} or provide a Mongoose type override."
    );
  }
  if (shouldBeSubSchema && !mongooseProp.type) {
    const mongoose = getMongoose();
    if (mongoose) {
      const options = typeof mongooseProp.schema === "object" ? mongooseProp.schema : {};
      const { plugins, ...schemaOptions } = options;
      const strict = schemaOptions.strict ?? mongooseProp.strict ?? objectStrictness(unwrapped);
      const minimize = schemaOptions.minimize ?? mongooseProp.minimize ?? (objectStrictness(unwrapped) === false ? false : void 0);
      const subSchema = new mongoose.Schema(objDef, {
        ...schemaOptions,
        strict,
        ...minimize === void 0 ? {} : { minimize }
      });
      if (plugins && Array.isArray(plugins)) {
        for (const plugin of plugins) {
          subSchema.plugin(plugin);
        }
      }
      mongooseProp.type = subSchema;
    }
  }
  if (mongooseProp.type) {
    const mongoose = getMongoose();
    const isSchema = mongoose && (mongooseProp.type instanceof mongoose.Schema || mongooseProp.type.constructor?.name === "Schema");
    if (!isSchema) {
      Object.assign(mongooseProp, objDef);
    }
    result = mongooseProp;
  } else {
    Object.assign(mongooseProp, objDef);
    const topLevelOptions = /* @__PURE__ */ new Set([
      "collection",
      "versionKey",
      "timestamps",
      "discriminatorKey",
      "strict",
      "id",
      "_id",
      "minimize",
      "validateBeforeSave",
      "schema"
    ]);
    const hasFieldMetadata = Object.keys(mongooseProp).some((k) => {
      if (Object.prototype.hasOwnProperty.call(objDef, k)) return false;
      if (topLevelOptions.has(k)) return false;
      if (k === "required" && mongooseProp[k] === false) return false;
      return true;
    });
    result = hasFieldMetadata ? mongooseProp : objDef;
  }
  callHookSync("schema:object:after", { schema: unwrapped, mongooseProp, objDef, result });
  return result;
}
function handleArray(unwrapped, mongooseProp, visited, extractMongooseDef) {
  callHookSync("schema:array:before", { schema: unwrapped, mongooseProp, visited });
  const element = unwrapped.element || unwrapped._def.valueType || unwrapped._def.rest || unwrapped._def.items?.[0];
  const mongoose = getMongoose();
  const innerDef = element ? extractMongooseDef(element, visited) : mongoose?.Schema.Types.Mixed || "Mixed";
  if (!mongooseProp.type) {
    if (innerDef && typeof innerDef === "object" && innerDef.__isDiscriminatorUnion && mongoose) {
      const discriminators = {};
      for (const [dKey, dDef] of Object.entries(innerDef.discriminators)) {
        discriminators[dKey] = new mongoose.Schema(dDef, { _id: false });
      }
      mongooseProp.type = [
        new mongoose.Schema(
          {},
          {
            discriminatorKey: innerDef.discriminatorKey,
            _id: false
          }
        )
      ];
      mongooseProp.discriminators = discriminators;
    } else {
      const innerType = innerDef.type || innerDef;
      mongooseProp.type = [innerType];
      if (typeof innerDef === "object") {
        const innerMeta = { ...innerDef };
        delete innerMeta.type;
        Object.assign(mongooseProp, innerMeta);
        mongooseProp.type = [innerType];
      }
    }
  }
  callHookSync("schema:array:after", { schema: unwrapped, mongooseProp, innerDef });
}
function handleRecord(unwrapped, mongooseProp, visited, extractMongooseDef) {
  callHookSync("schema:record:before", { schema: unwrapped, mongooseProp, visited });
  const type = unwrapped._def?.type;
  const isMap = type === "map";
  const valueType = unwrapped.valueType || unwrapped.valueSchema || unwrapped._def.valueType || unwrapped._def.valueSchema || unwrapped._def.innerType;
  let innerDef;
  if (!mongooseProp.type || mongooseProp.type === Map || mongooseProp.type === Object) {
    mongooseProp.type = isMap ? Map : Object;
    const finalValueType = valueType || unwrapped.valueSchema || unwrapped._def?.valueSchema;
    if (finalValueType) {
      innerDef = extractMongooseDef(finalValueType, visited);
      mongooseProp.of = innerDef.type || innerDef;
    }
  }
  callHookSync("schema:record:after", { schema: unwrapped, mongooseProp, innerDef });
}

function areDefinitionsEqual(left, right, seen = /* @__PURE__ */ new WeakMap()) {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return false;
  }
  const mongoose = getMongoose();
  const leftIsSchema = mongoose && left instanceof mongoose.Schema;
  const rightIsSchema = mongoose && right instanceof mongoose.Schema;
  if (leftIsSchema || rightIsSchema) {
    return Boolean(
      leftIsSchema && rightIsSchema && areDefinitionsEqual(left.obj, right.obj, seen)
    );
  }
  let seenRight = seen.get(left);
  if (seenRight?.has(right)) return true;
  if (!seenRight) {
    seenRight = /* @__PURE__ */ new WeakSet();
    seen.set(left, seenRight);
  }
  seenRight.add(right);
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => areDefinitionsEqual(value, right[index], seen));
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(right, key) && areDefinitionsEqual(left[key], right[key], seen)
  );
}
function extractMongooseDef(schema, visited = /* @__PURE__ */ new Map(), isField = false, noWrap = false) {
  if (visited.size === 0) {
    callHookSync("converter:before", { schema, visited });
  }
  callHookSync("converter:start", { schema, visited });
  const { schema: unwrapped, features } = unwrapZodSchema(schema);
  const meta = mongooseRegistry.get(schema) || {};
  const mongooseProp = getMongooseMeta(schema);
  callHookSync("converter:unwrapped", {
    schema,
    unwrapped,
    features,
    meta: mongooseProp,
    mongooseProp
  });
  if (features.isOptional === true && mongooseProp.type && mongooseProp.required !== true) {
    mongooseProp.required = false;
  }
  if (visited.has(schema)) {
    const existing = visited.get(schema);
    if (existing === mongooseProp) {
      return existing;
    }
    if (Object.keys(meta).length > 0) {
      Object.assign(existing, mongooseProp);
    }
    return existing;
  }
  visited.set(schema, mongooseProp);
  if (features.default !== void 0) {
    mongooseProp.default = features.default;
  }
  if (features.required === false) {
    mongooseProp.required = false;
  }
  if (features.isNullable === true && mongooseProp.required === void 0) {
    mongooseProp.required = false;
  }
  if (features.isNonOptional === true && features.isNullable !== true && mongooseProp.required !== false) {
    mongooseProp.required = true;
  }
  if (features.readOnly === true) {
    mongooseProp.readOnly = true;
  }
  if (isField && features.isExactOptional === true) {
    const previousSetter = mongooseProp.set;
    mongooseProp.set = function exactOptionalSetter(value) {
      if (value === void 0) {
        throw new TypeError("An exactOptional field cannot be set to undefined");
      }
      return typeof previousSetter === "function" ? previousSetter.call(this, value) : value;
    };
  }
  mapZodChecksToMongoose(features.checks, mongooseProp);
  const def = unwrapped._def;
  if (!def) {
    callHookSync("converter:after", {
      schema,
      mongooseProp
    });
    return mongooseProp;
  }
  const { type } = def;
  callHookSync("converter:node", {
    schema: unwrapped,
    mongooseProp,
    type
  });
  if (type === "object") {
    const wrapperFn = (s, v) => extractMongooseDef(s, v, true);
    const previousUnwrapped = schema === unwrapped ? void 0 : visited.get(unwrapped);
    const result = handleObject(unwrapped, mongooseProp, visited, wrapperFn, isField && !noWrap);
    visited.set(schema, result);
    if (schema !== unwrapped) {
      if (previousUnwrapped === void 0) visited.delete(unwrapped);
      else visited.set(unwrapped, previousUnwrapped);
    }
    callHookSync("converter:after", {
      schema,
      mongooseProp: result
    });
    if (typeof result === "object" && result !== null && !Array.isArray(result)) {
      delete result.includeId;
    }
    return result;
  }
  if (type === "array" || type === "set" || type === "tuple") {
    handleArray(unwrapped, mongooseProp, visited, (s, v) => extractMongooseDef(s, v, true));
  }
  if (type === "record" || type === "map") {
    handleRecord(unwrapped, mongooseProp, visited, (s, v) => extractMongooseDef(s, v, true));
  }
  if (type === "intersection") {
    const left = extractMongooseDef(unwrapped._def.left, visited, isField, true);
    const right = extractMongooseDef(unwrapped._def.right, visited, isField, true);
    if (typeof left === "object" && typeof right === "object") {
      Object.assign(mongooseProp, left, right);
      if (isField && !noWrap && mongooseProp.schema !== false && !mongooseProp.type) {
        const mongoose = getMongoose();
        if (mongoose) {
          const options = typeof mongooseProp.schema === "object" ? mongooseProp.schema : {};
          const { plugins, ...schemaOptions } = options;
          const definition = { ...mongooseProp };
          delete definition.schema;
          const subSchema = new mongoose.Schema(definition, schemaOptions);
          if (plugins && Array.isArray(plugins)) {
            for (const plugin of plugins) {
              subSchema.plugin(plugin);
            }
          }
          mongooseProp.type = subSchema;
          for (const key of Object.keys(mongooseProp)) {
            if (key !== "type") delete mongooseProp[key];
          }
        }
      }
    } else if (!mongooseProp.type) {
      mongooseProp.type = getMongoose()?.Schema.Types.Mixed || "Mixed";
    }
  }
  if ((type === "union" || type === "discriminatedunion" || type === "discriminated_union" || type === "xor") && !mongooseProp.type) {
    const mongoose = getMongoose();
    const options = unwrapped.options || unwrapped._def.options;
    const discriminatorKey = unwrapped._def.discriminator;
    const unionCtx = {
      isSimpleUnion: false,
      isObjectUnion: false,
      isXor: type === "xor" || (unwrapped._def?.inclusive === false || schema._def?.inclusive === false) && !discriminatorKey && !schema._def?.discriminator
    };
    if (Array.isArray(options) && options.length > 0) {
      unionCtx.isSimpleUnion = options.every((opt) => {
        const { type: type2 } = unwrapZodSchema(opt).schema._def;
        return ["string", "number", "boolean", "date", "bigint", "literal"].includes(type2);
      });
      unionCtx.isObjectUnion = options.every((opt) => {
        const { type: type2 } = unwrapZodSchema(opt).schema._def;
        return type2 === "object";
      });
    }
    callHookSync("schema:union:before", { schema: unwrapped, mongooseProp, ctx: unionCtx });
    if (discriminatorKey && unionCtx.isObjectUnion) {
      const discriminators = {};
      const allOptionDefs = [];
      for (const option of options) {
        const { schema: unwrappedOpt } = unwrapZodSchema(option);
        const { shape } = unwrappedOpt._def;
        const discriminatorProp = shape[discriminatorKey];
        const { schema: unwrappedDisc } = unwrapZodSchema(discriminatorProp);
        const discriminatorValue = unwrappedDisc._def.value ?? unwrappedDisc._def.values?.[0];
        const optionDef = extractMongooseDef(option, /* @__PURE__ */ new Map(), true, true);
        if (optionDef && typeof optionDef === "object" && !Array.isArray(optionDef)) {
          const cleanOptionDef = { ...optionDef };
          delete cleanOptionDef[discriminatorKey];
          discriminators[discriminatorValue] = cleanOptionDef;
          allOptionDefs.push(cleanOptionDef);
        }
      }
      const baseDef = {};
      if (allOptionDefs.length > 0) {
        const firstOption = allOptionDefs[0];
        for (const key of Object.keys(firstOption)) {
          const isCommon = allOptionDefs.every((def2) => {
            if (!(key in def2)) return false;
            return areDefinitionsEqual(def2[key], firstOption[key]);
          });
          if (isCommon) {
            baseDef[key] = firstOption[key];
            for (const def2 of allOptionDefs) {
              delete def2[key];
            }
          }
        }
      }
      const result = {
        __isDiscriminatorUnion: true,
        discriminatorKey,
        discriminators,
        baseDef,
        validate: {
          validator(_v) {
            try {
              const mongoose2 = getMongoose();
              const doc = mongoose2 && this instanceof mongoose2.Document ? this.toObject() : this || {};
              schema.parse(doc);
              return true;
            } catch (err) {
              const message = err?.errors?.[0]?.message || err.message;
              if (this && typeof this.invalidate === "function") {
                this.invalidate(discriminatorKey, `Zod validation failed: ${message}`);
              }
              return false;
            }
          },
          message: (props) => `Validation failed for ${props.path}`
        }
      };
      if (mongooseProp && typeof mongooseProp === "object" && !Array.isArray(mongooseProp)) {
        Object.assign(mongooseProp, result);
        callHookSync("schema:union:after", {
          schema: unwrapped,
          mongooseProp,
          ctx: unionCtx
        });
        return mongooseProp;
      }
      callHookSync("schema:union:after", {
        schema: unwrapped,
        mongooseProp: result,
        ctx: unionCtx
      });
      return result;
    }
    if (getMongoose()?.Schema.Types.Union && unionCtx.isSimpleUnion && options.length > 0 && !unionCtx.isXor) {
      mongooseProp.type = mongoose.Schema.Types.Union;
      mongooseProp.of = options.map((opt) => {
        const def2 = extractMongooseDef(opt, visited, true, true);
        return def2.type || def2;
      });
    } else if (unionCtx.isObjectUnion && options.length > 0) {
      const mergedDef = {};
      for (const opt of options) {
        const def2 = extractMongooseDef(opt, /* @__PURE__ */ new Map(), true, true);
        if (typeof def2 === "object" && def2 !== null) {
          for (const [key, prop] of Object.entries(def2)) {
            if (typeof prop === "object" && prop !== null && !Array.isArray(prop)) {
              prop.required = false;
            }
            if (mergedDef[key] && typeof mergedDef[key] === "object" && typeof prop === "object" && !Array.isArray(mergedDef[key]) && !Array.isArray(prop)) {
              const existingType = mergedDef[key].type || mergedDef[key].instance || (typeof mergedDef[key] === "function" ? mergedDef[key] : null);
              const newType = prop.type || prop.instance || (typeof prop === "function" ? prop : null);
              const isMixed = (t) => !t || t === "Mixed" || t === "SchemaMixed" || t?.name === "Mixed" || t?.instance === "Mixed" || t?.name === "SchemaMixed" || t?.instance === "SchemaMixed" || getMongoose()?.Schema.Types.Mixed && (t === getMongoose()?.Schema.Types.Mixed || t?.instance === "Mixed" || t?.instance === "SchemaMixed");
              if (isMixed(existingType) && !isMixed(newType)) {
                mergedDef[key] = prop;
              } else if (!isMixed(existingType) && isMixed(newType)) ; else {
                Object.assign(mergedDef[key], prop);
              }
            } else if (!mergedDef[key] || typeof mergedDef[key] !== "object" || Array.isArray(mergedDef[key])) {
              mergedDef[key] = prop;
            }
          }
        }
      }
      if (isField && unionCtx.isXor) {
        mongooseProp.type = mongoose?.Schema.Types.Mixed || "Mixed";
        mongooseProp.validate = {
          validator(v) {
            try {
              schema.parse(v);
              return true;
            } catch {
              return false;
            }
          },
          message: "XOR validation failed"
        };
      } else {
        if (!mongooseProp.type || mongooseProp.type === (getMongoose()?.Schema.Types.Mixed || "Mixed")) {
          delete mongooseProp.type;
        }
        Object.assign(mongooseProp, mergedDef);
        if (isField && Object.prototype.hasOwnProperty.call(mongooseProp, "type") && Object.keys(mongooseProp).length > 1) {
          const mongooseInstance2 = getMongoose();
          if (mongooseInstance2) {
            mongooseProp.type = new mongooseInstance2.Schema(mongooseProp, { _id: false });
            for (const key of Object.keys(mongooseProp)) {
              if (key !== "type") delete mongooseProp[key];
            }
          }
        }
      }
    } else {
      mongooseProp.type = mongoose?.Schema.Types.Mixed || "Mixed";
      if (isField && (type === "xor" || type === "discriminated_union" || type === "discriminatedunion" || type === "union") && !mongooseProp.ref && // Skip Zod validation for populated fields
      !Array.isArray(mongooseProp.type) && // Skip Zod validation for arrays
      mongooseProp.type !== Map && // Skip Zod validation for maps
      !mongooseProp.of) {
        mongooseProp.validate = {
          validator(v) {
            try {
              schema.parse(v);
              return true;
            } catch (err) {
              return false;
            }
          },
          message: (props) => {
            if (unionCtx.isXor) return "XOR validation failed";
            try {
              schema.parse(props.value);
            } catch (err) {
              return `Union validation failed: ${err.message}`;
            }
            return "Union validation failed";
          }
        };
      }
    }
    callHookSync("schema:union:after", {
      schema: unwrapped,
      mongooseProp,
      ctx: unionCtx
    });
  }
  if (type === "literal" && !mongooseProp.type) {
    mongooseProp.type = getMongoose()?.Schema.Types.Mixed || "Mixed";
  }
  switch (type) {
    case "string":
    case "number":
    case "boolean":
    case "date":
    case "bigint":
    case "stringbool":
    case "boolstring":
    case "booleanstring": {
      if (!mongooseProp.type) {
        if (type === "bigint") {
          mongooseProp.type = typeof BigInt === "undefined" ? Number : BigInt;
        } else {
          const typeMap = {
            string: String,
            number: Number,
            boolean: Boolean,
            date: Date,
            stringbool: Boolean,
            boolstring: Boolean,
            booleanstring: Boolean
          };
          mongooseProp.type = typeMap[type];
          if (mongooseProp.default !== void 0) {
            const defaultType = typeof mongooseProp.default;
            if (defaultType === "boolean" && type !== "boolean") {
              mongooseProp.type = Boolean;
            } else if (defaultType === "number" && type !== "number") {
              mongooseProp.type = Number;
            } else if (defaultType === "string" && type !== "string") {
              mongooseProp.type = String;
            } else if (mongooseProp.default instanceof Date && type !== "date") {
              mongooseProp.type = Date;
            }
          }
          if (mongooseProp.type === String && features.transformations) {
            for (const tx of features.transformations) {
              const txStr = tx.transform?.toString() || tx.toString();
              if (txStr.includes("stringbool") || txStr.includes("boolstring") || txStr.includes("booleanstring")) {
                mongooseProp.type = Boolean;
                break;
              }
              if (txStr.includes('=== "true"') || txStr.includes("=== 'true'")) {
                mongooseProp.type = Boolean;
                break;
              }
            }
          }
        }
      }
      if (mongooseProp.required !== false) mongooseProp.required = true;
      break;
    }
    case "enum":
    case "nativeenum":
    case "native_enum": {
      if (!mongooseProp.type) mongooseProp.type = String;
      mongooseProp.enum = type === "enum" ? unwrapped.options || def.values : Object.values(unwrapped.enum || def.values);
      if (mongooseProp.required !== false) mongooseProp.required = true;
      break;
    }
  }
  const mongooseInstance = getMongoose();
  if (type === "any" || type === "unknown" || type === "custom") {
    const cls = def.cls || unwrapped.cls;
    if (cls === Buffer || typeof Uint8Array !== "undefined" && cls === Uint8Array) {
      if (!mongooseProp.type) mongooseProp.type = mongooseInstance?.Schema.Types.Buffer || "Buffer";
    } else if ((cls?.name === "ObjectId" || mongooseInstance && cls === mongooseInstance.Types.ObjectId) && !mongooseProp.type) {
      mongooseProp.type = mongooseInstance?.Schema.Types.ObjectId || "ObjectId";
    }
  }
  if (type === "lazy") {
    const inner = def.getter();
    const result = extractMongooseDef(inner, visited, isField);
    if (Object.keys(meta).length > 0 && result !== mongooseProp) {
      if (typeof result === "object" && !Array.isArray(result)) {
        Object.assign(mongooseProp, result);
      } else {
        mongooseProp.type = result.type || result;
      }
      return mongooseProp;
    }
    return result;
  }
  if (!mongooseProp.type && type !== "object") {
    mongooseProp.type = getMongoose()?.Schema.Types.Mixed || "Mixed";
  }
  callHookSync("converter:after", {
    schema,
    mongooseProp
  });
  if (typeof mongooseProp === "object" && mongooseProp !== null && !Array.isArray(mongooseProp)) {
    delete mongooseProp.includeId;
  }
  return mongooseProp;
}

function modelNameFromCollection(collection) {
  const singular = collection.replace(/ies$/i, "y").replace(/(ses|xes|zes|ches|shes)$/i, (suffix) => suffix.slice(0, -2)).replace(/s$/i, "");
  return singular.slice(0, 1).toUpperCase() + singular.slice(1);
}
function toMongooseSchema(schema, options) {
  const { schema: unwrapped } = unwrapZodSchema(schema);
  const meta = mongooseRegistry.get(schema) || mongooseRegistry.get(unwrapped) || schema.meta?.() || unwrapped.meta?.() || {};
  const { plugins, modelName, ...schemaOptions } = options || {};
  const mergedOptions = {
    ...unwrapped instanceof z.ZodObject ? { strict: objectStrictness(unwrapped) } : {},
    ...unwrapped instanceof z.ZodObject && objectStrictness(unwrapped) === false ? { minimize: false } : {},
    // Also merge other schema options from meta if they exist
    ...meta.collection ? { collection: meta.collection } : {},
    // eslint-disable-next-line unicorn/no-negated-condition
    ...meta.strict !== void 0 ? { strict: meta.strict } : {},
    // eslint-disable-next-line unicorn/no-negated-condition
    ...meta.minimize !== void 0 ? { minimize: meta.minimize } : {},
    // eslint-disable-next-line unicorn/no-negated-condition
    ...meta.validateBeforeSave !== void 0 ? { validateBeforeSave: meta.validateBeforeSave } : {},
    // eslint-disable-next-line unicorn/no-negated-condition
    ...meta.versionKey !== void 0 ? { versionKey: meta.versionKey } : {},
    ...meta.id === void 0 ? {} : { id: meta.id },
    ...meta._id === void 0 ? {} : { _id: meta._id },
    ...meta.timestamps ? { timestamps: meta.timestamps } : {},
    ...meta.discriminatorKey ? { discriminatorKey: meta.discriminatorKey } : {},
    ...schemaOptions
  };
  let definition = extractMongooseDef(schema, /* @__PURE__ */ new Map(), false);
  const mongoose = getMongoose();
  if (!mongoose) {
    throw new Error(
      "Mongoose must be installed to use toMongooseSchema. If you are in an ESM environment, ensure mongoose is loaded."
    );
  }
  let mongooseSchema;
  if (definition && typeof definition === "object" && definition.__isDiscriminatorUnion) {
    const baseModelName = modelName || schemaOptions.collection && modelNameFromCollection(schemaOptions.collection);
    if (!baseModelName) {
      throw new Error(
        "toMongooseSchema() found a top-level discriminated union. Provide `modelName` or `collection` so discriminator model names can be made unique, for example `{ modelName: 'Activity' }`."
      );
    }
    const { discriminatorKey, discriminators, baseDef, validate } = definition;
    mongooseSchema = new mongoose.Schema(baseDef, {
      ...mergedOptions,
      discriminatorKey
    });
    if (validate) {
      if (!mongooseSchema.path(discriminatorKey)) {
        mongooseSchema.add({ [discriminatorKey]: { type: String } });
      }
      mongooseSchema.path(discriminatorKey).validate(validate);
    }
    for (const [key, dDef] of Object.entries(discriminators)) {
      const discriminatorModelName = `${baseModelName}_${key}`;
      if (mongooseSchema.discriminators && mongooseSchema.discriminators[discriminatorModelName]) {
        continue;
      }
      mongooseSchema.discriminator(
        discriminatorModelName,
        new mongoose.Schema(dDef, { _id: false }),
        { value: key }
      );
    }
  } else {
    if (typeof definition === "object" && definition !== null) {
      const { includeId, ...cleanDefinition } = definition;
      definition = cleanDefinition;
      for (const value of Object.values(definition)) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          delete value.includeId;
        }
      }
    }
    mongooseSchema = new mongoose.Schema(definition, mergedOptions);
  }
  if (mergedOptions.validateBeforeSave !== false) {
    mongooseSchema.post("validate", function() {
      try {
        schema.parse(prepareForZodValidation(schema, this.toObject(), mongooseSchema));
      } catch (e) {
        if (e instanceof z.ZodError) {
          e.message = JSON.stringify({
            context: {
              model: this.constructor?.modelName || this.constructor?.name || "_unknown_",
              id: this._id?.toString() || this.id?.toString() || "_unknown_"
            },
            errors: e.issues || e.errors || []
          });
        }
        throw e;
      }
    });
  }
  if (plugins && Array.isArray(plugins)) {
    for (const plugin of plugins) {
      mongooseSchema.plugin(plugin);
    }
  }
  callHookSync("schema:created", {
    schema,
    mongooseSchema,
    options: mergedOptions
  });
  return mongooseSchema;
}

function populateZodSchema(schema, keys) {
  const { shape } = schema;
  const newShape = { ...shape };
  const keysToPopulate = keys || Object.keys(shape);
  const populateField = (field) => {
    const meta = getMongooseMeta(field);
    const { schema: unwrapped, features } = unwrapZodSchema(field);
    let result = field;
    if (meta?.refSchema) {
      result = meta.refSchema;
    } else if (unwrapped instanceof z.ZodArray) {
      const populatedInner = populateField(unwrapped.element);
      if (populatedInner !== unwrapped.element) {
        result = z.array(populatedInner);
      }
    } else if (unwrapped instanceof z.ZodObject) {
      result = populateZodSchema(unwrapped);
    }
    if (result !== field && result !== unwrapped) {
      if (features.isOptional && !(result instanceof z.ZodOptional)) result = result.optional();
      if (features.isNullable && !(result instanceof z.ZodNullable)) result = result.nullable();
      if (features.default !== void 0 && !(result instanceof z.ZodDefault)) result = result.default(features.default);
    }
    return result;
  };
  for (const key of keysToPopulate) {
    newShape[key] = populateField(shape[key]);
  }
  return z.object(newShape);
}
const genTimestampsSchema = (createdAtField = "createdAt", updatedAtField = "updatedAt") => {
  if (createdAtField != null && updatedAtField != null && createdAtField === updatedAtField) {
    throw new Error("`createdAt` and `updatedAt` fields must be different");
  }
  const shape = {};
  if (createdAtField != null) shape[createdAtField] = z.date().default(() => /* @__PURE__ */ new Date());
  if (updatedAtField != null) shape[updatedAtField] = z.date().default(() => /* @__PURE__ */ new Date());
  return shape;
};
const bufferMongooseGetter = (value) => value != null && value._bsontype === "Binary" ? value.buffer : value;

const position = z.tuple([z.number(), z.number()]);
const zPoint = (options) => withMongoose(
  z.object({
    type: withMongoose(z.literal("Point"), { type: String, enum: ["Point"], required: true }),
    coordinates: withMongoose(position, { required: true })
  }),
  { schema: { _id: false }, required: true, ...options }
);
const zPolygon = (options) => withMongoose(
  z.object({
    type: withMongoose(z.literal("Polygon"), { type: String, enum: ["Polygon"], required: true }),
    coordinates: withMongoose(
      z.array(
        z.array(position).refine(
          (ring) => ring.length >= 4 && ring[0]?.[0] === ring.at(-1)?.[0] && ring[0]?.[1] === ring.at(-1)?.[1],
          "Polygon rings must be closed"
        )
      ).refine((rings) => rings.length > 0, "Polygon must have at least one ring"),
      { required: true }
    )
  }),
  { schema: { _id: false }, required: true, ...options }
);

const preprocessFn = (val) => val === null ? void 0 : val;
const zObjectId = (options) => withMongoose(
  z.preprocess(preprocessFn, z.string().regex(/^[\dA-Fa-f]{24}$/, "Invalid ObjectId")),
  { type: "ObjectId", ...options }
);
const zBuffer = (options) => withMongoose(z.instanceof(Uint8Array), { type: "Buffer", ...options });
const zRef = (ref, schema, options) => {
  const objectIdSchema = zObjectId();
  const base = z.codec(z.union([objectIdSchema, schema]), objectIdSchema, {
    decode: (val) => typeof val === "object" && val !== null && "_id" in val ? val._id : val,
    encode: (val) => val
  });
  return withMongoose(base, {
    type: "ObjectId",
    ref,
    refSchema: schema,
    ...options
  });
};

function toStrictModel(name, mongooseSchema) {
  const m = getMongoose();
  if (!m) {
    throw new Error("Mongoose must be installed to use toStrictModel.");
  }
  const rawModel = m.model(name, mongooseSchema);
  return rawModel;
}

export { bufferMongooseGetter, callHookSync, extractMongooseDef, genTimestampsSchema, getFrontendMode, getMongoose, getMongooseMeta, hooks, mongooseRegistry, objectStrictness, populateZodSchema, setFrontendMode, setMongoose, toMongooseSchema, toStrictModel, unwrapZodSchema, withMongoose, zBuffer, zObjectId, zPoint, zPolygon, zRef };
//# sourceMappingURL=index.frontend.js.map

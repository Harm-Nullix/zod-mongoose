'use strict';

var v4 = require('zod/v4');
var mongoose = require('mongoose');

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
/**
 * Synchronous hook caller for Hookable.
 */
function callHookSync(name, ...args) {
    hooks.callHookWith((callbacks, args) => {
        for (const callback of callbacks) {
            callback(...args);
        }
    }, name, args);
}

/**
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
const mongooseRegistry = v4.z.registry();
/**
 * A clean wrapper to attach Mongoose metadata to any Zod schema.
 */
function withMongoose(schema, meta = {}) {
    callHookSync('registry:get:before', { schema });
    const existing = mongooseRegistry.get(schema) || {};
    callHookSync('registry:get', { schema, meta: existing });
    const merged = { ...existing, ...meta };
    callHookSync('registry:add', { schema, meta: merged });
    mongooseRegistry.add(schema, merged);
    callHookSync('registry:added', { schema, meta: merged });
    return schema;
}
/**
 * Recursively collect Mongoose metadata from a Zod schema and its wrappers.
 */
function getMongooseMeta(schema) {
    const def = schema._def;
    if (!def)
        return {};
    let meta = mongooseRegistry.get(schema) || {};
    // If it has an inner type (Optional, Nullable, Default, etc.), collect from it too
    if (def.innerType) {
        meta = { ...getMongooseMeta(def.innerType), ...meta };
    }
    else if (def.schema) {
        meta = { ...getMongooseMeta(def.schema), ...meta };
    }
    // Handle pipes (like z.codec)
    if (def.type === 'pipe') {
        // Collect from both 'in' and 'out' parts, preferring metadata from 'out' if it exists,
        // but the pipe itself usually holds the metadata we want.
        meta = { ...getMongooseMeta(def.in), ...getMongooseMeta(def.out), ...meta };
    }
    return meta;
}

/**
 * Recursively unwrap Zod schemas (Optional, Nullable, Default, Effects, Pipelines)
 * using Zod's public API and internal _def.type identifiers.
 */
function unwrapZodSchema(schema, 
// eslint-disable-next-line unicorn/no-object-as-default-parameter
features = { required: true }, visited = new Set()) {
    if (!schema)
        return { schema, features };
    if (visited.has(schema))
        return { schema, features };
    const def = schema._def;
    if (!def)
        return { schema, features };
    // Skip visited check for wrappers to allow deep unwrapping
    if (!(schema instanceof v4.z.ZodOptional) &&
        !(schema instanceof v4.z.ZodNullable) &&
        !(schema instanceof v4.z.ZodDefault) &&
        def.type !== 'pipe') {
        visited.add(schema);
    }
    if (schema instanceof v4.z.ZodOptional) {
        const inner = schema.unwrap();
        return unwrapZodSchema(
        // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
        inner, {
            ...features,
            required: false,
            isOptional: true,
        }, visited);
    }
    if (schema instanceof v4.z.ZodNullable) {
        return unwrapZodSchema(
        // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
        schema.unwrap(), {
            ...features,
            isNullable: true,
        }, visited);
    }
    if (schema instanceof v4.z.ZodDefault) {
        const defaultValue = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
        return unwrapZodSchema(def.innerType, {
            ...features,
            default: defaultValue,
        }, visited);
    }
    const { type } = def;
    // In Zod v4, transform, preprocess, and refine are often implemented as pipes.
    // For transform: in = schema, out = transformation
    // For preprocess: in = preprocessing, out = schema
    if (type === 'pipe') {
        const inType = def.in?._def?.type;
        const outType = def.out?._def?.type;
        if (inType === 'transform') {
            // It's a preprocess (in is transformation, out is schema)
            return unwrapZodSchema(def.out, features, visited);
        }
        if (outType === 'transform' || outType === 'refinement') {
            // It's a transform or refine (in is schema, out is logic)
            // We should still collect transformations from the 'out' part
            const transformFeatures = { ...features };
            const outDef = def.out?._def;
            const effects = outDef?.effects || outDef?.transformations || (outType === 'transform' ? [outDef] : []);
            if (effects && Array.isArray(effects)) {
                transformFeatures.transformations = [
                    ...(transformFeatures.transformations || []),
                    ...effects,
                ];
            }
            return unwrapZodSchema(def.in, transformFeatures, visited);
        }
        // Default pipe behavior (extract the output part)
        return unwrapZodSchema(def.out, features, visited);
    }
    if (type === 'transform' ||
        type === 'preprocess' ||
        type === 'refinement' ||
        type === 'effects') {
        const transformFeatures = { ...features };
        const effects = def.effects || def.transformations || (def.type === 'transform' || type === 'transform' ? [def] : []);
        if (effects && Array.isArray(effects)) {
            transformFeatures.transformations = [
                ...(transformFeatures.transformations || []),
                ...effects,
            ];
        }
        const inner = def.schema || def.innerType;
        if (inner) {
            const result = unwrapZodSchema(inner, transformFeatures, visited);
            return result;
        }
    }
    if (type === 'lazy') {
        // For lazy types, we need to be careful with infinite recursion.
        // If we've already seen this specific lazy schema in this unwrapping chain,
        // we return it as is to stop recursion.
        // NOTE: In Zod v4, getter() might return different objects each time if not careful.
        return { schema, features };
    }
    if (type === 'branded' || type === 'readonly') {
        return unwrapZodSchema(schema.unwrap(), {
            ...features,
            ...(type === 'readonly' ? { readOnly: true } : {}),
        }, visited);
    }
    // Extract checks if present
    if (def.checks && Array.isArray(def.checks)) {
        features.checks = [...(features.checks || []), ...def.checks];
    }
    return { schema, features };
}

let mongooseInstance = null;
/**
 * Manually set the Mongoose instance.
 * Useful in ESM environments where automatic detection via require() might fail.
 */
const setMongoose = (m) => {
    mongooseInstance = m;
};
// Helper to get mongoose instance safely
const getMongoose = () => {
    if (mongooseInstance) {
        return mongooseInstance;
    }
    try {
        // eslint-disable-next-line global-require
        const m = require('mongoose');
        if (m && (m.Schema || m.default?.Schema)) {
            return m.default || m;
        }
        return m;
    }
    catch {
        // Try to see if mongoose is globally available (e.g. in some environments)
        if (globalThis.mongoose) {
            return globalThis.mongoose;
        }
        return null;
    }
};
let isFrontend = false;
/**
 * Enable or disable frontend mode.
 * In frontend mode, specialized types like ObjectId and Buffer fall back to
 * simpler representations (strings/arrays) and do not depend on Mongoose.
 */
const setFrontendMode = (enabled) => {
    isFrontend = enabled;
};
const getFrontendMode = () => {
    // Try to auto-detect if not explicitly set
    // This is a simple heuristic: check for window/document
    if (isFrontend === undefined || isFrontend === null) {
        return globalThis.window !== undefined && globalThis.document !== undefined;
    }
    return isFrontend;
};

/**
 * Helper to map Zod checks (min, max, regex, etc.) to Mongoose Schema properties.
 */
function mapZodChecksToMongoose(checks, mongooseProp) {
    if (!checks || !Array.isArray(checks))
        return;
    for (const check of checks) {
        const traitSet = check._zod?.traits;
        const checkDef = check._zod?.def;
        if (!traitSet || !checkDef)
            continue;
        // String Lengths
        if (traitSet.has('$ZodCheckMinLength')) {
            mongooseProp.minlength = checkDef.minimum;
        }
        if (traitSet.has('$ZodCheckMaxLength')) {
            mongooseProp.maxlength = checkDef.maximum;
        }
        if (traitSet.has('$ZodCheckLengthEquals')) {
            mongooseProp.minlength = checkDef.length;
            mongooseProp.maxlength = checkDef.length;
        }
        // Numbers and Dates Comparisons
        if (traitSet.has('$ZodCheckGreaterThan')) {
            mongooseProp.min = checkDef.value;
        }
        if (traitSet.has('$ZodCheckLessThan')) {
            mongooseProp.max = checkDef.value;
        }
        // Regex / Match
        if (traitSet.has('$ZodCheckRegex')) {
            mongooseProp.match = checkDef.pattern;
        }
        // UUID
        if (traitSet.has('$ZodUUID')) {
            const mongoose = globalThis.mongoose || globalThis.__mongoose;
            if (mongoose?.Schema.Types.UUID) {
                mongooseProp.type = mongoose.Schema.Types.UUID;
            }
        }
        // ISO Formats
        if (traitSet.has('$ZodISODateTime') || traitSet.has('$ZodISODate')) {
            mongooseProp.type = Date;
        }
        // String Transforms (trim, lowercase, uppercase)
        if (traitSet.has('$ZodCheckOverwrite') && typeof checkDef.tx === 'function') {
            const txStr = checkDef.tx.toString();
            if (txStr.includes('.trim()')) {
                mongooseProp.trim = true;
            }
            else if (txStr.includes('.toLowerCase()')) {
                mongooseProp.lowercase = true;
            }
            else if (txStr.includes('.toUpperCase()')) {
                mongooseProp.uppercase = true;
            }
        }
    }
    callHookSync('validation:mappers', { checks, mongooseProp });
}

/**
 * Handles ZodObject conversion to Mongoose Schema definition.
 */
function handleObject(unwrapped, mongooseProp, visited, extractMongooseDef, isField = false) {
    callHookSync('schema:object:before', { schema: unwrapped, mongooseProp, visited });
    const { shape } = unwrapped;
    const objDef = {};
    // We must ensure recursive calls see the current object to break cycles.
    const placeholder = mongooseProp.type ? mongooseProp : objDef;
    visited.set(unwrapped, placeholder);
    // eslint-disable-next-line no-restricted-syntax
    for (const key in shape) {
        if (!Object.prototype.hasOwnProperty.call(shape, key))
            continue;
        // Skip automatic _id mapping unless explicitly requested
        if (key === '_id') {
            const idMeta = mongooseRegistry.get(shape[key]) || {};
            const unwrappedId = unwrapZodSchema(shape[key]).schema;
            const unwrappedIdMeta = mongooseRegistry.get(unwrappedId) || {};
            if (idMeta.includeId !== true &&
                unwrappedIdMeta.includeId !== true &&
                mongooseProp.includeId !== true) {
                continue;
            }
        }
        const def = extractMongooseDef(shape[key], visited);
        if (def && typeof def === 'object' && def.__isDiscriminatorUnion) {
            const mongoose = getMongoose();
            if (mongoose) {
                const baseSchema = new mongoose.Schema(def.baseDef, {
                    discriminatorKey: def.discriminatorKey,
                    _id: false,
                });
                const discriminators = {};
                for (const [dKey, dDef] of Object.entries(def.discriminators)) {
                    discriminators[dKey] = new mongoose.Schema(dDef, { _id: false });
                }
                objDef[key] = {
                    type: baseSchema,
                    discriminators,
                };
            }
            else {
                objDef[key] = def;
            }
        }
        else if (typeof def === 'object' && def !== null && !Array.isArray(def)) {
            const { includeId, ...cleanDef } = def;
            objDef[key] = cleanDef;
        }
        else {
            objDef[key] = def;
        }
        callHookSync('schema:object:field', { key, schema: shape[key], objDef, visited });
    }
    // If the developer didn't provide a strict Mongoose type override, return the shape
    let result;
    // Handle explicit or default subschema request
    const shouldBeSubSchema = isField && mongooseProp.schema !== false;
    if (shouldBeSubSchema && !mongooseProp.type) {
        const mongoose = getMongoose();
        if (mongoose) {
            const options = typeof mongooseProp.schema === 'object' ? mongooseProp.schema : {};
            const { plugins, ...schemaOptions } = options;
            const subSchema = new mongoose.Schema(objDef, schemaOptions);
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
        const isSchema = mongoose && (mongooseProp.type instanceof mongoose.Schema || mongooseProp.type.constructor?.name === 'Schema');
        // If there is a type override, merge the object definition into the result unless it's a Schema
        if (!isSchema) {
            Object.assign(mongooseProp, objDef);
        }
        result = mongooseProp;
    }
    else {
        Object.assign(mongooseProp, objDef);
        const topLevelOptions = new Set([
            'collection',
            'versionKey',
            'timestamps',
            'discriminatorKey',
            'strict',
            'id',
            '_id',
            'minimize',
            'validateBeforeSave',
            'schema',
        ]);
        const hasFieldMetadata = Object.keys(mongooseProp).some((k) => {
            if (Object.prototype.hasOwnProperty.call(objDef, k))
                return false;
            if (topLevelOptions.has(k))
                return false;
            if (k === 'required' && mongooseProp[k] === false)
                return false;
            return true;
        });
        result = hasFieldMetadata ? mongooseProp : objDef;
    }
    callHookSync('schema:object:after', { schema: unwrapped, mongooseProp, objDef, result });
    return result;
}
/**
 * Handles ZodArray, ZodSet, and ZodTuple conversion.
 */
function handleArray(unwrapped, mongooseProp, visited, extractMongooseDef) {
    callHookSync('schema:array:before', { schema: unwrapped, mongooseProp, visited });
    const element = unwrapped.element ||
        unwrapped._def.valueType ||
        unwrapped._def.rest ||
        unwrapped._def.items?.[0];
    const mongoose = getMongoose();
    const innerDef = element
        ? extractMongooseDef(element, visited)
        : mongoose?.Schema.Types.Mixed || 'Mixed';
    // If no explicit type override, wrap the inner definition in an array
    if (!mongooseProp.type) {
        if (innerDef && typeof innerDef === 'object' && innerDef.__isDiscriminatorUnion && mongoose) {
            // const baseSchema =
            // new mongoose.Schema(innerDef.baseDef, {
            //   discriminatorKey: innerDef.discriminatorKey,
            //   _id: false,
            // });
            const discriminators = {};
            for (const [dKey, dDef] of Object.entries(innerDef.discriminators)) {
                discriminators[dKey] = new mongoose.Schema(dDef, { _id: false });
            }
            mongooseProp.type = [
                new mongoose.Schema({}, {
                    discriminatorKey: innerDef.discriminatorKey,
                    _id: false,
                }),
            ];
            mongooseProp.discriminators = discriminators;
        }
        else {
            const innerType = innerDef.type || innerDef;
            mongooseProp.type = [innerType];
            // Transfer any metadata from the inner type (like 'ref') to the array definition
            if (typeof innerDef === 'object') {
                // eslint-disable-next-line sonarjs/no-unused-vars
                const { type: _extractedType, ...innerMeta } = innerDef;
                Object.assign(mongooseProp, innerMeta);
                mongooseProp.type = [innerType]; // Restore type as array
            }
        }
    }
    callHookSync('schema:array:after', { schema: unwrapped, mongooseProp, innerDef });
}
/**
 * Handles ZodRecord and ZodMap conversion.
 */
function handleRecord(unwrapped, mongooseProp, visited, extractMongooseDef) {
    callHookSync('schema:record:before', { schema: unwrapped, mongooseProp, visited });
    const type = unwrapped._def?.type;
    const isMap = type === 'map';
    const valueType = unwrapped.valueType ||
        unwrapped.valueSchema ||
        unwrapped._def.valueType ||
        unwrapped._def.valueSchema ||
        unwrapped._def.innerType; // For some Zod versions
    let innerDef;
    if (!mongooseProp.type || mongooseProp.type === Map || mongooseProp.type === Object) {
        // z.record() maps to a POJO (Object/Mixed), while z.map() maps to a Mongoose Map
        mongooseProp.type = isMap ? Map : Object;
        const finalValueType = valueType || unwrapped.valueSchema || unwrapped._def?.valueSchema;
        if (finalValueType) {
            innerDef = extractMongooseDef(finalValueType, visited);
            mongooseProp.of = innerDef.type || innerDef;
        }
    }
    callHookSync('schema:record:after', { schema: unwrapped, mongooseProp, innerDef });
}

/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
function extractMongooseDef(schema, visited = new Map(), isField = false, noWrap = false) {
    // Only call converter:before at the very beginning of a run
    if (visited.size === 0) {
        callHookSync('converter:before', { schema: schema, visited });
    }
    callHookSync('converter:start', { schema: schema, visited });
    const { schema: unwrapped, features } = unwrapZodSchema(schema);
    // Pull any explicitly registered Mongoose metadata (including from wrappers)
    const meta = mongooseRegistry.get(schema) || {};
    const mongooseProp = getMongooseMeta(schema);
    callHookSync('converter:unwrapped', {
        schema: schema,
        unwrapped,
        features,
        meta: mongooseProp,
        mongooseProp: mongooseProp,
    });
    if (features.isOptional === true && mongooseProp.type && mongooseProp.required !== true) {
        mongooseProp.required = false;
    }
    if (visited.has(schema)) {
        const existing = visited.get(schema);
        if (existing === mongooseProp) {
            return existing;
        }
        // console.log('Visited CACHE for', (unwrapped as any)._def.type, existing);
        if (Object.keys(meta).length > 0) {
            Object.assign(existing, mongooseProp);
        }
        return existing;
    }
    visited.set(schema, mongooseProp);
    // console.log('Visited set for', (unwrapped as any)._def.type, mongooseProp);
    if (features.default !== undefined) {
        mongooseProp.default = features.default;
    }
    if (features.required === false) {
        mongooseProp.required = false;
    }
    if (features.readOnly === true) {
        mongooseProp.readOnly = true;
    }
    // Map Zod checks to Mongoose options
    mapZodChecksToMongoose(features.checks, mongooseProp);
    const def = unwrapped._def;
    if (!def) {
        callHookSync('converter:after', {
            schema: schema,
            mongooseProp,
        });
        return mongooseProp;
    }
    const { type } = def;
    callHookSync('converter:node', {
        schema: unwrapped,
        mongooseProp,
        type,
    });
    // Handle recursion and specific types via separate handlers
    if (type === 'object') {
        const wrapperFn = (s, v) => extractMongooseDef(s, v, true);
        const result = handleObject(unwrapped, mongooseProp, visited, wrapperFn, isField && !noWrap);
        callHookSync('converter:after', {
            schema: schema,
            mongooseProp: result,
        });
        if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
            delete result.includeId;
        }
        return result;
    }
    if (type === 'array' || type === 'set' || type === 'tuple') {
        handleArray(unwrapped, mongooseProp, visited, (s, v) => extractMongooseDef(s, v, true));
    }
    if (type === 'record' || type === 'map') {
        handleRecord(unwrapped, mongooseProp, visited, (s, v) => extractMongooseDef(s, v, true));
    }
    // Handle Intersections
    if (type === 'intersection') {
        const left = extractMongooseDef(unwrapped._def.left, visited, isField, true);
        const right = extractMongooseDef(unwrapped._def.right, visited, isField, true);
        if (typeof left === 'object' && typeof right === 'object') {
            Object.assign(mongooseProp, left, right);
            if (isField && !noWrap && mongooseProp.schema !== false && !mongooseProp.type) {
                const mongoose = getMongoose();
                if (mongoose) {
                    const options = typeof mongooseProp.schema === 'object' ? mongooseProp.schema : {};
                    const { plugins, ...schemaOptions } = options;
                    const definition = { ...mongooseProp };
                    // Remove metadata fields that shouldn't be in the schema definition if they are top-level
                    delete definition.schema;
                    const subSchema = new mongoose.Schema(definition, schemaOptions);
                    if (plugins && Array.isArray(plugins)) {
                        for (const plugin of plugins) {
                            subSchema.plugin(plugin);
                        }
                    }
                    mongooseProp.type = subSchema;
                    // Clear other fields since they are now in subSchema
                    for (const key of Object.keys(mongooseProp)) {
                        if (key !== 'type')
                            delete mongooseProp[key];
                    }
                }
            }
        }
        else if (!mongooseProp.type) {
            mongooseProp.type = getMongoose()?.Schema.Types.Mixed || 'Mixed';
        }
    }
    if ((type === 'union' ||
        type === 'discriminatedunion' ||
        type === 'discriminated_union' ||
        type === 'xor') &&
        !mongooseProp.type) {
        const mongoose = getMongoose();
        const options = unwrapped.options || unwrapped._def.options;
        const discriminatorKey = unwrapped._def.discriminator;
        const unionCtx = {
            isSimpleUnion: false,
            isObjectUnion: false,
            isXor: type === 'xor' ||
                ((unwrapped._def?.inclusive === false ||
                    schema._def?.inclusive === false) &&
                    !discriminatorKey &&
                    !schema._def?.discriminator),
        };
        if (Array.isArray(options) && options.length > 0) {
            unionCtx.isSimpleUnion = options.every((opt) => {
                const { type } = unwrapZodSchema(opt).schema._def;
                return ['string', 'number', 'boolean', 'date', 'bigint', 'literal'].includes(type);
            });
            unionCtx.isObjectUnion = options.every((opt) => {
                const { type } = unwrapZodSchema(opt).schema._def;
                return type === 'object';
            });
        }
        callHookSync('schema:union:before', { schema: unwrapped, mongooseProp, ctx: unionCtx });
        if (discriminatorKey && unionCtx.isObjectUnion) {
            const discriminators = {};
            const allOptionDefs = [];
            for (const option of options) {
                const { schema: unwrappedOpt } = unwrapZodSchema(option);
                const { shape } = unwrappedOpt._def;
                const discriminatorProp = shape[discriminatorKey];
                // Support both ZodLiteral and ZodOptional/ZodDefault/ZodNullable wrapped literals
                const { schema: unwrappedDisc } = unwrapZodSchema(discriminatorProp);
                const discriminatorValue = unwrappedDisc._def.value ?? unwrappedDisc._def.values?.[0];
                // Use a fresh Map for each option to avoid cross-contamination of visited nodes
                const optionDef = extractMongooseDef(option, new Map(), true, true);
                if (optionDef && typeof optionDef === 'object' && !Array.isArray(optionDef)) {
                    const cleanOptionDef = { ...optionDef };
                    delete cleanOptionDef[discriminatorKey];
                    discriminators[discriminatorValue] = cleanOptionDef;
                    allOptionDefs.push(cleanOptionDef);
                }
            }
            // Identify common fields present in ALL options to move to baseDef
            const baseDef = {};
            if (allOptionDefs.length > 0) {
                const firstOption = allOptionDefs[0];
                for (const key of Object.keys(firstOption)) {
                    const isCommon = allOptionDefs.every((def) => {
                        if (!(key in def))
                            return false;
                        // Simple check for equality of definitions (can be improved)
                        return JSON.stringify(def[key]) === JSON.stringify(firstOption[key]);
                    });
                    if (isCommon) {
                        baseDef[key] = firstOption[key];
                        // Remove from discriminators to avoid duplication
                        for (const def of allOptionDefs) {
                            delete def[key];
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
                            // Ensure we include the discriminator key in the object being validated
                            const mongoose = getMongoose();
                            const doc = mongoose && this instanceof mongoose.Document ? this.toObject() : this || {};
                            schema.parse(doc);
                            return true;
                        }
                        catch (err) {
                            const message = err?.errors?.[0]?.message || err.message;
                            if (this && typeof this.invalidate === 'function') {
                                this.invalidate(discriminatorKey, `Zod validation failed: ${message}`);
                            }
                            return false;
                        }
                    },
                    message: (props) => `Validation failed for ${props.path}`,
                },
            };
            // If this is wrapped in a meta object, ensure we return the result properly
            if (mongooseProp && typeof mongooseProp === 'object' && !Array.isArray(mongooseProp)) {
                Object.assign(mongooseProp, result);
                callHookSync('schema:union:after', {
                    schema: unwrapped,
                    mongooseProp,
                    ctx: unionCtx,
                });
                return mongooseProp;
            }
            callHookSync('schema:union:after', {
                schema: unwrapped,
                mongooseProp: result,
                ctx: unionCtx,
            });
            return result;
        }
        if (getMongoose()?.Schema.Types.Union &&
            unionCtx.isSimpleUnion &&
            options.length > 0 &&
            !unionCtx.isXor) {
            mongooseProp.type = mongoose.Schema.Types.Union;
            mongooseProp.of = options.map((opt) => {
                const def = extractMongooseDef(opt, visited, true, true);
                return def.type || def;
            });
        }
        else if (unionCtx.isObjectUnion && options.length > 0) {
            // Merge all object properties into a single schema object
            const mergedDef = {};
            for (const opt of options) {
                const def = extractMongooseDef(opt, new Map(), true, true);
                if (typeof def === 'object' && def !== null) {
                    for (const [key, prop] of Object.entries(def)) {
                        if (typeof prop === 'object' && prop !== null && !Array.isArray(prop)) {
                            prop.required = false;
                        }
                        if (mergedDef[key] &&
                            typeof mergedDef[key] === 'object' &&
                            typeof prop === 'object' &&
                            !Array.isArray(mergedDef[key]) &&
                            !Array.isArray(prop)) {
                            const existingType = mergedDef[key].type ||
                                mergedDef[key].instance ||
                                (typeof mergedDef[key] === 'function' ? mergedDef[key] : null);
                            const newType = prop.type ||
                                prop.instance ||
                                (typeof prop === 'function' ? prop : null);
                            const isMixed = (t) => !t ||
                                t === 'Mixed' ||
                                t === 'SchemaMixed' ||
                                t?.name === 'Mixed' ||
                                t?.instance === 'Mixed' ||
                                t?.name === 'SchemaMixed' ||
                                t?.instance === 'SchemaMixed' ||
                                (getMongoose()?.Schema.Types.Mixed &&
                                    (t === getMongoose()?.Schema.Types.Mixed ||
                                        t?.instance === 'Mixed' ||
                                        t?.instance === 'SchemaMixed'));
                            if (isMixed(existingType) && !isMixed(newType)) {
                                mergedDef[key] = prop;
                            }
                            else if (!isMixed(existingType) && isMixed(newType)) ;
                            else {
                                Object.assign(mergedDef[key], prop);
                            }
                        }
                        else if (!mergedDef[key] ||
                            typeof mergedDef[key] !== 'object' ||
                            Array.isArray(mergedDef[key])) {
                            mergedDef[key] = prop;
                        }
                    }
                }
            }
            if (isField && unionCtx.isXor) {
                // For nested XOR, always use Mixed with validator to ensure mutual exclusivity
                mongooseProp.type = mongoose?.Schema.Types.Mixed || 'Mixed';
                mongooseProp.validate = {
                    validator(v) {
                        try {
                            schema.parse(v);
                            return true;
                        }
                        catch {
                            return false;
                        }
                    },
                    message: 'XOR validation failed',
                };
            }
            else {
                // For root or other object unions, merge properties
                if (!mongooseProp.type ||
                    mongooseProp.type === (getMongoose()?.Schema.Types.Mixed || 'Mixed')) {
                    delete mongooseProp.type;
                }
                Object.assign(mongooseProp, mergedDef);
                // If the object contains a 'type' property, Mongoose might misinterpret it as a field definition.
                // We can hint that it's a nested object by using a Schema if 'type' is present along with other fields.
                if (isField &&
                    Object.prototype.hasOwnProperty.call(mongooseProp, 'type') &&
                    Object.keys(mongooseProp).length > 1) {
                    const mongooseInstance = getMongoose();
                    if (mongooseInstance) {
                        mongooseProp.type = new mongooseInstance.Schema(mongooseProp, { _id: false });
                        for (const key of Object.keys(mongooseProp)) {
                            if (key !== 'type')
                                delete mongooseProp[key];
                        }
                    }
                }
            }
        }
        else {
            mongooseProp.type = mongoose?.Schema.Types.Mixed || 'Mixed';
            if (isField &&
                (type === 'xor' ||
                    type === 'discriminated_union' ||
                    type === 'discriminatedunion' ||
                    type === 'union') &&
                !mongooseProp.ref && // Skip Zod validation for populated fields
                !Array.isArray(mongooseProp.type) && // Skip Zod validation for arrays
                mongooseProp.type !== Map && // Skip Zod validation for maps
                !mongooseProp.of // Skip Zod validation for collections
            ) {
                mongooseProp.validate = {
                    validator(v) {
                        try {
                            schema.parse(v);
                            return true;
                        }
                        catch (err) {
                            return false;
                        }
                    },
                    message: (props) => {
                        if (unionCtx.isXor)
                            return 'XOR validation failed';
                        try {
                            schema.parse(props.value);
                        }
                        catch (err) {
                            return `Union validation failed: ${err.message}`;
                        }
                        return 'Union validation failed';
                    },
                };
            }
        }
        callHookSync('schema:union:after', {
            schema: unwrapped,
            mongooseProp,
            ctx: unionCtx,
        });
    }
    if (type === 'literal' && !mongooseProp.type) {
        mongooseProp.type = getMongoose()?.Schema.Types.Mixed || 'Mixed';
    }
    // Handle Primitives
    switch (type) {
        case 'string':
        case 'number':
        case 'boolean':
        case 'date':
        case 'bigint':
        case 'stringbool':
        case 'boolstring':
        case 'booleanstring': {
            if (!mongooseProp.type) {
                if (type === 'bigint') {
                    mongooseProp.type = typeof BigInt === 'undefined' ? Number : BigInt;
                }
                else {
                    const typeMap = {
                        string: String,
                        number: Number,
                        boolean: Boolean,
                        date: Date,
                        stringbool: Boolean,
                        boolstring: Boolean,
                        booleanstring: Boolean,
                    };
                    mongooseProp.type = typeMap[type];
                    // Clever inference: If a transform occurred (which we know if the Zod type
                    // is different from the default value type), prefer the default's type.
                    if (mongooseProp.default !== undefined) {
                        const defaultType = typeof mongooseProp.default;
                        if (defaultType === 'boolean' && type !== 'boolean') {
                            mongooseProp.type = Boolean;
                        }
                        else if (defaultType === 'number' && type !== 'number') {
                            mongooseProp.type = Number;
                        }
                        else if (defaultType === 'string' && type !== 'string') {
                            mongooseProp.type = String;
                        }
                        else if (mongooseProp.default instanceof Date && type !== 'date') {
                            mongooseProp.type = Date;
                        }
                    }
                    // Even cleverer: Check transformations for clues (e.g., stringbool, boolstring)
                    if (mongooseProp.type === String && features.transformations) {
                        for (const tx of features.transformations) {
                            const txStr = tx.transform?.toString() || tx.toString();
                            if (txStr.includes('stringbool') || txStr.includes('boolstring') || txStr.includes('booleanstring')) {
                                mongooseProp.type = Boolean;
                                break;
                            }
                            if (txStr.includes('=== "true"') || txStr.includes('=== \'true\'')) {
                                mongooseProp.type = Boolean;
                                break;
                            }
                        }
                    }
                }
            }
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        case 'enum':
        case 'nativeenum':
        case 'native_enum': {
            if (!mongooseProp.type)
                mongooseProp.type = String;
            mongooseProp.enum =
                type === 'enum'
                    ? unwrapped.options || def.values
                    : Object.values(unwrapped.enum || def.values);
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        // Do nothing
    }
    // Handle Specialized Types (Buffer, ObjectId)
    const mongooseInstance = getMongoose();
    if (type === 'any' || type === 'unknown' || type === 'custom') {
        const cls = def.cls || unwrapped.cls;
        if (cls === Buffer || (typeof Uint8Array !== 'undefined' && cls === Uint8Array)) {
            if (!mongooseProp.type)
                mongooseProp.type = mongooseInstance?.Schema.Types.Buffer || 'Buffer';
        }
        else if ((cls?.name === 'ObjectId' || (mongooseInstance && cls === mongooseInstance.Types.ObjectId)) &&
            !mongooseProp.type) {
            mongooseProp.type = mongooseInstance?.Schema.Types.ObjectId || 'ObjectId';
        }
    }
    // Handle Lazy (Recursion Support)
    if (type === 'lazy') {
        const inner = def.getter();
        const result = extractMongooseDef(inner, visited, isField);
        if (Object.keys(meta).length > 0 && result !== mongooseProp) {
            if (typeof result === 'object' && !Array.isArray(result)) {
                Object.assign(mongooseProp, result);
            }
            else {
                mongooseProp.type = result.type || result;
            }
            return mongooseProp;
        }
        return result;
    }
    // Fallback for z.any() or unhandled types
    if (!mongooseProp.type && type !== 'object') {
        mongooseProp.type = getMongoose()?.Schema.Types.Mixed || 'Mixed';
    }
    callHookSync('converter:after', {
        schema: schema,
        mongooseProp,
    });
    if (typeof mongooseProp === 'object' && mongooseProp !== null && !Array.isArray(mongooseProp)) {
        delete mongooseProp.includeId;
    }
    return mongooseProp;
}

/**
 * Converts a Zod schema to a Mongoose Schema instance.
 */
function toMongooseSchema(schema, options) {
    const { schema: unwrapped } = unwrapZodSchema(schema);
    const meta = mongooseRegistry.get(schema) ||
        mongooseRegistry.get(unwrapped) ||
        schema.meta?.() ||
        unwrapped.meta?.() ||
        {};
    const { plugins, ...schemaOptions } = options || {};
    const mergedOptions = {
        // Also merge other schema options from meta if they exist
        ...(meta.collection ? { collection: meta.collection } : {}),
        // eslint-disable-next-line unicorn/no-negated-condition
        ...(meta.strict !== undefined ? { strict: meta.strict } : {}),
        // eslint-disable-next-line unicorn/no-negated-condition
        ...(meta.minimize !== undefined ? { minimize: meta.minimize } : {}),
        // eslint-disable-next-line unicorn/no-negated-condition
        ...(meta.validateBeforeSave !== undefined ? { validateBeforeSave: meta.validateBeforeSave } : {}),
        // eslint-disable-next-line unicorn/no-negated-condition
        ...(meta.versionKey !== undefined ? { versionKey: meta.versionKey } : {}),
        ...(meta.id === undefined ? {} : { id: meta.id }),
        ...(meta._id === undefined ? {} : { _id: meta._id }),
        ...(meta.timestamps ? { timestamps: meta.timestamps } : {}),
        ...(meta.discriminatorKey ? { discriminatorKey: meta.discriminatorKey } : {}),
        ...schemaOptions,
    };
    let definition = extractMongooseDef(schema, new Map(), false);
    const mongoose = getMongoose();
    if (!mongoose) {
        throw new Error('Mongoose must be installed to use toMongooseSchema. If you are in an ESM environment, ensure mongoose is loaded.');
    }
    let mongooseSchema;
    if (definition && typeof definition === 'object' && definition.__isDiscriminatorUnion) {
        const { discriminatorKey, discriminators, baseDef, validate } = definition;
        mongooseSchema = new mongoose.Schema(baseDef, {
            ...mergedOptions,
            discriminatorKey,
        });
        if (validate) {
            if (!mongooseSchema.path(discriminatorKey)) {
                mongooseSchema.add({ [discriminatorKey]: { type: String } });
            }
            mongooseSchema.path(discriminatorKey).validate(validate);
        }
        for (const [key, dDef] of Object.entries(discriminators)) {
            if (mongooseSchema.discriminators && mongooseSchema.discriminators[key]) {
                continue;
            }
            mongooseSchema.discriminator(key, new mongoose.Schema(dDef, { _id: false }));
        }
    }
    else {
        // Strip internal includeId metadata that might have leaked into the definition
        if (typeof definition === 'object' && definition !== null) {
            // If it's a top-level object, it might have metadata fields directly
            const { includeId, ...cleanDefinition } = definition;
            definition = cleanDefinition;
            // Also clean any top-level field definitions
            for (const value of Object.values(definition)) {
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    delete value.includeId;
                }
            }
        }
        mongooseSchema = new mongoose.Schema(definition, mergedOptions);
    }
    // Apply plugins if provided in options
    if (plugins && Array.isArray(plugins)) {
        for (const plugin of plugins) {
            mongooseSchema.plugin(plugin);
        }
    }
    // Call schema:created hook
    callHookSync('schema:created', {
        schema,
        mongooseSchema,
        options: mergedOptions,
    });
    return mongooseSchema;
}

// ============================================================================
// 2. TIMESTAMPS & CORE HELPERS
// ============================================================================
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
        }
        else if (unwrapped instanceof v4.z.ZodArray) {
            const populatedInner = populateField(unwrapped.element);
            if (populatedInner !== unwrapped.element) {
                result = v4.z.array(populatedInner);
            }
        }
        else if (unwrapped instanceof v4.z.ZodObject) {
            result = populateZodSchema(unwrapped);
        }
        if (result !== field && result !== unwrapped) {
            if (features.isOptional && !(result instanceof v4.z.ZodOptional))
                result = result.optional();
            if (features.isNullable && !(result instanceof v4.z.ZodNullable))
                result = result.nullable();
            if (features.default !== undefined && !(result instanceof v4.z.ZodDefault))
                result = result.default(features.default);
        }
        return result;
    };
    for (const key of keysToPopulate) {
        newShape[key] = populateField(shape[key]);
    }
    return v4.z.object(newShape);
}
const genTimestampsSchema = (createdAtField = 'createdAt', updatedAtField = 'updatedAt') => {
    if (createdAtField != null &&
        updatedAtField != null &&
        createdAtField === updatedAtField) {
        throw new Error('`createdAt` and `updatedAt` fields must be different');
    }
    const shape = {};
    if (createdAtField != null)
        shape[createdAtField] = v4.z.date().default(() => new Date());
    if (updatedAtField != null)
        shape[updatedAtField] = v4.z.date().default(() => new Date());
    return shape;
};
const bufferMongooseGetter = (value) => value != null && value._bsontype === 'Binary' ? value.buffer : value;

const preprocessFn = (val) => (val === null ? undefined : val);
const zObjectId = (options) => {
    const mongooseInstance = getMongoose();
    const objectIdSchema = v4.z.custom((val) => mongooseInstance && val instanceof mongooseInstance.Types.ObjectId);
    const baseUnion = v4.z.preprocess(preprocessFn, v4.z.union([objectIdSchema, v4.z.string().regex(/^[\dA-Fa-f]{24}$/, 'Invalid ObjectId')]));
    // Define the input type validation (Accepts ObjectId OR String)
    const inputSchema = v4.z.codec(baseUnion, objectIdSchema, {
        decode: (val) => {
            if (!mongooseInstance)
                return val;
            // If it's already an instance, return it exactly as-is to preserve reference memory!
            if (val instanceof mongooseInstance.Types.ObjectId) {
                return val;
            }
            // Only construct a new one if it's a string representation
            return new mongooseInstance.Types.ObjectId(val);
        },
        encode: (val) => val.toString(),
    });
    // we force the type signature using an explicit cast on the returned Zod schema.
    return withMongoose(inputSchema, {
        type: mongooseInstance?.Schema.Types.ObjectId || 'ObjectId',
        ...options,
    });
};
const zBuffer = (options) => {
    const mongooseInstance = getMongoose();
    return withMongoose(v4.z.custom((val) => (mongooseInstance && val instanceof Buffer) || val instanceof Uint8Array), { type: mongooseInstance?.Schema.Types.Buffer || 'Buffer', ...options });
};
const zRef = (ref, schema, options) => {
    const mongooseInstance = getMongoose();
    const objectIdSchema = zObjectId();
    const base = v4.z.codec(v4.z.union([objectIdSchema, schema]), objectIdSchema, {
        decode: (val) => (typeof val === 'object' && val !== null && '_id' in val ? val._id : val),
        encode: (val) => val,
    });
    return withMongoose(base, {
        type: mongooseInstance?.Schema.Types.ObjectId || 'ObjectId',
        ref,
        refSchema: schema,
        ...options,
    });
};

// ============================================================================
// 6. INITIALIZATION RUNTIME COMPONENT
// ============================================================================
/**
 * Converts a standard Mongoose model into a `StrictModel` with advanced type-safe population.
 *
 * @template UserInferredType The Zod-inferred type of the document (e.g. `z.infer<typeof Schema>`).
 * @param name The model name to register or retrieve from Mongoose.
 * @param mongooseSchema The Mongoose schema instance.
 * @returns A `StrictModel` instance with enhanced type safety for population.
 *
 * @example
 * ```typescript
 * const PostModel = toStrictModel<Post>('Post', postSchema);
 * const post = await PostModel.findOne().populate('author').exec();
 * // post.author is now fully typed
 * ```
 */
function toStrictModel(name, mongooseSchema) {
    const rawModel = mongoose.model(name, mongooseSchema);
    return rawModel;
}

exports.bufferMongooseGetter = bufferMongooseGetter;
exports.callHookSync = callHookSync;
exports.extractMongooseDef = extractMongooseDef;
exports.genTimestampsSchema = genTimestampsSchema;
exports.getFrontendMode = getFrontendMode;
exports.getMongoose = getMongoose;
exports.getMongooseMeta = getMongooseMeta;
exports.hooks = hooks;
exports.mongooseRegistry = mongooseRegistry;
exports.populateZodSchema = populateZodSchema;
exports.setFrontendMode = setFrontendMode;
exports.setMongoose = setMongoose;
exports.toMongooseSchema = toMongooseSchema;
exports.toStrictModel = toStrictModel;
exports.withMongoose = withMongoose;
exports.zBuffer = zBuffer;
exports.zObjectId = zObjectId;
exports.zRef = zRef;
//# sourceMappingURL=index.cjs.map

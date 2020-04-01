"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const datasource_1 = require("autoinquirer/build/datasource");
const utils_1 = require("./utils");
const Handlebars = __importStar(require("handlebars"));
const separatorChoice = { type: 'separator' };
const defaultActions = {
    'object': ["back", "del", "exit"],
    'array': ["push", "back", "exit"]
};
function absolute(testPath, absolutePath) {
    if (testPath && testPath[0] === '/') {
        return testPath;
    }
    if (!testPath) {
        return absolutePath;
    }
    const p0 = absolutePath.split('/');
    const rel = testPath.split('/');
    while (rel.length) {
        const t = rel.shift();
        if (t === '.' || t === undefined) {
            continue;
        }
        else if (t === '..') {
            if (!p0.length) {
                continue;
            }
            p0.pop();
        }
        else {
            p0.push(t);
        }
    }
    return p0.join('/');
}
exports.absolute = absolute;
exports.lookupValues = (schemaPath = '', obj, currPath = '') => {
    const parts = typeof schemaPath === 'string' ? schemaPath.split('/') : schemaPath;
    const key = parts[0];
    const converted = currPath.split('/');
    let output = {};
    if (Array.isArray(obj)) {
        obj.map((itemObj) => {
            if (itemObj && (RegExp(key).test(itemObj._id) || key === itemObj.slug)) {
                const devPath = [...converted, itemObj._id];
                output = Object.assign(Object.assign({}, output), exports.lookupValues(parts.slice(1), itemObj, devPath.join('/')));
            }
            ;
        });
    }
    else if (obj[key]) {
        converted.push(key);
        return exports.lookupValues(parts.slice(1), obj[key], converted.join('/'));
    }
    else if (parts.length == 0) {
        return { [converted.join('/').replace(/^\//, '')]: obj };
    }
    return output;
};
class PromptBuilder extends datasource_1.DataRenderer {
    constructor(datasource) {
        super();
    }
    setDataSource(datasource) {
        this.datasource = datasource;
    }
    render(methodName, itemPath, propertySchema, propertyValue) {
        return __awaiter(this, void 0, void 0, function* () {
            if (methodName === "exit") {
                return null;
            }
            return this.evaluate(methodName, itemPath, propertySchema, propertyValue);
        });
    }
    getActions(itemPath, propertySchema) {
        const actions = [];
        const types = !Array.isArray(propertySchema.type) ? [propertySchema.type] : propertySchema.type;
        let defaultTypeActions = [];
        types.map(type => {
            if (defaultActions[type]) {
                defaultTypeActions = defaultTypeActions.concat(defaultActions[type].filter((item) => defaultTypeActions.indexOf(item) < 0));
            }
        });
        defaultTypeActions.map((name) => {
            if (name === "back") {
                if (itemPath) {
                    actions.push({ name: 'Back', value: { path: utils_1.backPath(itemPath) } });
                }
            }
            else if (propertySchema.readOnly !== true || name === "exit") {
                actions.push({ name: (name.slice(0, 1).toUpperCase() + name.slice(1)), value: { path: itemPath, type: name } });
            }
        });
        return actions;
    }
    checkAllowed(propertySchema, parentPropertyValue) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!propertySchema || !propertySchema.depends) {
                return true;
            }
            return parentPropertyValue ? !!utils_1.evalExpr(propertySchema.depends, parentPropertyValue) : true;
        });
    }
    makeMenu(itemPath, propertySchema, propertyValue) {
        return __awaiter(this, void 0, void 0, function* () {
            const baseChoices = yield this.getChoices(itemPath, propertySchema, propertyValue);
            const choices = [...baseChoices, separatorChoice];
            return {
                name: 'state',
                type: 'list',
                message: yield this.getName(propertyValue, null, propertySchema),
                choices: [...choices, ...this.getActions(itemPath, propertySchema)],
                pageSize: 20,
                path: itemPath
            };
        });
    }
    makePrompt(itemPath, propertySchema, propertyValue) {
        return __awaiter(this, void 0, void 0, function* () {
            const defaultValue = propertyValue !== undefined ? propertyValue : (propertySchema ? propertySchema.default : undefined);
            const isCheckbox = this.isCheckBox(propertySchema);
            const choices = yield this.getOptions(itemPath, propertySchema);
            return {
                name: `value`,
                message: `Enter ${propertySchema.type ? propertySchema.type.toString().toLowerCase() : 'value'}:`,
                default: defaultValue,
                disabled: !!propertySchema.readOnly,
                type: propertySchema.$widget || (propertySchema.type === 'boolean' ? 'confirm' :
                    (isCheckbox ? 'checkbox' :
                        (choices && choices.length ? 'list' :
                            'input'))),
                choices,
                path: itemPath,
            };
        });
    }
    getChoices(itemPath, propertySchema, propertyValue) {
        return __awaiter(this, void 0, void 0, function* () {
            const schemaPath = itemPath;
            const basePath = schemaPath && schemaPath.length ? `${schemaPath}/` : '';
            if (propertySchema) {
                switch (propertySchema.type) {
                    case 'string':
                    case 'number':
                    case 'boolean':
                        return null;
                    case 'object':
                        const propertyProperties = propertySchema.properties ? Object.assign({}, propertySchema.properties) : {};
                        if (propertySchema.patternProperties && utils_1.getType(propertyValue) === 'Object') {
                            const objProperties = Object.keys(propertySchema.properties) || [];
                            const otherProperties = Object.keys(propertyValue).filter((p) => p[0] !== '_' && !~objProperties.indexOf(p));
                            for (const key of otherProperties) {
                                const patternFound = Object.keys(propertySchema.patternProperties).find((pattern) => RegExp(pattern).test(key));
                                if (patternFound) {
                                    propertyProperties[key] = propertySchema.patternProperties[patternFound];
                                }
                            }
                        }
                        return yield Promise.all(Object.keys(propertyProperties).map((key) => __awaiter(this, void 0, void 0, function* () {
                            const property = propertyProperties[key];
                            let value = propertyValue && propertyValue[key];
                            if (!property) {
                                throw new Error(`${schemaPath}/${key} not found`);
                            }
                            return this.checkAllowed(property, propertyValue).then((allowed) => __awaiter(this, void 0, void 0, function* () {
                                const readOnly = (!!propertySchema.readOnly || !!property.readOnly);
                                const writeOnly = (!!propertySchema.writeOnly || !!property.writeOnly);
                                const item = {
                                    name: yield this.getName(value, key, property),
                                    value: { path: `${basePath}${key}` },
                                    disabled: !allowed || (this.isPrimitive(property) && readOnly && !writeOnly)
                                };
                                if (this.isPrimitive(property) && allowed && !readOnly || writeOnly) {
                                    item.value['type'] = "set";
                                }
                                return item;
                            }));
                        })));
                    case 'array':
                        const arrayItemSchema = propertySchema.items;
                        return yield Promise.all(Array.isArray(propertyValue) && propertyValue.map((arrayItem, idx) => __awaiter(this, void 0, void 0, function* () {
                            const myId = (arrayItem && (arrayItem.slug || arrayItem._id)) || idx;
                            const readOnly = (!!propertySchema.readOnly || !!arrayItemSchema.readOnly);
                            const writeOnly = (!!propertySchema.writeOnly || !!arrayItemSchema.writeOnly);
                            const item = {
                                disabled: this.isPrimitive(arrayItemSchema) && readOnly && !writeOnly,
                                name: yield this.getName(arrayItem, ~[arrayItem.name, arrayItem.title].indexOf(myId) ? null : myId, arrayItemSchema),
                                value: {
                                    path: `${basePath}${myId}`
                                }
                            };
                            if (this.isPrimitive(arrayItemSchema) && !readOnly || writeOnly) {
                                item.value['type'] = "set";
                            }
                            return item;
                        })) || []);
                    default:
                        return propertyValue && Object.keys(propertyValue).map((key) => {
                            return {
                                name: key,
                                value: {
                                    type: "set",
                                    path: `${basePath}${key}`
                                }
                            };
                        }) || [];
                }
            }
            return [];
        });
    }
    getName(value, propertyNameOrIndex, propertySchema) {
        return __awaiter(this, void 0, void 0, function* () {
            const head = propertyNameOrIndex !== null ? `${propertyNameOrIndex}: ` : '';
            let tail = '';
            if (propertySchema && propertySchema.$data && typeof propertySchema.$data === 'string') {
                propertySchema = yield this.datasource.getSchema(value);
                value = (yield this.datasource.dispatch('get', value)) || '';
            }
            if (propertySchema.hasOwnProperty('$title') && value) {
                const template = Handlebars.compile(propertySchema.$title);
                tail = template(value);
                if (tail) {
                    propertySchema = yield this.datasource.getSchema(tail);
                    if (propertySchema) {
                        value = (yield this.datasource.dispatch('get', tail)) || '';
                        return yield this.getName(value, null, propertySchema);
                    }
                }
            }
            else if ((propertySchema.type === 'object' || propertySchema.type === 'array') && propertySchema.title) {
                tail = propertySchema.title;
            }
            else if (propertySchema.type === 'array' && value && value.length) {
                tail = (yield Promise.all(value.map((i) => __awaiter(this, void 0, void 0, function* () { return yield this.getName(i, null, propertySchema.items); })))).join(', ');
            }
            else {
                tail = (value !== undefined && value !== null) ?
                    (propertySchema.type !== 'object' && propertySchema.type !== 'array' ? JSON.stringify(value) :
                        (value.title || value.name || `[${propertySchema.type}]`)) :
                    '';
            }
            if (tail && tail.length > 100) {
                tail = `${tail.slice(0, 97)}...`;
            }
            return `${head}${tail}`;
        });
    }
    isPrimitive(propertySchema = {}) {
        return ((propertySchema.type !== 'object' &&
            propertySchema.type !== 'array')) ||
            this.isSelect(propertySchema) ||
            this.isCheckBox(propertySchema);
    }
    isCheckBox(propertySchema) {
        if (propertySchema === undefined) {
            return false;
        }
        ;
        return propertySchema.type === 'array' &&
            this.isSelect(propertySchema.items);
    }
    isSelect(propertySchema) {
        if (propertySchema === undefined) {
            return false;
        }
        ;
        return propertySchema.enum !== undefined || propertySchema.$data !== undefined;
    }
    getOptions(itemPath, propertySchema) {
        return __awaiter(this, void 0, void 0, function* () {
            const isCheckBox = this.isCheckBox(propertySchema);
            const property = isCheckBox ? propertySchema.items : propertySchema;
            const dataPath = absolute(property.$data || '', itemPath);
            let $values = [], $schema;
            if (property.enum) {
                $values = property.enum || [];
            }
            else if (property.$data) {
                $values = (yield this.datasource.dispatch('get', dataPath)) || [];
                $schema = yield this.datasource.getSchema(dataPath);
                $schema = $schema.items || $schema;
            }
            else {
                $values = [];
            }
            return property.enum || (yield Promise.all($values.map((arrayItem) => __awaiter(this, void 0, void 0, function* () {
                return {
                    name: (utils_1.getType(arrayItem) === 'Object') ? yield this.getName(arrayItem, null, $schema) : arrayItem,
                    value: `${dataPath}/${arrayItem._id || arrayItem}`,
                    disabled: !!property.readOnly
                };
            })))) || [];
        });
    }
    evaluate(_, itemPath, propertySchema, propertyValue) {
        if (this.isPrimitive(propertySchema)) {
            return this.makePrompt(itemPath, propertySchema, propertyValue);
        }
        return this.makeMenu(itemPath, propertySchema, propertyValue);
    }
}
exports.PromptBuilder = PromptBuilder;

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
const autoinquirer_1 = require("autoinquirer");
const utils_1 = require("./utils");
const Handlebars = __importStar(require("handlebars"));
const chalk = require('chalk');
const separatorChoice = { type: 'separator' };
const defaultActions = {
    'object': ["back", "del", "exit"],
    'array': ["push", "back", "exit"]
};
function absolute(testPath, absolutePath) {
    if (testPath && testPath[0] !== '.') {
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
class PromptBuilder extends autoinquirer_1.Dispatcher {
    render(methodName, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (methodName === "exit") {
                return null;
            }
            let itemPath = (options === null || options === void 0 ? void 0 : options.itemPath) || '';
            let propertySchema = (options === null || options === void 0 ? void 0 : options.schema) || (yield this.getSchema({ itemPath }));
            let propertyValue = (options === null || options === void 0 ? void 0 : options.value) || (yield this.dispatch('get', Object.assign(Object.assign({}, options), { schema: propertySchema })));
            if (this.isPrimitive(propertySchema)) {
                return this.makePrompt(itemPath, propertySchema, propertyValue);
            }
            return this.makeMenu(itemPath, propertySchema, propertyValue);
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
            const choices = [separatorChoice, ...baseChoices, separatorChoice];
            return {
                name: 'state',
                type: 'list',
                message: (yield this.getName(propertyValue, null, propertySchema)).trim(),
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
            const choices = yield this.getOptions(itemPath, propertySchema, propertyValue);
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
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            let head = propertyNameOrIndex !== null ? `${propertyNameOrIndex}: ` : '';
            head = head.replace(/([A-Z]{2,})/g, " $1").replace(/([A-Z][a-z])/g, " $1");
            head = chalk.gray(head.charAt(0).toUpperCase() + head.slice(1)).padEnd(30);
            let tail = '';
            if (value && ((_a = propertySchema === null || propertySchema === void 0 ? void 0 : propertySchema.$data) === null || _a === void 0 ? void 0 : _a.path) && typeof propertySchema.$data.path === 'string') {
                const refSchema = yield this.getSchema({ itemPath: value });
                if (propertySchema === null || propertySchema === void 0 ? void 0 : propertySchema.$data) {
                    propertySchema = refSchema;
                    value = (yield this.dispatch('get', { itemPath: value })) || '';
                }
            }
            if (value && propertySchema.hasOwnProperty('$title')) {
                const template = Handlebars.compile(propertySchema.$title);
                tail = template(value).trim();
                if (tail && tail.indexOf('/')) {
                    tail = (yield Promise.all(tail.split(' ').map((labelPart) => __awaiter(this, void 0, void 0, function* () {
                        if (labelPart && labelPart.indexOf('/') > 3) {
                            propertySchema = yield this.getSchema({ itemPath: labelPart });
                            if (propertySchema && !propertySchema.$data) {
                                value = (yield this.dispatch('get', { itemPath: labelPart, schema: propertySchema })) || '';
                                return yield this.getName(value, null, propertySchema);
                            }
                        }
                        return labelPart;
                    })))).join(' ').trim();
                }
            }
            else if ((propertySchema.type === 'object' || propertySchema.type === 'array') && propertySchema.title) {
                tail = propertySchema.title;
            }
            else if (propertySchema.type === 'array' && value && value.length) {
                tail = (yield Promise.all(value.map((i) => __awaiter(this, void 0, void 0, function* () { return yield (yield this.getName(i, null, propertySchema.items)).trim(); })))).join(', ');
            }
            else {
                tail = (value !== undefined && value !== null) ?
                    (propertySchema.type !== 'object' && propertySchema.type !== 'array' ? JSON.stringify(value) :
                        (value.title || value.name || `[${propertySchema.type}]`)) :
                    '';
            }
            if (tail && tail.length > 90) {
                tail = `${tail.slice(0, 87)}...`;
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
    getOptions(itemPath, propertySchema, propertyValue) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const isCheckBox = this.isCheckBox(propertySchema);
            const property = isCheckBox ? propertySchema.items : propertySchema;
            const $data = (property === null || property === void 0 ? void 0 : property.$data) || ((_a = property === null || property === void 0 ? void 0 : property.items) === null || _a === void 0 ? void 0 : _a.$data);
            let dataPath = absolute(($data === null || $data === void 0 ? void 0 : $data.path) || '', itemPath);
            let $values = [], $schema;
            if (property.enum) {
                $values = property.enum || [];
            }
            else if ($data === null || $data === void 0 ? void 0 : $data.path) {
                $schema = yield this.getSchema({ itemPath: dataPath });
                $schema = $schema.items || $schema;
                $values = yield this.dispatch('get', { itemPath: dataPath, schema: $schema });
                if (!Array.isArray($values) && $values[$data.remoteField]) {
                    throw new Error("Promptbuilder: possible not allowed many2many relation. Make sure remote is inside an array");
                }
            }
            else {
                $values = [];
            }
            return property.enum || (yield Promise.all($values.map((arrayItem) => __awaiter(this, void 0, void 0, function* () {
                return {
                    name: (utils_1.getType(arrayItem) === 'Object') ? yield (yield this.getName(arrayItem._fullPath || arrayItem, null, $schema)).trim() : arrayItem,
                    value: arrayItem._fullPath || `${dataPath}/${arrayItem._id || arrayItem}`,
                    disabled: !!property.readOnly
                };
            })))) || [];
        });
    }
}
exports.PromptBuilder = PromptBuilder;

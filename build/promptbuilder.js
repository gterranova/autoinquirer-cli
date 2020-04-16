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
const datasource_1 = require("autoinquirer/build/datasource");
const utils_1 = require("./utils");
const Handlebars = __importStar(require("handlebars"));
const chalk = require('chalk');
;
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
exports.lookupValues = (itemPath = '', obj, currPath = '') => {
    const parts = typeof itemPath === 'string' ? itemPath.split('/') : itemPath;
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
            options.itemPath = yield this.convertPathToUri((options === null || options === void 0 ? void 0 : options.itemPath) || '');
            options.schema = (options === null || options === void 0 ? void 0 : options.schema) || (yield this.getSchema(options));
            options.value = (options === null || options === void 0 ? void 0 : options.value) || (yield this.dispatch('get', options));
            const { entryPointInfo } = yield this.getDataSourceInfo({ itemPath: options.itemPath });
            options.parentPath = entryPointInfo === null || entryPointInfo === void 0 ? void 0 : entryPointInfo.parentPath;
            if (this.isPrimitive(options.schema)) {
                return this.makePrompt(options);
            }
            return this.makeMenu(options);
        });
    }
    getActions(itemPath, schema) {
        const actions = [];
        const types = !Array.isArray(schema.type) ? [schema.type] : schema.type;
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
            else if (schema.readOnly !== true || name === "exit") {
                actions.push({ name: (name.slice(0, 1).toUpperCase() + name.slice(1)), value: { path: itemPath, type: name } });
            }
        });
        return actions;
    }
    checkAllowed(schema, parentValue) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!schema || !schema.depends) {
                return true;
            }
            return parentValue ? !!utils_1.evalExpr(schema.depends, parentValue) : true;
        });
    }
    makeMenu(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { itemPath, schema, value } = options;
            const baseChoices = yield this.getChoices(options);
            const choices = [separatorChoice, ...baseChoices, separatorChoice];
            return {
                name: 'state',
                type: 'list',
                message: (yield this.getName(options)).trim(),
                choices: [...choices, ...this.getActions(itemPath, schema)],
                pageSize: 20,
                path: itemPath
            };
        });
    }
    makePrompt(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { itemPath, schema, value } = options;
            const defaultValue = value !== undefined ? value : (schema ? schema.default : undefined);
            const isCheckbox = this.isCheckBox(schema);
            const choices = yield this.getOptions(options);
            return {
                name: `value`,
                message: `Enter ${schema.type ? schema.type.toString().toLowerCase() : 'value'}:`,
                default: defaultValue,
                disabled: !!schema.readOnly,
                type: schema.$widget || (schema.type === 'boolean' ? 'confirm' :
                    (isCheckbox ? 'checkbox' :
                        (choices && choices.length ? 'list' :
                            'input'))),
                choices,
                path: itemPath,
            };
        });
    }
    getChoices(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { itemPath, schema, value } = options;
            const basePath = itemPath && itemPath.length ? `${itemPath}/` : '';
            if (schema) {
                switch (schema.type) {
                    case 'string':
                    case 'number':
                    case 'boolean':
                        return null;
                    case 'object':
                        const propertyProperties = schema.properties ? Object.assign({}, schema.properties) : {};
                        if (schema.patternProperties && utils_1.getType(value) === 'Object') {
                            const objProperties = Object.keys(schema.properties) || [];
                            const otherProperties = Object.keys(value).filter((p) => p[0] !== '_' && !~objProperties.indexOf(p));
                            for (const key of otherProperties) {
                                const patternFound = Object.keys(schema.patternProperties).find((pattern) => RegExp(pattern).test(key));
                                if (patternFound) {
                                    propertyProperties[key] = schema.patternProperties[patternFound];
                                }
                            }
                        }
                        return yield Promise.all(Object.keys(propertyProperties).map((key) => __awaiter(this, void 0, void 0, function* () {
                            const property = propertyProperties[key];
                            if (!property) {
                                throw new Error(`${itemPath}${key} not found`);
                            }
                            return this.checkAllowed(property, value[key]).then((allowed) => __awaiter(this, void 0, void 0, function* () {
                                const readOnly = (!!schema.readOnly || !!property.readOnly);
                                const writeOnly = (!!schema.writeOnly || !!property.writeOnly);
                                const item = {
                                    name: (yield this.getName({ itemPath: `${basePath}${key}`, value: value[key], schema: property, parentPath: options.parentPath })),
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
                        const arrayItemSchema = schema.items;
                        return yield Promise.all(Array.isArray(value) && value.map((arrayItem, idx) => __awaiter(this, void 0, void 0, function* () {
                            const myId = (arrayItem && (arrayItem.slug || arrayItem._id)) || idx;
                            const readOnly = (!!schema.readOnly || !!arrayItemSchema.readOnly);
                            const writeOnly = (!!schema.writeOnly || !!arrayItemSchema.writeOnly);
                            const item = {
                                disabled: this.isPrimitive(arrayItemSchema) && readOnly && !writeOnly,
                                name: yield this.getName({ itemPath: `${basePath}${myId}`, value: arrayItem, schema: arrayItemSchema, parentPath: options.parentPath }),
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
                        return value && Object.keys(value).map((key) => {
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
    getName(options) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            options = options || {};
            options.itemPath = (options === null || options === void 0 ? void 0 : options.itemPath) || '';
            options.schema = (options === null || options === void 0 ? void 0 : options.schema) || (yield this.getSchema(options));
            options.value = (options === null || options === void 0 ? void 0 : options.value) || (yield this.dispatch('get', options));
            const { schema, parentPath = '' } = options;
            let value = options.value;
            const key = options.itemPath.split('/').pop();
            let head = '';
            if (!value || !(((_a = schema === null || schema === void 0 ? void 0 : schema.$data) === null || _a === void 0 ? void 0 : _a.path) || (schema === null || schema === void 0 ? void 0 : schema.$title) || /^[a-f0-9-]{24}/.test(key))) {
                head = `${key}: `.replace(/([A-Z]{2,})/g, " $1").replace(/([A-Z][a-z])/g, " $1");
                head = chalk.gray(head.charAt(0).toUpperCase() + head.slice(1)).padEnd(30);
            }
            let label = '';
            if (value && ((_b = schema === null || schema === void 0 ? void 0 : schema.$data) === null || _b === void 0 ? void 0 : _b.path)) {
                return yield this.getName({ itemPath: `${parentPath}${parentPath ? '/' : ''}${value}`, parentPath });
            }
            if ((schema === null || schema === void 0 ? void 0 : schema.$title) && value) {
                const template = Handlebars.compile(schema.$title);
                label = template(value).trim();
                if (label && label.indexOf('/')) {
                    label = (yield Promise.all(label.split(' ').map((labelPart) => __awaiter(this, void 0, void 0, function* () {
                        if (labelPart && labelPart.indexOf('/') > 3) {
                            const subRefSchema = yield this.getSchema({ itemPath: `${parentPath}${parentPath ? '/' : ''}${labelPart}`, parentPath });
                            if (subRefSchema && !subRefSchema.$data) {
                                return yield this.getName({ itemPath: `${parentPath}${parentPath ? '/' : ''}${labelPart}`, schema: subRefSchema, parentPath });
                            }
                        }
                        return labelPart;
                    })))).join(' ').trim();
                }
            }
            else if (((schema === null || schema === void 0 ? void 0 : schema.type) === 'object' || (schema === null || schema === void 0 ? void 0 : schema.type) === 'array') && (schema === null || schema === void 0 ? void 0 : schema.title)) {
                label = schema.title;
            }
            else if ((schema === null || schema === void 0 ? void 0 : schema.type) === 'array' && value && value.length) {
                label = (yield Promise.all(value.map((i, idx) => __awaiter(this, void 0, void 0, function* () { return yield (yield this.getName({ itemPath: `${options.itemPath}${options.itemPath ? '/' : ''}${i._id || idx}`, value: i, schema: schema.items, parentPath })).trim(); })))).join(', ');
            }
            if (!label) {
                label = (value !== undefined && value !== null) ?
                    ((schema === null || schema === void 0 ? void 0 : schema.type) !== 'object' && (schema === null || schema === void 0 ? void 0 : schema.type) !== 'array' ? JSON.stringify(value) :
                        (value.title || value.name || key || `[${schema === null || schema === void 0 ? void 0 : schema.type}]`)) :
                    '';
            }
            if (label && label.length > 90) {
                label = `${label.slice(0, 87)}...`;
            }
            return `${head}${label}`;
        });
    }
    isPrimitive(schema = {}) {
        return ((schema.type !== 'object' &&
            schema.type !== 'array')) ||
            this.isSelect(schema) ||
            this.isCheckBox(schema);
    }
    isCheckBox(schema) {
        if (schema === undefined) {
            return false;
        }
        ;
        return schema.type === 'array' &&
            this.isSelect(schema.items);
    }
    isSelect(schema) {
        if (schema === undefined) {
            return false;
        }
        ;
        return schema.enum !== undefined || schema.$data !== undefined;
    }
    getEnumValues(options) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { itemPath, schema } = options;
            const property = schema.items || schema;
            if (property.enum) {
                return { values: property.enum };
            }
            if (!((_a = property === null || property === void 0 ? void 0 : property.$data) === null || _a === void 0 ? void 0 : _a.path)) {
                return { values: [] };
            }
            const dataPath = absolute(property.$data.path, itemPath);
            const { dataSource, entryPointInfo } = yield this.getDataSourceInfo({ itemPath: dataPath });
            const newPath = dataSource instanceof datasource_1.AbstractDispatcher && (entryPointInfo === null || entryPointInfo === void 0 ? void 0 : entryPointInfo.parentPath) ?
                yield dataSource.convertPathToUri(dataPath.replace(entryPointInfo.parentPath, '').replace(/^\//, '')) :
                dataPath;
            return { dataSource, entryPointInfo, values: ((yield dataSource.dispatch('get', { itemPath: newPath })) || []) };
        });
    }
    getOptions(options) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { itemPath, schema } = options;
            const isCheckBox = this.isCheckBox(schema);
            const property = isCheckBox ? schema.items : schema;
            const $data = (property === null || property === void 0 ? void 0 : property.$data) || ((_a = property === null || property === void 0 ? void 0 : property.items) === null || _a === void 0 ? void 0 : _a.$data);
            let dataPath = yield this.convertPathToUri(absolute(($data === null || $data === void 0 ? void 0 : $data.path) || '', itemPath));
            let $values = [], $schema;
            if (property.enum) {
                $values = property.enum || [];
            }
            else if ($data === null || $data === void 0 ? void 0 : $data.path) {
                $schema = yield this.getSchema({ itemPath: dataPath });
                $schema = $schema.items || $schema;
                const enumValues = yield this.getEnumValues(options);
                $values = yield Promise.all(enumValues.values.map((value) => __awaiter(this, void 0, void 0, function* () {
                    var _b;
                    return {
                        name: (utils_1.getType(value) === 'Object') ? (yield this.getName({ itemPath: value._fullPath || `${dataPath}/${value._id || value}`, value: value, schema: $schema, parentPath: (_b = enumValues === null || enumValues === void 0 ? void 0 : enumValues.entryPointInfo) === null || _b === void 0 ? void 0 : _b.parentPath })).trim() : value,
                        value: value._fullPath || `${dataPath}/${value._id || value}`,
                        disabled: !!property.readOnly
                    };
                })));
            }
            return $values || [];
        });
    }
}
exports.PromptBuilder = PromptBuilder;

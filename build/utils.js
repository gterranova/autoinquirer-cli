"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
function evalStringExpression(expression, argNames) {
    try {
        if (expression.indexOf('this.field') !== -1) {
            console.warn(`NgxFormly: using 'this.field' in expressionProperties is deprecated since v5.1, use 'field' instead.`);
        }
        return Function(...argNames, `return ${expression};`);
    }
    catch (error) {
        console.error(error);
    }
}
exports.evalStringExpression = evalStringExpression;
function evalExpressionValueSetter(expression, argNames) {
    try {
        return Function(...argNames, `${expression} = expressionValue;`);
    }
    catch (error) {
        console.error(error);
    }
}
exports.evalExpressionValueSetter = evalExpressionValueSetter;
function evalExpression(expression, thisArg, argVal) {
    if (expression instanceof Function) {
        return expression.apply(thisArg, argVal);
    }
    else {
        return expression ? true : false;
    }
}
exports.evalExpression = evalExpression;
function defineHiddenProp(field, prop, defaultValue) {
    Object.defineProperty(field, prop, { enumerable: false, writable: true, configurable: true });
    field[prop] = defaultValue;
}
exports.defineHiddenProp = defineHiddenProp;
exports.backPath = (itemPath) => {
    if (!itemPath) {
        return '';
    }
    const parts = itemPath.split('/');
    parts.pop();
    return parts.join('/');
};
function loadJSON(fileName) {
    if (fileName && fs_1.default.existsSync(fileName)) {
        const buffer = fs_1.default.readFileSync(fileName);
        return JSON.parse(buffer.toString());
    }
    return undefined;
}
exports.loadJSON = loadJSON;
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
        if (t === '.') {
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
function getType(value) {
    const type = typeof value;
    if (type === 'object') {
        return value ? Object.prototype.toString.call(value).slice(8, -1) : 'null';
    }
    return type;
}
exports.getType = getType;
function objectId() {
    const now = new Date();
    const seconds = Math.floor(now.getTime() / 1000).toString(16);
    const machineId = crypto_1.default.createHash('md5').update(os_1.default.hostname()).digest('hex').slice(0, 6);
    const processId = process.pid.toString(16).slice(0, 4).padStart(4, '0');
    const counter = process.hrtime()[1].toString(16).slice(0, 6).padStart(6, '0');
    return seconds + machineId + processId + counter;
}
exports.objectId = objectId;
function findUp(name, fromPath) {
    const root = path_1.default.parse(fromPath).root;
    let currentDir = fromPath;
    while (currentDir && currentDir !== root) {
        const files = fs_1.default.readdirSync(currentDir);
        const match = files.find((f) => path_1.default.basename(f) === name);
        if (match) {
            return path_1.default.join(currentDir, match);
        }
        currentDir = path_1.default.dirname(currentDir);
    }
    return '';
}
exports.findUp = findUp;

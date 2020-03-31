// tslint:disable:no-any
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

export const backPath = (itemPath: string): string => {
    if (!itemPath) { return ''; }
    const parts = itemPath.split('/');
    parts.pop();
    
    return parts.join('/');
};


export function evalExpr(expression: string, context: any): boolean {
    try {
        // tslint:disable-next-line:no-eval no-function-expression
        return (function() { return eval(expression); }).bind(context).call(context);
    } catch (e) {
        // tslint:disable-next-line:prefer-template
        console.warn('•Expression: {{x \'' + expression + '\'}}\n•JS-Error: ', e, '\n•Context: ', context);
        
        return true;
    }    
}

// tslint:disable-next-line:no-any
export function loadJSON(fileName: string): any {
    if (fileName && fs.existsSync(fileName)) {
        const buffer: Buffer = fs.readFileSync(fileName);
        
        return JSON.parse(buffer.toString());
    }
    
    return undefined;
}

export function absolute(testPath: string, absolutePath: string): string {
    if (testPath && testPath[0] === '/') { return testPath; }
    if (!testPath) { return absolutePath; }
    const p0 = absolutePath.split('/');
    const rel = testPath.split('/');
    while (rel.length) { 
        const t = rel.shift(); 
        if (t === '.') { continue; } 
        else if (t === '..') { 
            if (!p0.length) {  
                continue;
            }
            p0.pop(); 
        } else { p0.push(t) } 
    }

    return p0.join('/');
}

export function getType(value: any): string {
    // tslint:disable-next-line:no-reserved-keywords
    const type = typeof value;
    if (type === 'object') {
        return value ? Object.prototype.toString.call(value).slice(8, -1) : 'null';
    }

    return type;
}

/**
 * Generates a MongoDB-style ObjectId in Node.js. Uses nanosecond timestamp in place of counter; 
 * should be impossible for same process to generate multiple objectId in same nanosecond? (clock 
 * drift can result in an *extremely* remote possibility of id conflicts).
 *
 * @returns {string} Id in same format as MongoDB ObjectId.
 */
export function objectId(): string {
    const now = new Date();
    const seconds = Math.floor(now.getTime()/1000).toString(16);
    const machineId = crypto.createHash('md5').update(os.hostname()).digest('hex').slice(0, 6);
    const processId = process.pid.toString(16).slice(0, 4).padStart(4, '0');
    const counter = process.hrtime()[1].toString(16).slice(0, 6).padStart(6, '0');

    return seconds + machineId + processId + counter;
}

export function findUp(name: string, fromPath: string): string {

    const root = path.parse(fromPath).root;

    let currentDir = fromPath;

    while (currentDir && currentDir !== root) {

        const files = fs.readdirSync(currentDir);

        const match = files.find((f: string) => path.basename(f) === name);
        if (match) {
            return path.join(currentDir, match);
        }
        currentDir = path.dirname(currentDir);
    }
    
    return '';
}
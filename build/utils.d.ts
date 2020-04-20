export declare function evalStringExpression(expression: string, argNames: string[]): any;
export declare function evalExpressionValueSetter(expression: string, argNames: string[]): (value: any) => void;
export declare function evalExpression(expression: string | Function | boolean, thisArg: any, argVal: any[]): any;
export declare function defineHiddenProp(field: any, prop: string, defaultValue: any): void;
export declare const backPath: (itemPath: string) => string;
export declare function loadJSON(fileName: string): any;
export declare function absolute(testPath: string, absolutePath: string): string;
export declare function getType(value: any): string;
export declare function objectId(): string;
export declare function findUp(name: string, fromPath: string): string;
//# sourceMappingURL=utils.d.ts.map
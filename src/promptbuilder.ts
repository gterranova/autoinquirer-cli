// tslint:disable:no-console

import { Action, IProperty, PrimitiveType } from 'autoinquirer/build/interfaces';
import { INameValueState, IPrompt,  } from './interfaces';

import { Dispatcher } from 'autoinquirer';
import { DataRenderer } from 'autoinquirer/build/datasource';
import { backPath, evalExpr, getType } from './utils';
import * as Handlebars from 'handlebars';

// tslint:disable-next-line:no-any
export declare type Item = any;

const separatorChoice = {type: 'separator'};

const defaultActions: { [key: string]: string[] } = {
    'object': [Action.BACK, Action.DEL, Action.EXIT],
    'array': [Action.PUSH, Action.BACK, Action.EXIT]
};

export const lookupValues = (schemaPath: string | string[] = '', obj: any, currPath: string = ''): any => {
    const parts = typeof schemaPath === 'string' ? schemaPath.split('/') : schemaPath;
    const key = parts[0];
    const converted = currPath.split('/');
    let output = {};
    if (Array.isArray(obj)) {
        obj.map( (itemObj: any) => {
            if (itemObj && (RegExp(key).test(itemObj._id) || key === itemObj.slug)) {
                const devPath = [...converted, itemObj._id];
                output = {...output, ...lookupValues(parts.slice(1), itemObj, devPath.join('/'))};
            }; 
        });
    } else if (obj[key]) {
        converted.push(key);
        return lookupValues(parts.slice(1), obj[key], converted.join('/'));
    } else if (parts.length == 0) {
        //console.log("FOUND?", obj);
        return { [converted.join('/').replace(/^\//,'')]: obj };
    }
    return output;    
}

export class PromptBuilder extends DataRenderer {
    private datasource: Dispatcher;

    constructor(datasource?: Dispatcher) {
        super();
        //this.datasource = datasource;
    }

    public setDataSource(datasource: Dispatcher) {
        this.datasource = datasource;
    }

    public async render(methodName: string, itemPath: string, propertySchema: IProperty, propertyValue: Item): Promise<IPrompt> {
        if (methodName === Action.EXIT) { return null; }

        return this.evaluate(methodName, itemPath, propertySchema, propertyValue);
    }
    
    private getActions(itemPath: string, propertySchema: IProperty): INameValueState[] {
        const actions: INameValueState[] = [];
        const types = !Array.isArray(propertySchema.type)? [propertySchema.type] : propertySchema.type;
        let defaultTypeActions = [];
        types.map( type => {
            if (defaultActions[type]) {
                defaultTypeActions = defaultTypeActions.concat(defaultActions[type].filter(
                    (item) => defaultTypeActions.indexOf(item) < 0));
            }
        });
        defaultTypeActions.map( (name: string) => {
            if (name === Action.BACK) {
                if (itemPath) {
                    actions.push({ name: 'Back', value: { path: backPath(itemPath) }});
                }
            } else if (propertySchema.readOnly !== true || name === Action.EXIT) {
                actions.push({ name: (name.slice(0,1).toUpperCase()+name.slice(1)), value: { path: itemPath, type: name }});
            }
        });

        return actions;
    } 

    private async checkAllowed(propertySchema: IProperty, parentPropertyValue: Item): Promise<boolean> {
        if (!propertySchema || !propertySchema.depends) { return true; }

        return parentPropertyValue? !!evalExpr(propertySchema.depends, parentPropertyValue): true;
    }

    private async makeMenu(itemPath: string, propertySchema: IProperty, propertyValue: Item): Promise<IPrompt> {
        // select item
        const baseChoices = await this.getChoices(itemPath, propertySchema, propertyValue);

        const choices = [...baseChoices, separatorChoice];
                
        return {
            name: 'state',
            type: 'list',
            message: await this.getName(propertyValue, null, propertySchema),
            choices: [...choices, ...this.getActions(itemPath, propertySchema)],
            pageSize: 20,
            path: itemPath
        };
    }
    
    private async makePrompt(itemPath: string, propertySchema: IProperty, propertyValue: Item): Promise<IPrompt> {        
        const defaultValue = propertyValue!==undefined ? propertyValue : (propertySchema ? propertySchema.default : undefined);
        const isCheckbox = this.isCheckBox(propertySchema);
        const choices = await this.getOptions(propertySchema);

        return {
            name: `value`,
            message: `Enter ${propertySchema.type ? propertySchema.type.toString().toLowerCase(): 'value'}:`,
            default: defaultValue,
            disabled: !!propertySchema.readOnly,
            type: propertySchema.$widget || (propertySchema.type==='boolean'? 'confirm': 
                (isCheckbox? 'checkbox':
                    (choices && choices.length? 'list':
                        'input'))),
            choices,
            path: itemPath,
        };
    }

    private async getChoices(itemPath: string, propertySchema: IProperty, propertyValue: Item): Promise<INameValueState[]> {
        const schemaPath = itemPath;

        const basePath = schemaPath && schemaPath.length ? `${schemaPath}/`: '';
        if (propertySchema) {
            switch (propertySchema.type) {

                case 'string':
                case 'number':
                case 'boolean':
                    return null; 
                case 'object':
                    const propertyProperties = propertySchema.properties? {...propertySchema.properties } : {};
                    if (propertySchema.patternProperties && getType(propertyValue) === 'Object') {
                        const objProperties = Object.keys(propertySchema.properties) || [];
                        // tslint:disable-next-line:no-bitwise
                        const otherProperties = Object.keys(propertyValue).filter( (p: string) => p[0] !== '_' && !~objProperties.indexOf(p) );
                        for (const key of otherProperties) {
                            const patternFound = Object.keys(propertySchema.patternProperties).find( (pattern: string) => RegExp(pattern).test(key));
                            if (patternFound) {
                                propertyProperties[key] = propertySchema.patternProperties[patternFound];
                            }            
                        }    
                    }

                    // tslint:disable-next-line:no-return-await
                    return await Promise.all(Object.keys(propertyProperties).map( async (key: string) => {
                        const property: IProperty = propertyProperties[key];
                        let value = propertyValue && propertyValue[key];
                        if (!property) {
                            throw new Error(`${schemaPath}/${key} not found`);
                        }
                        
                        return this.checkAllowed(property, propertyValue).then( async (allowed: boolean) => {
                            const readOnly = (!!propertySchema.readOnly || !!property.readOnly);
                            const writeOnly = (!!propertySchema.writeOnly || !!property.writeOnly);
                            const item: INameValueState = { 
                                name: await this.getName(value, key, property), 
                                value: { path: `${basePath}${key}` },
                                disabled: !allowed || (this.isPrimitive(property) && readOnly && !writeOnly)
                            };
                            if (this.isPrimitive(property) && allowed && !readOnly || writeOnly) { 
                                // tslint:disable-next-line:no-string-literal
                                item.value['type'] = Action.SET; 
                            }
                            
                            return item;    
                        });

                    }));

                case 'array':
                    const arrayItemSchema: IProperty = propertySchema.items;

                    return await Promise.all(Array.isArray(propertyValue) && propertyValue.map( async (arrayItem: Item, idx: number) =>{
                        const myId = (arrayItem && (arrayItem.slug || arrayItem._id)) || idx;
                        const readOnly = (!!propertySchema.readOnly || !!arrayItemSchema.readOnly);
                        const writeOnly = (!!propertySchema.writeOnly || !!arrayItemSchema.writeOnly);
                        const item: INameValueState = { 
                            disabled: this.isPrimitive(arrayItemSchema) && readOnly && !writeOnly,
                            name: await this.getName(arrayItem, ~[arrayItem.name, arrayItem.title].indexOf(myId)? null : myId, arrayItemSchema), 
                            value: {  
                                path: `${basePath}${myId}`
                            } 
                        };
                        if (this.isPrimitive(arrayItemSchema) && !readOnly || writeOnly) { 
                            // tslint:disable-next-line:no-string-literal
                            item.value['type'] = Action.SET; 
                        }
                    
                        return item;
                    }) || []);

                default:
                    return propertyValue && Object.keys(propertyValue).map( (key: string) => {
                        return { 
                            name: key, 
                            value: {  
                                type: Action.SET,
                                path: `${basePath}${key}`
                            } 
                        };
                    }) || [];        
            }    
        }
        
        return [];
    }

    private async getName(value: Item, propertyNameOrIndex: string | number, propertySchema: IProperty): Promise<string> {
        const head = propertyNameOrIndex !== null ? `${propertyNameOrIndex}: `:'';
        let tail = '';
        if (propertySchema && propertySchema.$data && typeof propertySchema.$data === 'string') {
            propertySchema = await this.datasource.getSchema(value);
            value = await this.datasource.dispatch('get', value) || '';
        }
        if (propertySchema.hasOwnProperty('$title') && value) {
            const template = Handlebars.compile(propertySchema.$title);
            tail = template(value);
            if (tail) {
                propertySchema = await this.datasource.getSchema(tail);
                if (propertySchema) {
                    value = await this.datasource.dispatch('get', tail) || '';
                    return await this.getName(value, null, propertySchema);
                }    
            }
        } else if ((propertySchema.type === 'object' || propertySchema.type === 'array') && propertySchema.title) {
            tail = propertySchema.title;
        } else if (propertySchema.type === 'array' && value && value.length) {
            tail = (await Promise.all(value.map( async i => await this.getName(i, null, propertySchema.items) ))).join(', ');
        } else {
            tail = (value !== undefined && value !== null) ?
            (propertySchema.type !== 'object' && propertySchema.type !== 'array' ? JSON.stringify(value) :  
                (value.title || value.name || `[${propertySchema.type}]`)):
            '';
        }
        if (tail && tail.length > 100) {
            tail = `${tail.slice(0,97)}...`;
        }
        return `${head}${tail}`;
    }

    private isPrimitive(propertySchema: IProperty = {}): boolean {
        return ((propertySchema.type !== 'object' && 
            propertySchema.type !== 'array')) || 
            this.isSelect(propertySchema) ||
            this.isCheckBox(propertySchema);
    }

    private isCheckBox(propertySchema: IProperty): boolean {
        if (propertySchema === undefined) { return false; };

        return propertySchema.type === 'array' && 
            this.isSelect(propertySchema.items);
    }

    private isSelect(propertySchema: IProperty): boolean {
        if (propertySchema === undefined) { return false; };

        return propertySchema.enum !== undefined || propertySchema.$data !== undefined;
    }

    private async getOptions(propertySchema: IProperty): Promise<INameValueState[] | PrimitiveType[] | IProperty[]> {
        const isCheckBox = this.isCheckBox(propertySchema);
        
        const property = isCheckBox? propertySchema.items : propertySchema;
        const $values = property ? property.$values: []; 
        if (getType($values) === 'Object') {
            return await Promise.all(Object.keys($values).map( async (key: string) => {
                return { 
                    name: getType($values[key]) === 'Object'? await this.getName($values[key], null, await this.datasource.getSchema(key)): $values[key], 
                    value: key,
                    disabled: !!property.readOnly
                };
            }));
        }

        return isCheckBox? propertySchema.items.enum : propertySchema.enum;         
    }
        
    private evaluate(_: string, itemPath: string, propertySchema: IProperty, propertyValue: Item): Promise<IPrompt> {
        if (this.isPrimitive(propertySchema)) {
            return this.makePrompt(itemPath, propertySchema, propertyValue);
        }

        return this.makeMenu(itemPath, propertySchema, propertyValue);
    }

}

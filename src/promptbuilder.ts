// tslint:disable:no-console

import { Action, IProperty, PrimitiveType, IDispatchOptions, IProxyInfo } from 'autoinquirer/build/interfaces';
import { INameValueState, IPrompt,  } from './interfaces';

import { Dispatcher } from 'autoinquirer';
import { IDataRenderer, AbstractDispatcher, AbstractDataSource } from 'autoinquirer/build/datasource';
import { backPath, evalExpr, getType } from './utils';
import * as Handlebars from 'handlebars';
const chalk = require('chalk');

// tslint:disable-next-line:no-any
export declare type Item = any;

interface IEntryPointInfo {
    proxyInfo: IProxyInfo;
    parentPath: string;
    objPath: string;
};

const separatorChoice = {type: 'separator'};

const defaultActions: { [key: string]: string[] } = {
    'object': [Action.BACK, Action.DEL, Action.EXIT],
    'array': [Action.PUSH, Action.BACK, Action.EXIT]
};

export function absolute(testPath: string, absolutePath: string): string {
    if (testPath && testPath[0] !== '.') { return testPath; }
    if (!testPath) { return absolutePath; }
    const p0 = absolutePath.split('/');
    const rel = testPath.split('/');
    while (rel.length) { 
        const t = rel.shift(); 
        if (t === '.' || t === undefined) { continue; } 
        else if (t === '..') { 
            if (!p0.length) {  
                continue;
            }
            p0.pop(); 
        } else { p0.push(t) } 
    }

    return p0.join('/');
}

export const lookupValues = (itemPath: string | string[] = '', obj: any, currPath: string = ''): any => {
    const parts = typeof itemPath === 'string' ? itemPath.split('/') : itemPath;
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

export class PromptBuilder extends Dispatcher implements IDataRenderer {

    public async render(methodName: string, options?: IDispatchOptions): Promise<IPrompt> {
        if (methodName === Action.EXIT) { return null; }

        options.itemPath = await this.convertPathToUri(options?.itemPath || '');
        options.schema = options?.schema || await this.getSchema(options);
        options.value = options?.value || await this.dispatch('get', options);
        const { entryPointInfo } = await this.getDataSourceInfo({ itemPath: options.itemPath });   
        options.parentPath = entryPointInfo?.parentPath;

        if (this.isPrimitive(options.schema)) {
            return this.makePrompt(options);
        }

        return this.makeMenu(options);
    }
    
    private getActions(itemPath: string, schema: IProperty): INameValueState[] {
        const actions: INameValueState[] = [];
        const types = !Array.isArray(schema.type)? [schema.type] : schema.type;
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
            } else if (schema.readOnly !== true || name === Action.EXIT) {
                actions.push({ name: (name.slice(0,1).toUpperCase()+name.slice(1)), value: { path: itemPath, type: name }});
            }
        });

        return actions;
    } 

    private async checkAllowed(schema: IProperty, parentValue: Item): Promise<boolean> {
        if (!schema || !schema.depends) { return true; }

        return parentValue? !!evalExpr(schema.depends, parentValue): true;
    }

    private async makeMenu(options: IDispatchOptions): Promise<IPrompt> {
        const { itemPath, schema, value } = options;
        // select item
        const baseChoices = await this.getChoices(options);

        const choices = [separatorChoice, ...baseChoices, separatorChoice];
                
        return {
            name: 'state',
            type: 'list',
            message: (await this.getName(options)).trim(),
            choices: [...choices, ...this.getActions(itemPath, schema)],
            pageSize: 20,
            path: itemPath
        };
    }
    
    private async makePrompt(options: IDispatchOptions): Promise<IPrompt> {        
        const { itemPath, schema, value } = options;
        const defaultValue = value!==undefined ? value : (schema ? schema.default : undefined);
        const isCheckbox = this.isCheckBox(schema);
        const choices = await this.getOptions(options);

        return {
            name: `value`,
            message: `Enter ${schema.type ? schema.type.toString().toLowerCase(): 'value'}:`,
            default: defaultValue,
            disabled: !!schema.readOnly,
            type: schema.$widget || (schema.type==='boolean'? 'confirm': 
                (isCheckbox? 'checkbox':
                    (choices && choices.length? 'list':
                        'input'))),
            choices,
            path: itemPath,
        };
    }

    private async getChoices(options: IDispatchOptions): Promise<INameValueState[]> {
        const { itemPath, schema, value } = options;

        const basePath = itemPath && itemPath.length ? `${itemPath}/`: '';
        if (schema) {
            switch (schema.type) {

                case 'string':
                case 'number':
                case 'boolean':
                    return null; 
                case 'object':
                    const propertyProperties = schema.properties? {...schema.properties } : {};
                    if (schema.patternProperties && getType(value) === 'Object') {
                        const objProperties = Object.keys(schema.properties) || [];
                        // tslint:disable-next-line:no-bitwise
                        const otherProperties = Object.keys(value).filter( (p: string) => p[0] !== '_' && !~objProperties.indexOf(p) );
                        for (const key of otherProperties) {
                            const patternFound = Object.keys(schema.patternProperties).find( (pattern: string) => RegExp(pattern).test(key));
                            if (patternFound) {
                                propertyProperties[key] = schema.patternProperties[patternFound];
                            }            
                        }    
                    }

                    // tslint:disable-next-line:no-return-await
                    return await Promise.all(Object.keys(propertyProperties).map( async (key: string) => {
                        const property: IProperty = propertyProperties[key];
                        if (!property) {
                            throw new Error(`${itemPath}${key} not found`);
                        }
                        
                        return this.checkAllowed(property, value[key]).then( async (allowed: boolean) => {
                            const readOnly = (!!schema.readOnly || !!property.readOnly);
                            const writeOnly = (!!schema.writeOnly || !!property.writeOnly);
                            const item: INameValueState = { 
                                name: (await this.getName({ itemPath: `${basePath}${key}`, value: value[key], schema: property, parentPath: options.parentPath})), //+` ${basePath}${key}`, 
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
                    const arrayItemSchema: IProperty = schema.items;

                    return await Promise.all(Array.isArray(value) && value.map( async (arrayItem: Item, idx: number) =>{
                        const myId = (arrayItem && (arrayItem.slug || arrayItem._id)) || idx;
                        const readOnly = (!!schema.readOnly || !!arrayItemSchema.readOnly);
                        const writeOnly = (!!schema.writeOnly || !!arrayItemSchema.writeOnly);
                        const item: INameValueState = { 
                            disabled: this.isPrimitive(arrayItemSchema) && readOnly && !writeOnly,
                            name: await this.getName({ itemPath: `${basePath}${myId}`, value: arrayItem, schema: arrayItemSchema, parentPath: options.parentPath}), // + ` ${basePath}${myId}`, 
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
                    return value && Object.keys(value).map( (key: string) => {
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

    private async getName(options: IDispatchOptions): Promise<string> {
        options = options || {};
        options.itemPath = options?.itemPath || ''; //? await this.convertPathToUri(options.itemPath) : '';
        options.schema = options?.schema || await this.getSchema(options);
        options.value = options?.value || await this.dispatch('get', options);

        const { schema, parentPath=''} = options;
        let value = options.value;
        const key = options.itemPath.split('/').pop();
        
        let head = '';
        if (!value || !(schema?.$data?.path || schema?.$title || /^[a-f0-9-]{24}/.test(key))) {
            head = `${key}: `.replace(/([A-Z]{2,})/g, " $1").replace(/([A-Z][a-z])/g, " $1");
            head = chalk.gray(head.charAt(0).toUpperCase() + head.slice(1)).padEnd(30);    
        }

        let label = '';
        if (value && schema?.$data?.path) {
            return await this.getName({itemPath: `${parentPath}${parentPath?'/':''}${value}`, parentPath});
        }
        if (schema?.$title && value) {
            const template = Handlebars.compile(schema.$title);
            label = template(value).trim();
            if (label && label.indexOf('/')) {
                label = (await Promise.all(label.split(' ').map(async labelPart => {
                    if (labelPart && labelPart.indexOf('/') > 3) {
                        //console.log(labelPart)
                        const subRefSchema = await this.getSchema({ itemPath: `${parentPath}${parentPath?'/':''}${labelPart}`, parentPath });
                        if (subRefSchema && !subRefSchema.$data) {
                            return await this.getName({itemPath: `${parentPath}${parentPath?'/':''}${labelPart}`, schema: subRefSchema, parentPath});
                        }    
                    }
                    return labelPart;
                }))).join(' ').trim();
            }
        } else if ((schema?.type === 'object' || schema?.type === 'array') && schema?.title) {
            label = schema.title;
        } else if (schema?.type === 'array' && value && value.length) {
            label = (await Promise.all(value.map( async (i, idx) => await (await this.getName({ itemPath: `${options.itemPath}${options.itemPath?'/':''}${i._id || idx}`, value: i, schema: schema.items, parentPath})).trim() ))).join(', ');
        } 
        if (!label) {
            label = (value !== undefined && value !== null) ?
            (schema?.type !== 'object' && schema?.type !== 'array' ? JSON.stringify(value) :  
                (value.title || value.name || key || `[${schema?.type}]`)):
            '';
        }
        if (label && label.length > 90) {
            label = `${label.slice(0,87)}...`;
        }
        return `${head}${label}`;
    }

    private isPrimitive(schema: IProperty = {}): boolean {
        return ((schema.type !== 'object' && 
            schema.type !== 'array')) || 
            this.isSelect(schema) ||
            this.isCheckBox(schema);
    }

    private isCheckBox(schema: IProperty): boolean {
        if (schema === undefined) { return false; };

        return schema.type === 'array' && 
            this.isSelect(schema.items);
    }

    private isSelect(schema: IProperty): boolean {
        if (schema === undefined) { return false; };

        return schema.enum !== undefined || schema.$data !== undefined;
    }

    private async getEnumValues(options: IDispatchOptions)
        : Promise<{ values: any, dataSource?: AbstractDataSource, entryPointInfo?: IEntryPointInfo}> {
        
        const { itemPath, schema } = options;
        const property: IProperty = schema.items || schema;
        if (property.enum) {
            return { values: property.enum};
        }
        if (!property?.$data?.path) {
            return { values: [] };
        }
        const dataPath = absolute(property.$data.path, itemPath);
        const { dataSource, entryPointInfo } = await this.getDataSourceInfo({ itemPath: dataPath });
        const newPath = dataSource instanceof AbstractDispatcher && entryPointInfo?.parentPath ?
            await dataSource.convertPathToUri(dataPath.replace(entryPointInfo.parentPath, '').replace(/^\//,'')) :
            dataPath;

        return { dataSource, entryPointInfo, values: (await dataSource.dispatch('get', { itemPath: newPath }) || []) };
    }

    private async getOptions(options: IDispatchOptions): Promise<INameValueState[] | PrimitiveType[] | IProperty[]> {
        const { itemPath, schema } = options;

        const isCheckBox = this.isCheckBox(schema);
        
        const property = isCheckBox? schema.items : schema;
        const $data = property?.$data || property?.items?.$data;
        let dataPath = await this.convertPathToUri(absolute($data?.path||'', itemPath));
        let $values = [], $schema: IProperty;

        if (property.enum) {
            $values = property.enum || [];
        } else if ($data?.path) {
            $schema = await this.getSchema({ itemPath: dataPath });
            $schema = $schema.items || $schema;
            const enumValues = await this.getEnumValues(options);
            $values = await Promise.all(enumValues.values.map(async (value: any) => {
                return { 
                    name: (getType(value) === 'Object')? (await this.getName({ itemPath: value._fullPath || `${dataPath}/${value._id || value}`, value: value, schema: $schema, parentPath: enumValues?.entryPointInfo?.parentPath})).trim(): value,
                    value: value._fullPath || `${dataPath}/${value._id || value}`,
                    disabled: !!property.readOnly
                };
            }));
        } 
        return $values || [];
    }
        
}

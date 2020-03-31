import { IProperty } from 'autoinquirer/build/interfaces';
import { IPrompt } from './interfaces';
import { Dispatcher } from 'autoinquirer';
import { DataRenderer } from 'autoinquirer/build/datasource';
export declare type Item = any;
export declare const lookupValues: (schemaPath: string | string[], obj: any, currPath?: string) => any;
export declare class PromptBuilder extends DataRenderer {
    private datasource;
    constructor(datasource?: Dispatcher);
    setDataSource(datasource: Dispatcher): void;
    render(methodName: string, itemPath: string, propertySchema: IProperty, propertyValue: Item): Promise<IPrompt>;
    private getActions;
    private checkAllowed;
    private makeMenu;
    private makePrompt;
    private getChoices;
    private getName;
    private isPrimitive;
    private isCheckBox;
    private isSelect;
    private getOptions;
    private evaluate;
}
//# sourceMappingURL=promptbuilder.d.ts.map
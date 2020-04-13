import { IDispatchOptions } from 'autoinquirer/build/interfaces';
import { IPrompt } from './interfaces';
import { Dispatcher } from 'autoinquirer';
import { IDataRenderer } from 'autoinquirer/build/datasource';
export declare type Item = any;
export declare function absolute(testPath: string, absolutePath: string): string;
export declare const lookupValues: (itemPath: string | string[], obj: any, currPath?: string) => any;
export declare class PromptBuilder extends Dispatcher implements IDataRenderer {
    render(methodName: string, options?: IDispatchOptions): Promise<IPrompt>;
    private getActions;
    private checkAllowed;
    private makeMenu;
    private makePrompt;
    private getChoices;
    private getName;
    private isPrimitive;
    private isCheckBox;
    private isSelect;
    private getEnumValues;
    private getOptions;
}
//# sourceMappingURL=promptbuilder.d.ts.map
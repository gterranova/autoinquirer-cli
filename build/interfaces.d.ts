import { Action } from "autoinquirer/build/interfaces";
export interface IState {
    path: string;
    type?: Action | string;
    error?: Error;
}
export interface INameValueState {
    name: string;
    value: IState | string;
    disabled?: boolean;
}
export interface IAnswer {
    state: IState;
    value?: any;
}
export interface IPrompt {
    name: string;
    type: string;
    message: string;
    when?: any | (IAnswer);
    default?: any | (IAnswer);
    choices?: any | (IAnswer);
    pageSize?: number;
    disabled?: boolean;
    errors?: any;
    path?: string;
    format?: string[];
    initial?: any;
}
export interface IFeedBack {
    name: string;
    answer: any;
    value?: any;
}
//# sourceMappingURL=interfaces.d.ts.map
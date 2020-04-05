/// <reference types="node" />
import { EventEmitter } from 'events';
import { IAnswer, IFeedBack, IPrompt } from './interfaces';
import { PromptBuilder } from './promptbuilder';
export declare class AutoInquirer extends EventEmitter {
    private dataDispatcher;
    private answer;
    constructor(dataDispatcher: PromptBuilder, initialAnswer?: IAnswer);
    next(): Promise<IPrompt>;
    onAnswer(data: IFeedBack): Promise<void>;
    performActions(answer: IAnswer): Promise<void>;
    run(): Promise<void>;
}
//# sourceMappingURL=autoinquirer.d.ts.map
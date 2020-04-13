// tslint:disable:no-any
// tslint:disable:no-console

import { EventEmitter } from 'events';
import { Action } from 'autoinquirer/build/interfaces';
import { backPath } from './utils';
import { IAnswer, IFeedBack, IPrompt } from './interfaces';
import { PromptBuilder } from './promptbuilder';


export class AutoInquirer extends EventEmitter {
    private dataDispatcher: PromptBuilder;
    private answer: IAnswer;

    constructor(dataDispatcher: PromptBuilder, initialAnswer: IAnswer = { state: { path: '' }}) {
        super();
        this.dataDispatcher = dataDispatcher;
        this.answer = initialAnswer;
    }

    public async next(): Promise<IPrompt> {
        const { state } = this.answer;
        try {
            const prompt = await this.dataDispatcher.render(state.type, { itemPath: state.path });
            if (prompt === null) {
                this.emit('complete');
            }

            return prompt;
        } catch (error) {
            if (error instanceof Error) {
                const nextPath = state.type !== Action.PUSH? backPath(state.path): state.path;
                this.answer = { state: { ...state, path: nextPath, error } };                    
                this.emit('error', this.answer.state);
                
                return this.next();    
            }
        }
        
        return null;
    }

    public async onAnswer(data: IFeedBack) {
        this.answer = {...this.answer, [data.name]: data.answer};
        if (data.hasOwnProperty('value')) {
            this.answer.value = data.value;
        }
        //console.log("DATA:", JSON.stringify(data));
        //console.log("RECEIVED:", JSON.stringify(this.answer));
        await this.performActions(this.answer);
    }

    public async performActions(answer: IAnswer) {
        const { state, value } = answer;
        state.type = state.type || Action.GET;

        //console.log("ACTION:", answer);
        if (state && state.type && state.type === Action.PUSH || state.type === Action.DEL || (state.type === Action.SET && value !== undefined)) {
            const nextPath = state.type !== Action.PUSH? backPath(state.path): state.path;
            
            try {
                await this.dataDispatcher.dispatch(state.type, { itemPath: state.path, value});
                this.answer = { state: { path: nextPath } };
                this.emit(state.type, state);
            } catch (error) {
                if (error instanceof Error) {
                    this.answer = { state: { ...state, error } };                    
                    this.emit('error', this.answer.state);    
                }
            }
        } else {
            this.emit(state.type, state);
        }
    }

    public async run() {
        this.emit('prompt', await this.next())
    }
}

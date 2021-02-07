"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const utils_1 = require("./utils");
class AutoInquirer extends events_1.EventEmitter {
    constructor(dataDispatcher, initialAnswer = { state: { path: '' } }) {
        super();
        this.dataDispatcher = dataDispatcher;
        this.answer = initialAnswer;
    }
    next() {
        return __awaiter(this, void 0, void 0, function* () {
            const { state } = this.answer;
            try {
                const prompt = yield this.dataDispatcher.render(state.type, { itemPath: state.path });
                if (prompt === null) {
                    this.emit('complete');
                }
                return prompt;
            }
            catch (error) {
                if (error instanceof Error) {
                    const nextPath = state.type !== "push" ? utils_1.backPath(state.path) : state.path;
                    this.answer = { state: Object.assign(Object.assign({}, state), { path: nextPath, error }) };
                    this.emit('error', this.answer.state);
                    return this.next();
                }
            }
            return null;
        });
    }
    onAnswer(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.answer = Object.assign(Object.assign({}, this.answer), { [data.name]: data.answer });
            if (data.hasOwnProperty('value')) {
                this.answer.value = data.value;
            }
            yield this.performActions(this.answer);
        });
    }
    performActions(answer) {
        return __awaiter(this, void 0, void 0, function* () {
            const { state, value } = answer;
            state.type = state.type || "get";
            if (state && state.type && state.type === "push" || state.type === "delete" || (state.type === "set" && value !== undefined)) {
                const nextPath = state.type !== "push" ? utils_1.backPath(state.path) : state.path;
                try {
                    yield this.dataDispatcher.dispatch(state.type, { itemPath: state.path, value });
                    this.answer = { state: { path: nextPath } };
                    this.emit(state.type, state);
                }
                catch (error) {
                    if (error instanceof Error) {
                        this.answer = { state: Object.assign(Object.assign({}, state), { error }) };
                        this.emit('error', this.answer.state);
                    }
                }
            }
            else {
                this.emit(state.type, state);
            }
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            this.emit('prompt', yield this.next());
        });
    }
}
exports.AutoInquirer = AutoInquirer;

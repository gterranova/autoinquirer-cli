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
const chalk = require('chalk');
var program = require('commander');
const inquirer = require('inquirer');
const Subject = require('rxjs').Subject;
const autoinquirer_1 = require("./autoinquirer");
const promptbuilder_1 = require("./promptbuilder");
const screenHeader = '\x1Bc' + chalk.blue.bold('\n  Autoinquirer v.1.0.0') + '\n\n';
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const prompts = new Subject();
        const dispatcher = new promptbuilder_1.PromptBuilder(program.args[0], program.args[1]);
        yield dispatcher.connect();
        const autoInquirer = new autoinquirer_1.AutoInquirer(dispatcher);
        const inq = inquirer.prompt(prompts);
        inq.ui.process.subscribe(data => { autoInquirer.onAnswer(data).then(() => autoInquirer.run()); });
        autoInquirer.on('prompt', prompt => { console.log(screenHeader); prompts.next(prompt); });
        autoInquirer.on('error', state => {
            const errorString = state.errors + '\n';
            console.log(chalk.red(errorString));
        });
        autoInquirer.on('complete', () => prompts.complete());
        inq.then(() => __awaiter(this, void 0, void 0, function* () {
            yield dispatcher.close();
            process.exit(0);
        }));
        autoInquirer.run();
    });
}
program
    .version('1.0.0')
    .description('Example json editor')
    .arguments('<schemaFile> <dataFile>')
    .parse(process.argv);
if (program.args.length < 1) {
    program.outputHelp();
}
else {
    main();
}

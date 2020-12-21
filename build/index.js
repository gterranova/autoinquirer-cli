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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const fs = __importStar(require("fs"));
const chalk = require('chalk');
var program = require('commander');
const inquirer = require('inquirer');
const datePicker = require('inquirer-datepicker-prompt');
const Subject = require('rxjs').Subject;
const autoinquirer_1 = require("./autoinquirer");
const promptbuilder_1 = require("./promptbuilder");
const autoinquirer_2 = require("autoinquirer");
const filesystem_1 = require("./filesystem");
const screenHeader = '\x1Bc' + chalk.blue.bold('\n  Autoinquirer v.1.0.0') + '\n\n';
function main(schemaFile, dataFile) {
    return __awaiter(this, void 0, void 0, function* () {
        const prompts = new Subject();
        const dispatcher = new promptbuilder_1.PromptBuilder(schemaFile, dataFile);
        dispatcher.registerProxy({ name: 'Dispatcher', classRef: autoinquirer_2.Dispatcher });
        dispatcher.registerProxy({ name: 'JsonDataSource', classRef: autoinquirer_2.JsonDataSource });
        dispatcher.registerProxy({ name: 'FileSystemDataSource', classRef: filesystem_1.FileSystemDataSource });
        yield dispatcher.connect();
        const autoInquirer = new autoinquirer_1.AutoInquirer(dispatcher);
        const inq = inquirer.prompt(prompts);
        inquirer.registerPrompt('date', datePicker);
        inquirer.registerPrompt('date-time', datePicker);
        inq.ui.process.subscribe(data => { autoInquirer.onAnswer(data).then(() => autoInquirer.run()); });
        autoInquirer.on('prompt', prompt => { console.log(screenHeader); prompts.next(prompt); });
        autoInquirer.on('error', state => {
            const error = state.error;
            console.log(chalk.red(error.stack || error.toString()));
            process.exit(2);
        });
        autoInquirer.on('complete', () => prompts.complete());
        inq.then(() => __awaiter(this, void 0, void 0, function* () {
            yield dispatcher.close();
            process.exit(2);
        }));
        autoInquirer.run();
    });
}
function isDir(path) {
    try {
        return fs.lstatSync(path).isDirectory();
    }
    catch (e) {
        return false;
    }
}
program
    .version('1.0.0')
    .description('Example json editor')
    .arguments('[directory]')
    .option('-s, --schema [schemaFile]', 'Schema file', 'schema.json')
    .option('-d, --data [dataFile]', 'Data file', 'data.json')
    .parse(process.argv);
if (!program.args[0] || isDir(program.args[0])) {
    main(path_1.join(program.args[0] || '.', program.schema), path_1.join(program.args[0] || '.', program.data));
}
else {
    program.outputHelp();
}
process.on('unhandledRejection', (err) => {
    console.log(err.stack || err.toString());
});
process.on('SIGINT', () => { console.log("Bye bye!"); process.exit(2); });

// tslint:disable:no-any
// tslint:disable:no-console
import { join } from 'path';
import * as fs from 'fs';

const chalk = require('chalk');
var program = require('commander');
const inquirer = require('inquirer');
const datePicker = require('inquirer-datepicker-prompt');

const Subject = require('rxjs').Subject;
import { AutoInquirer } from './autoinquirer';
import { PromptBuilder } from './promptbuilder';
import { JsonDataSource, Dispatcher } from 'autoinquirer';
import { FileSystemDataSource } from './filesystem'


//const DIST_FOLDER = join(process.cwd(), 'dist/apps/client');
const screenHeader = '\x1Bc'+chalk.blue.bold('\n  Autoinquirer v.1.0.0')+'\n\n';

async function main(schemaFile, dataFile) { // jshint ignore:line

    const prompts = new Subject();
    const dispatcher = new PromptBuilder(schemaFile, dataFile); // jshint ignore:line
    dispatcher.registerProxy({ name: 'Dispatcher', classRef: Dispatcher });
    dispatcher.registerProxy({ name: 'JsonDataSource', classRef: JsonDataSource });
    dispatcher.registerProxy({ name: 'FileSystemDataSource', classRef: FileSystemDataSource });
    await dispatcher.connect();
    const autoInquirer = new AutoInquirer(dispatcher);

    const inq = inquirer.prompt(prompts);
    inquirer.registerPrompt('date', datePicker);
    inquirer.registerPrompt('date-time', datePicker);
    //const bottomBar = new inquirer.ui.BottomBar();

    inq.ui.process.subscribe( data => { autoInquirer.onAnswer(data).then(() => autoInquirer.run()); });
    autoInquirer.on('prompt', prompt => { console.log(screenHeader); prompts.next(prompt); } );
    autoInquirer.on('error', state => { 
        const error = state.error; 
        //bottomBar.updateBottomBar(chalk.red(errorString));
        console.log(chalk.red(error.stack || error.toString()));
    });
    //autoInquirer.on('exit', state => console.log(state));
    autoInquirer.on('complete', () => prompts.complete() );
    inq.then( async () => {
        await dispatcher.close();
        process.exit(2);
    });
    
    autoInquirer.run();

}

function isDir(path) {
    try {
        return fs.lstatSync(path).isDirectory();
    } catch (e) {
        // lstatSync throws an error if path doesn't exist
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
    main(join(program.args[0] || '.', program.schema), join(program.args[0] || '.', program.data));
} else {
    program.outputHelp();
}

process.on('unhandledRejection', (err: Error) => {
    //console.log('An unhandledRejection occurred');
    //console.log(`Rejected Promise: ${p}`);
    console.log(err.stack || err.toString());
    // dispatcher.close();
});

process.on('SIGINT', () => { console.log("Bye bye!"); process.exit(2); })
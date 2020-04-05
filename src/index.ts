// tslint:disable:no-any
// tslint:disable:no-console
const chalk = require('chalk');
var program = require('commander');
const inquirer = require('inquirer');

const Subject = require('rxjs').Subject;
import { AutoInquirer } from './autoinquirer';
import { PromptBuilder } from './promptbuilder';


//const DIST_FOLDER = join(process.cwd(), 'dist/apps/client');
const screenHeader = '\x1Bc'+chalk.blue.bold('\n  Autoinquirer v.1.0.0')+'\n\n';

async function main() { // jshint ignore:line

    const prompts = new Subject();
    const dispatcher = new PromptBuilder(program.args[0], program.args[1]); // jshint ignore:line
    await dispatcher.connect();
    const autoInquirer = new AutoInquirer(dispatcher);

    const inq = inquirer.prompt(prompts);
    
    //const bottomBar = new inquirer.ui.BottomBar();

    inq.ui.process.subscribe( data => { autoInquirer.onAnswer(data).then(() => autoInquirer.run()); });
    autoInquirer.on('prompt', prompt => { console.log(screenHeader); prompts.next(prompt); } );
    autoInquirer.on('error', state => { 
        const errorString = state.errors+'\n'; 
        //bottomBar.updateBottomBar(chalk.red(errorString));
        console.log(chalk.red(errorString));
    });
    //autoInquirer.on('exit', state => console.log(state));
    autoInquirer.on('complete', () => prompts.complete() );
    inq.then( async () => {
        await dispatcher.close();
        process.exit(0);
    });
    
    autoInquirer.run();

}
  
program
  .version('1.0.0')
  .description('Example json editor')
  .arguments('<schemaFile> <dataFile>')
  .parse(process.argv);

if (program.args.length < 1) {
    program.outputHelp();
} else {
    main();
}

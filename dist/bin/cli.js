#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const yargs_1 = __importDefault(require("yargs/yargs"));
const helpers_1 = require("yargs/helpers");
const TemplateEngine_1 = require("../engine/TemplateEngine");
const FileHandler_1 = require("../handlers/FileHandler");
const createLogger_1 = __importDefault(require("../helpers/createLogger"));
function loadExtensions() {
    const extensions = {};
    const fullPath = path_1.default.join(__dirname, '..', 'extensions');
    fs_1.default.readdirSync(fullPath).forEach((file) => {
        if (!['.js', '.ts'].includes(path_1.default.extname(file)))
            return;
        const extName = path_1.default.basename(file, path_1.default.extname(file));
        try {
            const ExtensionClass = require(path_1.default.join(fullPath, file)).default;
            extensions[extName] = ExtensionClass;
        }
        catch (error) {
            console.warn(`Failed to load extension ${extName}:`, error);
        }
    });
    return extensions;
}
const availableExtensions = loadExtensions();
// Utility function for error handling and extension validation
function validateExtensions(requestedExtensions, availableExtensions) {
    const missingExtensions = requestedExtensions.filter((ext) => !availableExtensions[ext]);
    if (missingExtensions.length > 0) {
        console.error('One or more specified extensions could not be loaded:', missingExtensions.join(', '));
        return false;
    }
    return true;
}
const renderCommand = {
    command: 'render <sourcePath> [options]',
    describe: 'Render templates from JSON to HTML/JSX',
    builder: (yargs) => {
        return yargs
            .positional('sourcePath', {
            describe: 'Source file or directory containing JSON templates',
            type: 'string',
            demandOption: true,
        })
            .option('outputDir', {
            alias: 'o',
            describe: 'Output directory for rendered templates',
            type: 'string',
        })
            .option('extensions', {
            alias: 'e',
            describe: 'Extensions to use for template processing',
            type: 'array',
            default: [],
        })
            .option('name', {
            alias: 'n',
            describe: 'Base name for output files',
            type: 'string',
        })
            .option('componentName', {
            alias: 'c',
            describe: 'Component name for framework-specific templates',
            type: 'string',
        })
            .option('verbose', {
            alias: 'v',
            type: 'boolean',
            description: 'Run with verbose logging',
        })
            .option('extension', {
            describe: 'Extension type to use',
            type: 'string',
            choices: ['react', 'bem', 'none'],
            default: 'none',
        })
            .option('fileExtension', {
            describe: 'File extension for output files',
            type: 'string',
            choices: ['.html', '.jsx', '.tsx', '.css'],
            default: '.html',
        }); // Type assertion needed due to yargs type limitations
    },
    handler: async (argv) => {
        const { verbose } = argv;
        const logger = (0, createLogger_1.default)(verbose, 'cli');
        logger.info('Starting template rendering process...');
        // Validate requested extensions before attempting to use them
        if (!validateExtensions(argv.extensions ?? [], availableExtensions)) {
            // Exit if validation fails
            return;
        }
        // Instantiate extensions with verbosity
        const extensions = (argv.extensions ?? []).map((extension) => new availableExtensions[extension](verbose));
        const { name, componentName } = argv;
        const sourcePath = path_1.default.join(process.cwd(), argv.sourcePath);
        const outputDir = argv.outputDir ?? '';
        const sourcePathType = await (0, FileHandler_1.getSourcePathType)(sourcePath);
        const templateEngine = new TemplateEngine_1.TemplateEngine();
        if (sourcePathType === 'directory') {
            await (0, FileHandler_1.processDirectory)(sourcePath, outputDir, extensions, templateEngine, verbose);
        }
        else if (sourcePathType === 'file') {
            await (0, FileHandler_1.processFile)(sourcePath, outputDir, extensions, templateEngine, name, componentName, verbose);
        }
    },
};
(0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .command(renderCommand)
    .demandCommand(1, 'You need at least one command before moving on')
    .help().argv;

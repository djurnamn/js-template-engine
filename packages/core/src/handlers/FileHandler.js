"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readJsonFile = readJsonFile;
exports.writeOutputFile = writeOutputFile;
exports.getSourcePathType = getSourcePathType;
exports.processFile = processFile;
exports.processDirectory = processDirectory;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const createLogger_1 = require("../helpers/createLogger");
function readJsonFile(sourcePath) {
    try {
        const fileContent = fs_1.default.readFileSync(sourcePath, 'utf8');
        const data = JSON.parse(fileContent);
        if (!Array.isArray(data)) {
            throw new Error('Template data must be an array of nodes');
        }
        return data;
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`Invalid JSON in file ${sourcePath}: ${error.message}`);
        }
        if (error instanceof Error) {
            throw new Error(`Error reading file ${sourcePath}: ${error.message}`);
        }
        throw new Error(`Unknown error reading file ${sourcePath}`);
    }
}
function writeOutputFile(template, outputPath, verbose = false) {
    const logger = (0, createLogger_1.createLogger)(verbose, 'writeOutputFile');
    const outputDir = path_1.default.dirname(outputPath);
    if (!fs_1.default.existsSync(outputDir)) {
        logger.info(`Creating output directory: ${outputDir}`);
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    fs_1.default.writeFileSync(outputPath, template, 'utf8');
}
async function getSourcePathType(sourcePath) {
    const stats = fs_1.default.statSync(sourcePath);
    if (stats.isDirectory()) {
        return 'directory';
    }
    if (stats.isFile()) {
        return 'file';
    }
    return undefined;
}
async function processFile(sourcePath, outputDir, extensions, templateEngine, name, componentName, verbose = false) {
    const logger = (0, createLogger_1.createLogger)(verbose, 'processFile');
    logger.info(`Processing file: ${sourcePath}`);
    const templateData = readJsonFile(sourcePath);
    const filenameWithoutExtension = path_1.default.basename(sourcePath, '.json');
    try {
        await templateEngine.render(templateData, {
            name: name ?? filenameWithoutExtension,
            componentName,
            outputDir,
            extensions,
            writeOutputFile: true,
            verbose,
        });
        logger.success(`Successfully processed file: ${sourcePath}`);
    }
    catch (error) {
        logger.error(`Error processing file ${sourcePath}: ${error.message}`);
    }
}
async function processDirectory(sourceDir, outputDir, extensions, templateEngine, verbose = false) {
    const logger = (0, createLogger_1.createLogger)(verbose, 'processDirectory');
    logger.info(`Processing directory: ${sourceDir}`);
    const entries = fs_1.default.readdirSync(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        const sourceEntryPath = path_1.default.join(sourceDir, entry.name);
        const outputEntryPath = path_1.default.join(outputDir ?? 'dist', entry.name);
        if (entry.isDirectory()) {
            logger.info(`Entering directory: ${entry.name}`);
            await processDirectory(sourceEntryPath, outputEntryPath, extensions, templateEngine, verbose);
        }
        else if (entry.isFile() && path_1.default.extname(entry.name) === '.json') {
            logger.info(`Found JSON file: ${entry.name}`);
            const templateData = readJsonFile(sourceEntryPath);
            const filenameWithoutExtension = path_1.default.basename(entry.name, '.json');
            await templateEngine.render(templateData, {
                name: filenameWithoutExtension,
                outputDir,
                extensions,
                writeOutputFile: true,
                verbose,
            });
        }
    }
}

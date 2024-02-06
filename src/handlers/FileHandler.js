const fs = require("fs");
const path = require("path");
const createLogger = require("../helpers/createLogger");

function readJsonFile(sourcePath) {
  try {
    const fileContent = fs.readFileSync(sourcePath, "utf8");

    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error reading or parsing JSON file ${sourcePath}:`, error);
    throw error;
  }
}

function writeOutputFile(template, outputPath, verbose = false) {
  const logger = createLogger(verbose, "writeOutputFile");
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    logger.info(`Creating output directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, template, "utf8");
}

async function getSourcePathType(sourcePath) {
  const stats = fs.statSync(sourcePath);

  if (stats.isDirectory()) {
    return "directory";
  }

  if (stats.isFile()) {
    return "file";
  }
}

async function processFile(
  sourcePath,
  outputDir,
  extensions,
  templateEngine,
  name,
  componentName,
  verbose
) {
  const logger = createLogger(verbose, "processFile");
  logger.info(`Processing file: ${sourcePath}`);

  const templateData = readJsonFile(sourcePath);
  const filenameWithoutExtension = path.basename(sourcePath, ".json");

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
  } catch (error) {
    logger.error(`Error processing file ${sourcePath}: ${error.message}`);
  }
}

async function processDirectory(
  sourceDir,
  outputDir,
  extensions,
  templateEngine,
  verbose
) {
  const logger = createLogger(verbose, "processDirectory");
  logger.info(`Processing directory: ${sourceDir}`);
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourceEntryPath = path.join(sourceDir, entry.name);
    const outputEntryPath = path.join(outputDir ?? "dist", entry.name);

    if (entry.isDirectory()) {
      logger.info(`Entering directory: ${entry.name}`);
      await processDirectory(
        sourceEntryPath,
        outputEntryPath,
        extensions,
        templateEngine,
        verbose
      );
    } else if (entry.isFile() && path.extname(entry.name) === ".json") {
      logger.info(`Found JSON file: ${entry.name}`);
      const templateData = readJsonFile(sourceEntryPath);
      const filenameWithoutExtension = path.basename(entry.name, ".json");

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

module.exports = {
  readJsonFile,
  writeOutputFile,
  getSourcePathType,
  processFile,
  processDirectory,
};

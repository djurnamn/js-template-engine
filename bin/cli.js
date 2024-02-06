#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const process = require("process");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const TemplateEngine = require("../src/engine/TemplateEngine");
const {
  getSourcePathType,
  processFile,
  processDirectory,
} = require("../src/handlers/FileHandler");
const createLogger = require("../src/helpers/createLogger");

function loadExtensions() {
  const extensions = {};
  const fullPath = path.join(__dirname, "..", "src", "extensions");

  fs.readdirSync(fullPath).forEach((file) => {
    if (path.extname(file) !== ".js") return;

    const extName = path.basename(file, ".js");
    const ExtensionClass = require(path.join(fullPath, file));
    extensions[extName] = ExtensionClass;
  });

  return extensions;
}

const availableExtensions = loadExtensions();

// Utility function for error handling and extension validation
function validateExtensions(requestedExtensions, availableExtensions) {
  const missingExtensions = requestedExtensions.filter(
    (ext) => !availableExtensions[ext]
  );
  if (missingExtensions.length > 0) {
    console.error(
      "One or more specified extensions could not be loaded:",
      missingExtensions.join(", ")
    );
    return false;
  }
  return true;
}

yargs(hideBin(process.argv))
  .command(
    "render <sourcePath> [options]",
    "Render templates from JSON to HTML/JSX",
    (yargs) => {
      yargs
        .positional("sourcePath", {
          describe: "Source file or directory containing JSON templates",
          type: "string",
        })
        .option("outputDir", {
          alias: "o",
          describe: "Output directory for rendered templates",
          type: "string",
        })
        .option("extensions", {
          alias: "e",
          describe: "Extensions to use for template processing",
          type: "array",
          default: [],
        })
        .option("name", {
          alias: "n",
          describe: "Base name for output files",
          type: "string",
        })
        .option("componentName", {
          alias: "c",
          describe: "Component name for framework-specific templates",
          type: "string",
        })
        .option("verbose", {
          alias: "v",
          type: "boolean",
          description: "Run with verbose logging",
        });
    },
    async (argv) => {
      const { verbose } = argv;
      const logger = createLogger(verbose, "cli");
      logger.info("Starting template rendering process...");

      // Validate requested extensions before attempting to use them
      if (!validateExtensions(argv.extensions, availableExtensions)) {
        // Exit if validation fails
        return;
      }

      // Instantiate extensions with verbosity
      const extensions = argv.extensions.map(
        (extension) => new availableExtensions[extension](verbose)
      );

      const { name, componentName } = argv;
      const sourcePath = path.join(process.cwd(), argv.sourcePath);
      const outputDir = argv.outputDir ?? "";
      const sourcePathType = await getSourcePathType(sourcePath);
      const templateEngine = new TemplateEngine();

      if (sourcePathType === "directory") {
        await processDirectory(
          sourcePath,
          outputDir,
          extensions,
          templateEngine,
          verbose
        );
      } else if (sourcePathType === "file") {
        await processFile(
          sourcePath,
          outputDir,
          extensions,
          templateEngine,
          name,
          componentName,
          verbose
        );
      }
    }
  )
  .demandCommand(1, "You need at least one command before moving on")
  .help().argv;

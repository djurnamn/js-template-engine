const TemplateEngine = require("./engine/TemplateEngine");
const BemExtension = require("./extensions/bem");
const ReactExtension = require("./extensions/react");
const { processFile, processDirectory } = require("./handlers/FileHandler");

module.exports = {
  TemplateEngine,
  BemExtension,
  ReactExtension,
  processFile,
  processDirectory,
};

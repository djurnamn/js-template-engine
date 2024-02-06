const path = require("path");
const prettier = require("prettier");
const { writeOutputFile } = require("../handlers/FileHandler");
const createLogger = require("../helpers/createLogger");

const selfClosingTags = [
  "area",
  "base",
  "br",
  "col",
  "command",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
];

class TemplateEngine {
  constructor() {}

  mergeOptions = (options) => {
    let defaultOptions = {
      attributeFormatter: (attribute, value) => ` ${attribute}="${value}"`,
      fileExtension: ".html",
      filename: options.name ?? "untitled",
      outputDir: "dist",
      preferSelfClosingTags: false,
      prettierParser: "html",
      writeOutputFile: false,
      verbose: false,
    };

    if (options.extensions) {
      options.extensions.forEach((extension) => {
        if (extension.optionsHandler) {
          defaultOptions = extension.optionsHandler(defaultOptions, options);
        }
      });
    }

    return { ...defaultOptions, ...options };
  };

  applyExtensionOverrides = (node, currentExtensionKey) => {
    if (node.extensions && node.extensions[currentExtensionKey]) {
      const extensionOverrides = node.extensions[currentExtensionKey];

      Object.keys(extensionOverrides).forEach((key) => {
        if (key === "ignore") {
          // special handling for 'ignore' or other meta properties if necessary
        } else {
          node[key] = extensionOverrides[key];
        }
      });
    }

    return node;
  };

  render = async (
    nodes,
    options = {},
    isRoot = true,
    ancestorNodesContext = []
  ) => {
    options = isRoot ? this.mergeOptions(options) : options;
    let template = "";

    const { verbose } = options;
    const logger = createLogger(verbose, "render");

    if (isRoot) {
      logger.info("Starting template rendering process...");
    }

    for (let node of nodes) {
      const currentNodeContext = [...ancestorNodesContext, node];

      let shouldIgnoreNode = false;

      if (options.extensions && node.extensions) {
        logger.info(`Processing extensions for node: ${node.tag || "text"}`);
        for (const extension of options.extensions) {
          const currentExtensionKey = extension.key;

          if (node.extensions[currentExtensionKey]) {
            logger.info(
              `Applying overrides from extension: ${currentExtensionKey}`
            );
            node = this.applyExtensionOverrides(node, currentExtensionKey);
          }

          if (node.extensions[currentExtensionKey]?.ignore) {
            logger.info(`Node ignored by extension: ${currentExtensionKey}`);
            shouldIgnoreNode = true;
            break;
          }

          if (!shouldIgnoreNode) {
            logger.info(
              `Calling nodeHandler from extension: ${currentExtensionKey}`
            );
            node = extension.nodeHandler(node, ancestorNodesContext);
          }
        }
      }

      if (shouldIgnoreNode) {
        logger.info(`Node ignored: ${node.tag || "text"}. Skipping rendering.`);
        continue; // Skip rendering this node
      }

      // Constructing the template string for this node
      logger.info(`Rendering node: ${node.tag || "text"}`);

      if (node.tag) {
        const isSelfClosing =
          (node.selfClosing ||
            options.preferSelfClosingTags ||
            selfClosingTags.includes(node.tag)) &&
          !node.children;

        if (isSelfClosing) {
          template += `<${node.tag}`;

          if (node.attributes || node.expressionAttributes) {
            logger.info(`Processing attributes for node: ${node.tag}`);
          }

          if (node.attributes) {
            for (const attribute in node.attributes) {
              template += options.attributeFormatter(
                attribute,
                node.attributes[attribute],
                false // indicating this is a standard attribute, not an expression
              );
            }
          }
          if (node.expressionAttributes) {
            for (const attribute in node.expressionAttributes) {
              template += options.attributeFormatter(
                attribute,
                node.expressionAttributes[attribute],
                true // indicating this is an expression attribute
              );
            }
          }
          template += " />";
        } else {
          template += `<${node.tag}`;
          if (node.attributes) {
            for (const attribute in node.attributes) {
              template += options.attributeFormatter(
                attribute,
                node.attributes[attribute],
                false // standard attribute
              );
            }
          }
          if (node.expressionAttributes) {
            for (const attribute in node.expressionAttributes) {
              template += options.attributeFormatter(
                attribute,
                node.expressionAttributes[attribute],
                true // expression attribute
              );
            }
          }
          template += ">";

          if (node.children) {
            logger.info(`Rendering children for node: ${node.tag}`);
            template += await this.render(
              node.children,
              options,
              false,
              currentNodeContext
            );
          }

          template += `</${node.tag}>`;
        }
      } else if (node.type === "text") {
        // Direct text node handling
        logger.info(`Adding text content: "${node.content}"`);
        template += node.content;
      } else if (
        node.type === "slot" &&
        node.name &&
        options.slots &&
        options.slots[node.name]
      ) {
        logger.info(`Processing slot: ${node.name}`);
        template += await this.render(
          options.slots[node.name],
          options,
          false,
          currentNodeContext
        );
      }
    }

    if (isRoot) {
      logger.info("Finalizing template rendering...");
      if (options.extensions) {
        for (const extension of options.extensions) {
          if (extension.rootHandler) {
            template = extension.rootHandler(template, options);
            break;
          }
        }
      }

      template = await prettier.format(template, {
        parser: options.prettierParser,
      });

      const outputDir = path.join(
        process.cwd(),
        options.outputDir ? options.outputDir : "dist"
      );

      const outputPath = path.join(
        outputDir,
        `${options.filename}${options.fileExtension}`
      );

      if (options.writeOutputFile) {
        writeOutputFile(template, outputPath, verbose);
        logger.success(
          `Template rendering complete. Output saved to: ${outputPath}`
        );
      }

      return template;
    }

    return template;
  };
}

module.exports = TemplateEngine;

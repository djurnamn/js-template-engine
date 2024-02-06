const createLogger = require("../helpers/createLogger");

class ReactExtension {
  constructor(verbose = false) {
    this.key = "react";
    this.logger = createLogger(verbose, "ReactExtension");
  }

  sanitizeComponentName = (componentName) => {
    return componentName
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("");
  };

  optionsHandler = (defaultOptions, options) => {
    return {
      ...defaultOptions,
      attributeFormatter: (attribute, value, isExpression = false) => {
        if (!isExpression) {
          return ` ${attribute}="${value}"`;
        } else {
          return ` ${attribute}={${value}}`;
        }
      },
      filename: options.componentName ?? options.name ?? "UntitledComponent",
      fileExtension: ".jsx",
      outputDir: "dist/react",
      preferSelfClosingTags: true,
      prettierParser: "babel",
    };
  };

  nodeHandler = (node) => {
    const reactConfig = node.extensions && node.extensions.react;

    if (reactConfig) {
      this.logger.info(
        `Processing React extension for node: ${node.tag || "text"}`
      );

      if (node.attributes) {
        if (node.attributes.class) {
          this.logger.info(
            `Transforming 'class' to 'className' for React compatibility.`
          );
          node.attributes.className = node.attributes.class;
          delete node.attributes.class;
        }

        // TODO: handle other attributes that need to be renamed, maybe use a map?
        if (node.attributes.onclick) {
          node.attributes.onclick = node.attributes.onClick;
          delete node.attributes.onclick;
        }
      }

      if (reactConfig.attributes) {
        node.attributes = { ...node.attributes, ...reactConfig.attributes };
      }

      if (reactConfig.expressionAttributes) {
        node.expressionAttributes = reactConfig.expressionAttributes;
      }

      // Log if there are specific overrides from reactConfig
      if (reactConfig.tag) {
        this.logger.info(
          `Overriding node tag with React component: ${reactConfig.tag}`
        );
      }
      if (reactConfig.tag) {
        node.tag = reactConfig.tag;
      }
    }

    return node;
  };

  rootHandler = (htmlContent, rendererOptions) => {
    const rawName =
      rendererOptions.componentName ??
      rendererOptions.name ??
      "UntitledComponent";
    const componentName = this.sanitizeComponentName(rawName);
    this.logger.info(`Generating React component: ${componentName}`);

    return `
      import React from 'react';

      function ${componentName}() {
        return (
          ${htmlContent}
        );
      }

      export default ${componentName};
    `.trim();
  };
}

module.exports = ReactExtension;

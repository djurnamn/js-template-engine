const createLogger = require("../helpers/createLogger");

class BemExtension {
  constructor(verbose = false) {
    this.key = "bem";
    this.logger = createLogger(verbose, "BemExtension");
  }

  setNodeExtensionOptionsShortcut = ({
    block,
    element,
    modifiers,
    modifier,
  }) =>
    block || element || modifiers || modifier
      ? {
          extensions: {
            bem: {
              ...(block ? { block } : {}),
              ...(element ? { element } : {}),
              ...(modifiers ? { modifiers } : {}),
              ...(modifier ? { modifier } : {}),
            },
          },
        }
      : {};

  nodeHandler = (node, ancestorNodesContext) => {
    if (node.ignoreBem) {
      this.logger.info(
        `Node ignored due to ignoreBem flag: ${JSON.stringify(node)}`
      );
      return node;
    }

    this.logger.info(`Processing node: ${node.tag}`);

    // use ancestorNodesContext to find the closest node where block is defined
    if (node.tag) {
      const closestAncestorBlockNode = ancestorNodesContext
        .slice()
        .reverse()
        .find((ancestorNode) => ancestorNode.block);

      const block = node?.block;
      const element = node?.element;
      const modifiers = [
        ...new Set([
          ...(node.modifiers ? node.modifiers : []),
          ...(node.modifier ? [node.modifier] : []),
        ]),
      ];
      const inheritedBlock = closestAncestorBlockNode?.block;

      if (inheritedBlock && !block) {
        this.logger.info(
          `Inheriting BEM block from ancestor: ${inheritedBlock}`
        );
      }

      const bemClasses = this.getBemClasses(
        block,
        element,
        modifiers,
        inheritedBlock
      );

      this.logger.info(
        `Generated BEM classes: ${bemClasses} for node: ${node.tag}`
      );

      if (node.attributes) {
        node.attributes.class = node.attributes.class
          ? `${bemClasses} ${node.attributes.class}` // TODO: maybe add options to append/prepend?
          : bemClasses;
      } else {
        node.attributes = { class: bemClasses };
      }
    }

    return node;
  };

  getBemClasses = (block, element, modifiers, inheritedBlock) => {
    let bemClasses = [];
    const blockToUse = block ?? inheritedBlock ?? "untitled-block";
    let root;

    // determine the root class based on the presence of block and element
    if (element) {
      root = `${blockToUse}__${element}`; // element present, use block__element
    } else if (block) {
      root = blockToUse; // only block present, use block
    } else {
      root = `${blockToUse}__untitled-element`; // neither block nor element defined, fallback
    }

    bemClasses.push(root);

    modifiers.forEach((modifier) => {
      bemClasses.push(`${root}--${modifier}`);
    });

    return bemClasses.join(" ");
  };
}

module.exports = BemExtension;

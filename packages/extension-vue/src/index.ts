import type { BaseExtensionOptions } from '@js-template-engine/types';
import type { ComponentOptions } from '@js-template-engine/types/src/Component';
import { createLogger } from '@js-template-engine/core';
import type {
  TemplateNode,
  Extension,
  RootHandlerContext,
} from '@js-template-engine/types';

import {
  resolveComponentName,
  resolveComponentProps,
  resolveComponentImports
} from '@js-template-engine/types';

const logger = createLogger(false, 'vue-extension');

export interface VueExtensionOptions extends BaseExtensionOptions, ComponentOptions {
  fileExtension?: '.vue';
  scriptLang?: 'js' | 'ts';
  styleLang?: 'css' | 'scss' | 'less' | 'stylus';
  scoped?: boolean;
  scriptContent?: string;
}

export interface VueNodeExtensions {
  tag?: string;
  attributes?: Record<string, any>;
  expressionAttributes?: Record<string, any>;
}

export class VueExtension implements Extension<VueExtensionOptions, VueNodeExtensions> {
  key = 'vue';
  isRenderer = true;
  options: VueExtensionOptions = {
    fileExtension: '.vue'
  };

  transformNode(node: TemplateNode): TemplateNode {
    if (node.extensions?.vue) {
      const ext = node.extensions.vue;

      if (ext.attributes) {
        node.attributes = {
          ...node.attributes,
          ...ext.attributes,
        };
      }

      if (ext.expressionAttributes) {
        node.expressionAttributes = {
          ...(node.expressionAttributes || {}),
          ...ext.expressionAttributes,
        };
      }

      if (ext.tag) {
        node.tag = ext.tag;
      }
    }

    return node;
  }

  rootHandler(template: string, options: VueExtensionOptions, context: RootHandlerContext): string {
    const name = resolveComponentName(context, options);
    const props = resolveComponentProps(context.component);
    const imports = resolveComponentImports(context.component, []);

    const scriptContent = `
<script${options.scriptLang ? ` lang="${options.scriptLang}"` : ''}>
${imports.map((imp) =>
  typeof imp === 'string' ? imp : `import { ${imp.imports.join(', ')} } from '${imp.from}';`
).join('\n')}

${props}

export default {
  name: '${name}',
  ${options.scriptContent || ''}
};
</script>`;

    const styleBlock = context.styleOutput
      ? `\n\n<style${options.styleLang ? ` lang="${options.styleLang}"` : ''}${options.scoped ? ' scoped' : ''}>\n${context.styleOutput}\n</style>`
      : '';

    return `<template>\n${template.trim()}\n</template>${scriptContent}${styleBlock}`;
  }
} 
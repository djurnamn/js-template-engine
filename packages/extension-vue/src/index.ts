import { createLogger } from '@js-template-engine/core';
import type {
  TemplateNode,
  Extension,
  RootHandlerContext,
  VueComponentOptions,
  DeepPartial,
  StyleProcessorPlugin,
  StyleOutputFormat,
} from '@js-template-engine/types';

export * from './types';
export type { Options } from './types';

interface VueNode extends TemplateNode {
  tag?: string;
  attributes?: Record<string, any>;
  extensions?: {
    vue?: {
      directives?: Record<string, string>;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

interface VueOptions {
  fileExtension?: string;
  name?: string;
  componentName?: string;
  outputDir?: string;
  verbose?: boolean;
  styles?: {
    outputFormat?: StyleOutputFormat;
  };
  _styleOutput?: string;
}

export class VueExtension implements Extension<VueOptions> {
  public readonly key = 'vue' as const;
  private logger: ReturnType<typeof createLogger>;

  constructor(verbose = false) {
    this.logger = createLogger(verbose, 'VueExtension');
  }

  public optionsHandler(defaultOptions: VueOptions, options: DeepPartial<VueOptions>): VueOptions {
    return {
      ...defaultOptions,
      ...options,
      fileExtension: '.vue',
      outputDir: 'dist/vue',
    };
  }

  public nodeHandler(node: VueNode): TemplateNode {
    if (node.extensions?.vue) {
      const vueConfig = node.extensions.vue;
      this.logger.info(`Processing Vue extension for node: ${node.tag || 'text'}`);

      // Handle Vue directives
      if (vueConfig.directives) {
        node.attributes = {
          ...node.attributes,
          ...Object.entries(vueConfig.directives).reduce((acc, [key, value]) => {
            acc[`v-${key}`] = value;
            return acc;
          }, {} as Record<string, string>),
        };
      }
    }
    return node;
  }

  public rootHandler(
    html: string,
    options: VueOptions,
    context: RootHandlerContext
  ): string {
    const { component } = context;
    const vueConfig = component?.extensions?.vue as VueComponentOptions;

    const componentName = component?.name ?? options.componentName ?? options.name ?? 'UnnamedComponent';
    const isScoped = vueConfig?.scoped ?? false;
    const isComposition = vueConfig?.composition ?? false;
    const useScriptSetup = isComposition && vueConfig?.useSetup === true;

    // Determine script language
    const isTypeScript = options.fileExtension === '.ts' || options.fileExtension === '.tsx';
    const scriptLang = isTypeScript ? 'ts' : '';
    const langAttr = scriptLang ? ` lang="${scriptLang}"` : '';

    // Props
    const propsScript = component?.props
      ? Object.entries(component.props)
          .map(([key, type]) => `  ${key}: { type: ${type}, required: false },`)
          .join('\n')
      : '';

    // Setup script block
    const logicScript = component?.script?.trim() ?? '';

    // Generate script block based on configuration
    const scriptBlock = useScriptSetup
      ? `<script setup${langAttr}>\n${logicScript}\n</script>`
      : `<script${langAttr}>
export default {
  name: '${componentName}',
  ${propsScript ? `props: {\n${propsScript}\n},` : ''}
  ${isComposition ? `setup() {\n${logicScript}\n  },` : logicScript}
};
</script>`.trim();

    const templateBlock = `<template>\n${html.trim()}\n</template>`;

    // Style block with scoped and language support
    const hasStyles = options.styles?.outputFormat && options.styles.outputFormat !== 'inline';
    const styleLang = options.styles?.outputFormat === 'scss' ? 'scss' : 'css';
    const scopedAttr = isScoped ? ' scoped' : '';
    const styleOutput = options._styleOutput ?? context.styleProcessor?.generateStyles?.(new Map(), options as any);
    const styleBlock = hasStyles && styleOutput
      ? `<style lang="${styleLang}"${scopedAttr}>\n${styleOutput.trim()}\n</style>`
      : '';

    // Combine all blocks
    const blocks = [templateBlock, scriptBlock];
    if (styleBlock) blocks.push(styleBlock);

    const output = blocks.join('\n\n');
    this.logger.info(`Generated Vue component: ${componentName}`);
    return output;
  }
} 
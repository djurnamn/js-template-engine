import type { TemplateConfig } from '@js-template-engine/types';
import { ReactExtension } from '@js-template-engine/extension-react';
import { VueExtension } from '@js-template-engine/extension-vue';
import { BemExtension } from '@js-template-engine/extension-bem';

const config: TemplateConfig = {
  extensions: [
    new ReactExtension(),
    new VueExtension(),
    new BemExtension(),
  ],
  examples: [
    {
      name: 'React',
      template: 'src/react.html',
      options: {
        outputDir: 'output/react',
        filename: 'MyComponent',
        language: 'typescript',
        rendererKey: 'react',
        writeOutputFile: true
      }
    },
    {
      name: 'Vue',
      template: 'src/vue.html',
      options: {
        outputDir: 'output/vue',
        filename: 'MyComponent',
        language: 'javascript',
        rendererKey: 'vue',
        writeOutputFile: true
      }
    },
    {
      name: 'BEM',
      template: 'src/bem.html',
      options: {
        outputDir: 'output/bem',
        filename: 'breadcrumbs',
        language: 'javascript',
        rendererKey: 'bem',
        writeOutputFile: true
      }
    },
    {
      name: 'Card with CSS',
      template: 'src/card-css.html',
      options: {
        outputDir: 'output/css',
        filename: 'card-css',
        language: 'javascript',
        writeOutputFile: true
      }
    }
  ]
};

export default config; 
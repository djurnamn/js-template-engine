import fs from 'fs/promises';
import path from 'path';
import { BemExtension } from '@js-template-engine/extension-bem';
import { TailwindExtension } from '@js-template-engine/extension-tailwind';
import { ReactExtension } from '@js-template-engine/extension-react';
import { VueExtension } from '@js-template-engine/extension-vue';
import { SvelteExtension } from '@js-template-engine/extension-svelte';
import type {
  FrameworkExtension,
  StylingExtension,
} from '@js-template-engine/core';

type ExtensionMap = {
  '@js-template-engine/extension-bem': typeof BemExtension;
  '@js-template-engine/extension-tailwind': typeof TailwindExtension;
  '@js-template-engine/extension-react': typeof ReactExtension;
  '@js-template-engine/extension-vue': typeof VueExtension;
  '@js-template-engine/extension-svelte': typeof SvelteExtension;
};

const EXTENSION_MAP: ExtensionMap = {
  '@js-template-engine/extension-bem': BemExtension,
  '@js-template-engine/extension-tailwind': TailwindExtension,
  '@js-template-engine/extension-react': ReactExtension,
  '@js-template-engine/extension-vue': VueExtension,
  '@js-template-engine/extension-svelte': SvelteExtension,
} as const;

export async function loadConfig(
  configPath = './template.config'
): Promise<any> {
  try {
    const config = await import(path.resolve(configPath));
    return config.default || config;
  } catch (err) {
    console.warn(`Config file ${configPath} not found, using defaults`);
    return {
      framework: 'react',
      extensions: ['@js-template-engine/extension-react'],
    };
  }
}

export async function loadExtensions(
  config: any
): Promise<(FrameworkExtension | StylingExtension)[]> {
  const extensions: (FrameworkExtension | StylingExtension)[] = [];
  const extensionNames = config.extensions || [];

  for (const extensionName of extensionNames) {
    try {
      let ExtensionClass;

      if (extensionName in EXTENSION_MAP) {
        ExtensionClass = EXTENSION_MAP[extensionName as keyof ExtensionMap];
      } else {
        // Try dynamic import for external extensions
        const mod = await import(extensionName);
        ExtensionClass = mod.default;
      }

      if (!ExtensionClass) {
        console.warn(`Extension ${extensionName} has no default export`);
        continue;
      }

      const extension = new ExtensionClass();
      extensions.push(extension as FrameworkExtension | StylingExtension);
    } catch (err) {
      console.error(`Failed loading extension ${extensionName}:`, err);
    }
  }

  return extensions;
}

export async function loadTemplate(sourcePath: string): Promise<any> {
  const fullPath = path.resolve(sourcePath);
  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content);
}

export async function writeOutput(result: any, options: any): Promise<void> {
  const outputDir = options.outputDir || './output';
  const name = options.name || 'component';
  const language = options.language || 'javascript';

  // Create output directory if it doesn't exist
  await fs.mkdir(outputDir, { recursive: true });

  // Determine file extension
  const ext = language === 'typescript' ? '.tsx' : '.jsx';
  const outputPath = path.join(outputDir, `${name}${ext}`);

  await fs.writeFile(outputPath, result.output || '');
  console.log(`Output written to: ${outputPath}`);
}

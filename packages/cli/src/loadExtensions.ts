import { Extension, TemplateNode } from '@js-template-engine/types';
import { BemExtension } from '@js-template-engine/extension-bem';
import { ReactExtension } from '@js-template-engine/extension-react';
import { VueExtension } from '@js-template-engine/extension-vue';

type ExtensionMap = {
  '@js-template-engine/extension-bem': typeof BemExtension;
  '@js-template-engine/extension-react': typeof ReactExtension;
  '@js-template-engine/extension-vue': typeof VueExtension;
};

const EXTENSION_MAP: ExtensionMap = {
  '@js-template-engine/extension-bem': BemExtension,
  '@js-template-engine/extension-react': ReactExtension,
  '@js-template-engine/extension-vue': VueExtension,
} as const;

export async function loadExtensions(configPath = './template.config'): Promise<Extension[]> {
  try {
    const config = await import(configPath);
    const extensions: Extension[] = [];

    for (const pkgName of config.default.extensions) {
      try {
        let ExtensionClass;
        
        if (pkgName in EXTENSION_MAP) {
          ExtensionClass = EXTENSION_MAP[pkgName as keyof ExtensionMap];
        } else {
          // Try dynamic import for external extensions
          const mod = await import(pkgName);
          ExtensionClass = mod.default;
        }

        if (!ExtensionClass) {
          console.warn(`Extension ${pkgName} has no default export`);
          continue;
        }

        const extension = new ExtensionClass();
        
        // Ensure the extension has a nodeHandler
        if ('nodeHandler' in extension) {
          extensions.push(extension as Extension);
        } else {
          console.warn(`Extension ${pkgName} has no nodeHandler`);
        }
      } catch (err) {
        console.error(`Failed loading extension ${pkgName}:`, err);
      }
    }

    return extensions;
  } catch (err) {
    console.error('Error loading template config:', err);
    return [];
  }
} 
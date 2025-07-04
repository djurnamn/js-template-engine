import type { RenderContext, PipelineStep, PipelineStepResult } from '../../types/renderContext';
import { ExtensionManager } from '../../utils/ExtensionManager';
import type { RootHandlerContext } from '@js-template-engine/types';

/**
 * Applies root handlers and script injection
 */
export class RootHandlerStep implements PipelineStep {
  name = 'RootHandler';
  private constructorExtensions: any[];

  constructor(extensions: any[]) {
    this.constructorExtensions = extensions;
  }

  async execute(context: RenderContext): Promise<PipelineStepResult> {
    try {
      const { template, options, component, isRoot, styleOutput } = context;
      
      if (!isRoot || !template) {
        return {
          success: true,
          context
        };
      }

      let finalTemplate = template;
      let styleHandled = false;
      let usedRendererExtension = false;

      // Apply root handlers
      if (options.extensions) {
        for (const extension of options.extensions) {
          if (extension.rootHandler) {
            const rootContext: RootHandlerContext = {
              component,
              framework: extension.key,
              version: context.input && typeof context.input === 'object' && 'version' in context.input 
                ? (context.input as any).version 
                : undefined,
              styleOutput: styleOutput || ''
            };
            
            const extensionManager = new ExtensionManager([extension]);
            const result = extensionManager.callRootHandlers(finalTemplate, options, rootContext);
            if (result.includes(styleOutput || '')) {
              styleHandled = true;
            }
            finalTemplate = result;
            if ((extension as any).isRenderer) {
              usedRendererExtension = true;
            }
          }
        }
      }

      // Handle vanilla script imports and content ONLY if no renderer extension was used
      if (!usedRendererExtension && (component?.imports || component?.script)) {
        finalTemplate = this.injectScripts(finalTemplate, component);
      }

      // Update context with final template and metadata
      const updatedContext: RenderContext = {
        ...context,
        template: finalTemplate,
        styleHandled,
        usedRendererExtension
      };

      return {
        success: true,
        context: updatedContext
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        context
      };
    }
  }

  private injectScripts(template: string, component: any): string {
    let scriptContent: string[] = [];

    // Add imports first
    if (component.imports) {
      scriptContent.push(...component.imports
        .filter((line: any) => typeof line === 'string' && line.trim().length > 0)
        .map((line: any) => (typeof line === 'string' ? line.trim() : '')));
    }

    // Add script content with proper indentation
    if (component.script && typeof component.script === 'string' && component.script.trim().length > 0) {
      // Split script into lines and preserve indentation
      const lines = component.script.split('\n');
      // Find the minimum indentation level
      const minIndent = Math.min(...lines
        .filter((line: string) => line.trim().length > 0)
        .map((line: string) => line.search(/\S|$/)));
      
      // Add script content with normalized indentation
      scriptContent.push(...lines
        .map((line: string) => line.replace(/\s+$/g, '')) // Trim trailing whitespace
        .map((line: string) => {
          // If the line is empty, keep it empty
          if (line.trim().length === 0) return '';
          // Otherwise, add 10 spaces of indentation
          return '          ' + line.slice(minIndent);
        }));
    }

    // Remove empty lines at start and end
    while (scriptContent.length > 0 && scriptContent[0].trim() === '') {
      scriptContent.shift();
    }
    while (scriptContent.length > 0 && scriptContent[scriptContent.length - 1].trim() === '') {
      scriptContent.pop();
    }

    if (scriptContent.length > 0) {
      template += `\n<script>\n${scriptContent.join('\n')}\n<\/script>`;
    }

    return template;
  }
} 
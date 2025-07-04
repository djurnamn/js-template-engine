/**
 * FileOutputManager
 * Handles all logic for writing rendered templates and styles to disk, including path resolution, directory creation, formatting, and extension hooks.
 */
import path from 'path';
import prettier from 'prettier';
import { writeOutputFile } from '../handlers/FileHandler';
import type {
  TemplateNode,
  Extension,
  RootHandlerContext,
} from '@js-template-engine/types';
import type { TemplateOptions } from '../types';
import { createLogger } from '../utils/logger';
import fs from 'fs';

/**
 * Manages file output operations for rendered templates and styles.
 */
export class FileOutputManager {
  private logger: ReturnType<typeof createLogger>;
  private formatter: (input: string, options: any) => Promise<string>;

  /**
   * Creates a new FileOutputManager instance.
   * @param verbose - Whether to enable verbose logging.
   * @param formatter - Optional custom formatter function for output.
   */
  constructor(
    verbose = false,
    formatter?: (input: string, options: any) => Promise<string>
  ) {
    this.logger = createLogger(verbose, 'FileOutputManager');
    this.formatter =
      formatter ?? (async (input, options) => prettier.format(input, options));
  }

  /**
   * Gets the output path for a given extension and options.
   *
   * @param options - The template options.
   * @param extension - The extension for which to generate the output path.
   * @returns The resolved output file path as a string.
   */
  getOutputPath(options: TemplateOptions, extension: Extension): string {
    const baseOutputDir = options.outputDir ?? 'dist';
    const filename = options.filename ?? 'untitled';
    const fileExtension = options.fileExtension ?? '.html';
    const isRenderingExtension = typeof extension.rootHandler === 'function';
    const outputDir = isRenderingExtension
      ? path.join(baseOutputDir, extension.key)
      : baseOutputDir;
    return path.join(outputDir, `${filename}${fileExtension}`);
  }

  /**
   * Writes the template and style output files for all extensions.
   * Handles formatting, directory creation, and style output.
   * Calls onOutputWrite hooks as needed.
   *
   * @param params - An object containing all parameters for output writing.
   * @param params.template - The rendered template string.
   * @param params.styleOutput - The rendered style output string.
   * @param params.hasStyles - Whether styles are present.
   * @param params.styleHandled - Whether styles have already been handled.
   * @param params.options - The template options.
   * @param params.processedNodes - The processed template nodes.
   * @param params.extensionManager - The extension manager instance.
   * @returns A promise that resolves when all outputs are written.
   */
  async writeAllOutputs({
    template,
    styleOutput,
    hasStyles,
    styleHandled,
    options,
    processedNodes,
    extensionManager,
  }: {
    template: string;
    styleOutput: string;
    hasStyles: boolean;
    styleHandled: boolean;
    options: TemplateOptions;
    processedNodes: TemplateNode[];
    extensionManager: any;
  }): Promise<void> {
    if (!options.writeOutputFile || !options.extensions) return;
    for (const extension of options.extensions) {
      const outputPath = this.getOutputPath(options, extension);
      const outputDir = path.dirname(outputPath);
      await this.ensureDir(outputDir);
      let finalOutput = template;
      if (options.prettierParser) {
        finalOutput = await this.formatter(template, {
          parser: options.prettierParser,
        });
      }
      finalOutput = extensionManager.callOnOutputWrite(finalOutput, options);
      await writeOutputFile(finalOutput, outputPath, options.verbose);
      if (
        !styleHandled &&
        hasStyles &&
        options.styles?.outputFormat !== 'inline'
      ) {
        const styleExtension =
          options.styles?.outputFormat === 'scss' ? '.scss' : '.css';
        const stylePath = path.join(
          outputDir,
          `${options.filename ?? 'untitled'}${styleExtension}`
        );
        await writeOutputFile(styleOutput, stylePath, options.verbose);
      }
    }
  }

  /**
   * Ensures a directory exists, creating it recursively if needed.
   *
   * @param dir - The directory path to ensure exists.
   * @returns A promise that resolves when the directory exists.
   */
  async ensureDir(dir: string): Promise<void> {
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

/**
 * FileOutputManager
 * Handles all logic for writing rendered templates and styles to disk, including path resolution, directory creation, formatting, and extension hooks.
 */
import path from 'path';
import prettier from 'prettier';
import { writeOutputFile } from '../handlers/FileHandler';
import type { TemplateNode, Extension, RootHandlerContext } from '@js-template-engine/types';
import type { TemplateOptions } from '../types';
import { createLogger } from './logger';
import fs from 'fs';

export class FileOutputManager {
  private logger: ReturnType<typeof createLogger>;
  private formatter: (input: string, options: any) => Promise<string>;

  constructor(verbose = false, formatter?: (input: string, options: any) => Promise<string>) {
    this.logger = createLogger(verbose, 'FileOutputManager');
    this.formatter = formatter ?? (async (input, options) => prettier.format(input, options));
  }

  /**
   * Get the output path for a given extension and options.
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
   * Write the template and style output files for all extensions.
   * Handles formatting, directory creation, and style output.
   * Calls onOutputWrite hooks as needed.
   */
  async writeAllOutputs({
    template,
    styleOutput,
    hasStyles,
    styleHandled,
    options,
    processedNodes,
    extensionManager
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
      if (!styleHandled && hasStyles && options.styles?.outputFormat !== 'inline') {
        const styleExtension = options.styles?.outputFormat === 'scss' ? '.scss' : '.css';
        const stylePath = path.join(
          outputDir,
          `${options.filename ?? 'untitled'}${styleExtension}`
        );
        await writeOutputFile(styleOutput, stylePath, options.verbose);
      }
    }
  }

  /**
   * Ensure a directory exists, creating it recursively if needed.
   */
  async ensureDir(dir: string): Promise<void> {
    await fs.promises.mkdir(dir, { recursive: true });
  }
} 
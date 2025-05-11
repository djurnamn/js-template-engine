import { TemplateEngine } from '../engine/TemplateEngine';
import { TemplateExtension, TemplateNode } from '../types';
export declare function readJsonFile(sourcePath: string): TemplateNode[];
export declare function writeOutputFile(template: string, outputPath: string, verbose?: boolean): void;
export declare function getSourcePathType(sourcePath: string): Promise<'directory' | 'file' | undefined>;
export declare function processFile(sourcePath: string, outputDir: string, extensions: TemplateExtension[], templateEngine: TemplateEngine, name?: string, componentName?: string, verbose?: boolean): Promise<void>;
export declare function processDirectory(sourceDir: string, outputDir: string, extensions: TemplateExtension[], templateEngine: TemplateEngine, verbose?: boolean): Promise<void>;

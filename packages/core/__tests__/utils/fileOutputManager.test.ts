// @vitest-environment node
// This test file is intended for Vitest, not Jest.
import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import prettier from 'prettier';
import { FileOutputManager } from '../../src/engine/FileOutputManager';
import type { TemplateOptions } from '../../src/types';
import type { Extension } from '@js-template-engine/types';

describe('FileOutputManager', () => {
  const baseOptions: TemplateOptions = {
    filename: 'testfile',
    outputDir: 'dist',
    writeOutputFile: true,
    styles: { outputFormat: 'css', generateSourceMap: false, minify: false },
    extensions: [],
    verbose: false,
  };

  const extension: Extension = {
    key: 'test',
    rootHandler: () => '',
  };

  let fileOutputManager: FileOutputManager;
  let mockFormatter: any;

  beforeEach(() => {
    mockFormatter = vi.fn(async (input, options) => 'formatted');
    fileOutputManager = new FileOutputManager(false, mockFormatter);
  });

  describe('getOutputPath', () => {
    it('returns correct path for rendering extension', () => {
      const result = fileOutputManager.getOutputPath(baseOptions, extension);
      expect(result).toContain(path.join('dist', 'test', 'testfile.js'));
    });
    it('returns correct path for non-rendering extension', () => {
      const ext: Extension = { key: 'plain' };
      const result = fileOutputManager.getOutputPath(baseOptions, ext);
      expect(result).toContain(path.join('dist', 'testfile.js'));
    });
    it('uses defaults if options are missing', () => {
      const opts = {} as TemplateOptions;
      const ext: Extension = { key: 'plain' };
      const result = fileOutputManager.getOutputPath(opts, ext);
      expect(result).toContain(path.join('dist', 'untitled.js'));
    });
  });

  describe('ensureDir', () => {
    it('creates directory recursively', async () => {
      const mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined as any);
      await fileOutputManager.ensureDir('some/deep/dir');
      expect(mkdirSpy).toHaveBeenCalledWith('some/deep/dir', { recursive: true });
      mkdirSpy.mockRestore();
    });
  });

  describe('writeAllOutputs', () => {
    it('writes template and style files for all extensions', async () => {
      const writeOutputFile = vi.fn().mockResolvedValue(undefined);
      const ensureDir = vi.spyOn(fileOutputManager, 'ensureDir').mockResolvedValue(undefined as any);
      const extManager = { callOnOutputWrite: vi.fn((out) => out) };
      const ext: Extension = { key: 'test', rootHandler: () => '' };
      const options: TemplateOptions = { ...baseOptions, extensions: [ext], prettierParser: 'html' };
      (fileOutputManager as any).constructor.prototype.writeOutputFile = writeOutputFile;
      await fileOutputManager.writeAllOutputs({
        template: 'template',
        styleOutput: 'styles',
        hasStyles: true,
        styleHandled: false,
        options,
        processedNodes: [],
        extensionManager: extManager,
      });
      expect(ensureDir).toHaveBeenCalled();
      expect(mockFormatter).toHaveBeenCalled();
      expect(extManager.callOnOutputWrite).toHaveBeenCalled();
      ensureDir.mockRestore();
    });
    it('does nothing if writeOutputFile is false', async () => {
      const extManager = { callOnOutputWrite: vi.fn((out) => out) };
      const options: TemplateOptions = { ...baseOptions, writeOutputFile: false };
      const ensureDir = vi.spyOn(fileOutputManager, 'ensureDir');
      await fileOutputManager.writeAllOutputs({
        template: 'template',
        styleOutput: 'styles',
        hasStyles: true,
        styleHandled: false,
        options,
        processedNodes: [],
        extensionManager: extManager,
      });
      expect(ensureDir).not.toHaveBeenCalled();
      ensureDir.mockRestore();
    });
  });
}); 
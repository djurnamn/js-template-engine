import { TemplateEngine } from './engine/TemplateEngine';
import { BemExtension } from './extensions/bem';
import { ReactExtension } from './extensions/react';
import { processFile, processDirectory } from './handlers/FileHandler';

export {
  TemplateEngine,
  BemExtension,
  ReactExtension,
  processFile,
  processDirectory,
}; 
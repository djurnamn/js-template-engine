import { CommandModule } from 'yargs';
import { TemplateOptions } from './index';
import { ReactExtensionOptions } from './extensions';
import { BemExtensionOptions } from './extensions';

export interface CliOptions extends Omit<TemplateOptions, 'extensions'> {
  sourcePath: string;
  outputDir?: string;
  verbose?: boolean;
  extension?: 'react' | 'bem' | 'none';
  componentName?: string;
  fileExtension?: string;
  extensions?: string[];
  name?: string;
}

export interface ReactCliOptions extends CliOptions, ReactExtensionOptions {
  extension: 'react';
  componentName: string;
  fileExtension: '.jsx' | '.tsx';
}

export interface BemCliOptions extends CliOptions, BemExtensionOptions {
  extension: 'bem';
  fileExtension: '.html' | '.css';
}

export interface BaseCliOptions extends CliOptions {
  extension: 'none';
  fileExtension: '.html';
}

export type CliCommandOptions = ReactCliOptions | BemCliOptions | BaseCliOptions;

export type CliCommand = CommandModule<{}, CliCommandOptions>; 
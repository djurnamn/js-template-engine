import { CommandModule } from 'yargs';

export interface CliOptions {
  sourcePath: string;
  outputDir?: string;
  verbose?: boolean;
  extension?: 'react' | 'bem' | 'none';
  componentName?: string;
  fileExtension?: string;
  extensions?: string[];
  name?: string;
}

export interface ReactCliOptions extends CliOptions {
  extension: 'react';
  componentName: string;
  fileExtension: '.jsx' | '.tsx';
  importStatements?: string[];
  exportType?: 'default' | 'named';
  propsInterface?: string;
  props?: string;
}

export interface BemCliOptions extends CliOptions {
  extension: 'bem';
  fileExtension: '.html' | '.css';
  prefix?: string;
  separator?: {
    element?: string;
    modifier?: string;
  };
}

export interface BaseCliOptions extends CliOptions {
  extension: 'none';
  fileExtension: '.html';
}

export type CliCommandOptions = ReactCliOptions | BemCliOptions | BaseCliOptions;

export type CliCommand = CommandModule<{}, CliCommandOptions>; 
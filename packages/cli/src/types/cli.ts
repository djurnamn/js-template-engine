import { CommandModule } from 'yargs';

export interface CliOptions {
  sourcePath: string;
  config?: string;
  outputDir?: string;
  name?: string;
  componentName?: string;
  language?: 'typescript' | 'javascript';
  verbose?: boolean;
  extensions?: string[];
  _: string[];
  $0: string;
}

export type CliCommand = CommandModule<{}, CliOptions>;


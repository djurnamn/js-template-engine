import { CommandModule } from 'yargs';

export interface CliOptions {
  sourcePath: string;
  config?: string;
  outputDir?: string;
  name?: string;
  fileExtension?: '.html' | '.jsx' | '.tsx' | '.css';
  verbose?: boolean;
  extensions?: string[];
  _: string[];
  $0: string;
}

export type CliCommand = CommandModule<{}, CliOptions>;


import type { StyleOutputFormat } from '@js-template-engine/types';

export interface StyleDefinition {
  [key: string]: string | number | boolean | StyleDefinition | undefined;
}

export interface StyleOptions {
  outputFormat?: StyleOutputFormat;
}

export interface InitOptions {
  projectName: string;
  frameworks: string[];
  styling: string[];
  typescript: boolean;
  includeExamples?: boolean;
  targetDir?: string;
}

export interface UIKitConfig {
  name: string;
  version: string;
  capabilities: {
    frameworks: string[];
    styling: string[];
    typescript: boolean;
  };
  components: Record<string, ComponentConfig>;
  conflictResolution: {
    default: 'prompt' | 'overwrite' | 'skip';
    allowDiff: boolean;
    allowMerge: boolean;
    createBackups: boolean;
  };
}

export interface ComponentConfig {
  frameworks?: string[];
  styling?: string[];
  dependencies?: string[];
}

export interface FrameworkOption {
  name: string;
  value: string;
  description: string;
}

export interface StylingOption {
  name: string;
  value: string;
  description: string;
  frameworks?: string[]; // Compatible frameworks
}

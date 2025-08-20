import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export interface DependencyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingDependencies: string[];
  availableRegistries: string[];
}

export interface DependencyInfo {
  name: string;
  version: string;
  required: boolean;
  registry?: string;
}

export class DependencyValidator {
  /**
   * Validates that all required dependencies are available
   */
  static async validateProjectDependencies(
    projectDir: string,
    dependencies: DependencyInfo[]
  ): Promise<DependencyValidationResult> {
    const result: DependencyValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      missingDependencies: [],
      availableRegistries: []
    };

    try {
      // Check if package.json exists
      const packageJsonPath = path.join(projectDir, 'package.json');
      if (!await fs.pathExists(packageJsonPath)) {
        result.errors.push('package.json not found in project directory');
        result.isValid = false;
        return result;
      }

      // Read package.json
      const packageJson = await fs.readJson(packageJsonPath);
      
      // Get available registries
      result.availableRegistries = await DependencyValidator.getAvailableRegistries();

      // Check each dependency
      for (const dep of dependencies) {
        const isAvailable = await DependencyValidator.checkDependencyAvailability(dep);
        
        if (!isAvailable.available) {
          if (dep.required) {
            result.errors.push(`Required dependency ${dep.name}@${dep.version} is not available`);
            result.missingDependencies.push(dep.name);
            result.isValid = false;
          } else {
            result.warnings.push(`Optional dependency ${dep.name}@${dep.version} is not available`);
          }
          
          // Add specific guidance for workspace packages
          if (dep.name.startsWith('@js-template-engine/')) {
            result.warnings.push(
              `Workspace package ${dep.name} is not published to NPM. ` +
              'Consider using file: paths for development or publish the package first.'
            );
          }
        }
      }

      // Check for potential registry issues
      const hasWorkspaceDeps = dependencies.some(dep => dep.name.startsWith('@js-template-engine/'));
      if (hasWorkspaceDeps && result.availableRegistries.length === 0) {
        result.warnings.push('No NPM registry configured. Workspace dependencies may not resolve.');
      }

    } catch (error) {
      result.errors.push(`Dependency validation failed: ${error instanceof Error ? error.message : error}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Checks if a specific dependency is available in configured registries
   */
  private static async checkDependencyAvailability(dep: DependencyInfo): Promise<{
    available: boolean;
    registry?: string;
    error?: string;
  }> {
    try {
      // Try npm view command to check if package exists
      const command = `npm view ${dep.name}@${dep.version} version --json`;
      await execAsync(command, { timeout: 5000 });
      return { available: true };
    } catch (error) {
      // Package not found or other error
      const err = error as any;
      if (err.code === 404 || err.stderr?.includes('404')) {
        return { 
          available: false, 
          error: `Package ${dep.name}@${dep.version} not found in registry`
        };
      }
      return { 
        available: false, 
        error: `Error checking ${dep.name}: ${err.message || err}`
      };
    }
  }

  /**
   * Gets list of available NPM registries
   */
  private static async getAvailableRegistries(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('npm config get registry', { timeout: 3000 });
      const registry = stdout.trim();
      return registry ? [registry] : [];
    } catch {
      return ['https://registry.npmjs.org/']; // Default NPM registry
    }
  }

  /**
   * Generates suggestions for fixing dependency issues
   */
  static generateDependencyFixSuggestions(
    result: DependencyValidationResult,
    projectName: string
  ): string[] {
    const suggestions: string[] = [];

    if (result.missingDependencies.length > 0) {
      suggestions.push('📦 Missing Dependencies Detected');
      suggestions.push('');

      // Check for workspace dependencies
      const workspaceDeps = result.missingDependencies.filter(dep => 
        dep.startsWith('@js-template-engine/')
      );

      if (workspaceDeps.length > 0) {
        suggestions.push('🚨 Workspace Dependencies Issue:');
        suggestions.push('The generated project references workspace packages that aren\'t published to NPM yet.');
        suggestions.push('');
        suggestions.push('Quick fixes:');
        suggestions.push('1. For development/testing:');
        suggestions.push('   • Use npm link to link workspace packages');
        suggestions.push('   • Use file: paths in package.json dependencies');
        suggestions.push('   • Run "npm install" from the workspace root');
        suggestions.push('');
        suggestions.push('2. For production use:');
        suggestions.push('   • Publish @js-template-engine/* packages to NPM first');
        suggestions.push('   • Use a private NPM registry');
        suggestions.push('   • Bundle dependencies with the UI kit');
        suggestions.push('');
      }

      const externalDeps = result.missingDependencies.filter(dep => 
        !dep.startsWith('@js-template-engine/')
      );

      if (externalDeps.length > 0) {
        suggestions.push('📋 External Dependencies:');
        suggestions.push('The following packages need to be installed:');
        externalDeps.forEach(dep => suggestions.push(`   • ${dep}`));
        suggestions.push('');
        suggestions.push('Run: npm install ' + externalDeps.join(' '));
        suggestions.push('');
      }
    }

    if (result.warnings.length > 0 && result.errors.length === 0) {
      suggestions.push('⚠️  Warnings (project should still work):');
      result.warnings.forEach(warning => suggestions.push(`   • ${warning}`));
      suggestions.push('');
    }

    if (result.availableRegistries.length === 0) {
      suggestions.push('🔧 Registry Configuration:');
      suggestions.push('   • Check NPM registry: npm config get registry');
      suggestions.push('   • Set registry: npm config set registry https://registry.npmjs.org/');
      suggestions.push('');
    }

    return suggestions;
  }

  /**
   * Creates a development-friendly package.json with file: dependencies
   */
  static async createDevelopmentPackageJson(
    packageJsonPath: string,
    workspaceRoot: string = '../..'
  ): Promise<void> {
    if (!await fs.pathExists(packageJsonPath)) {
      throw new Error(`package.json not found: ${packageJsonPath}`);
    }

    const packageJson = await fs.readJson(packageJsonPath);
    const originalPath = `${packageJsonPath}.original`;

    // Create backup of original
    if (!await fs.pathExists(originalPath)) {
      await fs.copy(packageJsonPath, originalPath);
    }

    // Replace workspace dependencies with file: paths
    const deps = { ...packageJson.dependencies };
    const devDeps = { ...packageJson.devDependencies };

    for (const [name, version] of Object.entries(deps)) {
      if (typeof name === 'string' && name.startsWith('@js-template-engine/')) {
        const packageName = name.replace('@js-template-engine/', '');
        deps[name] = `file:${workspaceRoot}/packages/${packageName}`;
      }
    }

    for (const [name, version] of Object.entries(devDeps || {})) {
      if (typeof name === 'string' && name.startsWith('@js-template-engine/')) {
        const packageName = name.replace('@js-template-engine/', '');
        devDeps[name] = `file:${workspaceRoot}/packages/${packageName}`;
      }
    }

    // Update package.json
    const updatedPackageJson = {
      ...packageJson,
      dependencies: deps,
      devDependencies: devDeps,
      _generatedForDevelopment: true,
      _originalBackup: path.basename(originalPath)
    };

    await fs.writeJson(packageJsonPath, updatedPackageJson, { spaces: 2 });
  }

  /**
   * Quick validation for a generated UI kit project
   */
  static async validateUIKitProject(projectDir: string): Promise<DependencyValidationResult> {
    const packageJsonPath = path.join(projectDir, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      return {
        isValid: false,
        errors: ['package.json not found'],
        warnings: [],
        missingDependencies: [],
        availableRegistries: []
      };
    }

    const packageJson = await fs.readJson(packageJsonPath);
    const dependencies: DependencyInfo[] = [];

    // Convert dependencies to DependencyInfo format
    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        dependencies.push({
          name,
          version: String(version),
          required: true
        });
      }
    }

    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        dependencies.push({
          name,
          version: String(version),
          required: false
        });
      }
    }

    return await DependencyValidator.validateProjectDependencies(projectDir, dependencies);
  }
}
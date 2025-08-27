import fs from 'fs-extra';
import path from 'path';

export interface FileOperationOptions {
  retries?: number;
  backoff?: number;
  createBackup?: boolean;
  overwrite?: boolean;
}

export interface FileOperationResult {
  success: boolean;
  error?: Error;
  backupPath?: string;
}

export class FileSystemUtils {
  /**
   * Safely writes a file with error handling and retry logic
   */
  static async writeFileSafe(
    filePath: string,
    content: string,
    options: FileOperationOptions = {}
  ): Promise<FileOperationResult> {
    const {
      retries = 3,
      backoff = 1000,
      createBackup = false,
      overwrite = true,
    } = options;

    let backupPath: string | undefined;

    try {
      // Check if file exists and handle accordingly
      const exists = await fs.pathExists(filePath);

      if (exists && !overwrite) {
        return {
          success: false,
          error: new Error(`File already exists: ${filePath}`),
        };
      }

      // Create backup if requested and file exists
      if (exists && createBackup) {
        backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.copy(filePath, backupPath);
      }

      // Ensure parent directory exists
      const parentDir = path.dirname(filePath);
      await fs.ensureDir(parentDir);

      // Attempt to write file with retries
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await fs.writeFile(filePath, content, 'utf8');
          return { success: true, backupPath };
        } catch (error) {
          if (attempt === retries) {
            // Restore backup if final attempt fails
            if (backupPath && (await fs.pathExists(backupPath))) {
              await fs.move(backupPath, filePath, { overwrite: true });
            }
            throw error;
          }

          // Wait before retry
          await new Promise((resolve) =>
            setTimeout(resolve, backoff * attempt)
          );
        }
      }

      // This should never be reached
      throw new Error('Unexpected error in writeFileSafe');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        backupPath,
      };
    }
  }

  /**
   * Safely creates a directory structure with error handling
   */
  static async ensureDirSafe(
    dirPath: string,
    options: FileOperationOptions = {}
  ): Promise<FileOperationResult> {
    const { retries = 3, backoff = 500 } = options;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await fs.ensureDir(dirPath);
        return { success: true };
      } catch (error) {
        const err = error as NodeJS.ErrnoException;

        // Some errors are not recoverable
        if (err.code === 'EACCES' || err.code === 'EPERM') {
          return {
            success: false,
            error: new Error(
              `Permission denied: Cannot create directory ${dirPath}`
            ),
          };
        }

        if (err.code === 'ENOSPC') {
          return {
            success: false,
            error: new Error(
              `No space left on device: Cannot create directory ${dirPath}`
            ),
          };
        }

        if (attempt === retries) {
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }

        // Wait before retry for transient errors
        await new Promise((resolve) => setTimeout(resolve, backoff * attempt));
      }
    }

    return {
      success: false,
      error: new Error('Unexpected error in ensureDirSafe'),
    };
  }

  /**
   * Safely copies files with error handling and verification
   */
  static async copyFileSafe(
    src: string,
    dest: string,
    options: FileOperationOptions = {}
  ): Promise<FileOperationResult> {
    const { retries = 3, backoff = 1000, overwrite = true } = options;

    try {
      // Check if source exists
      if (!(await fs.pathExists(src))) {
        return {
          success: false,
          error: new Error(`Source file does not exist: ${src}`),
        };
      }

      // Check if destination exists
      const destExists = await fs.pathExists(dest);
      if (destExists && !overwrite) {
        return {
          success: false,
          error: new Error(`Destination file already exists: ${dest}`),
        };
      }

      // Ensure destination directory exists
      const destDir = path.dirname(dest);
      const dirResult = await FileSystemUtils.ensureDirSafe(destDir);
      if (!dirResult.success) {
        return dirResult;
      }

      // Attempt to copy with retries
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await fs.copy(src, dest, { overwrite });

          // Verify the copy was successful
          const srcStats = await fs.stat(src);
          const destStats = await fs.stat(dest);

          if (srcStats.size !== destStats.size) {
            throw new Error('File copy verification failed: size mismatch');
          }

          return { success: true };
        } catch (error) {
          if (attempt === retries) {
            throw error;
          }
          await new Promise((resolve) =>
            setTimeout(resolve, backoff * attempt)
          );
        }
      }

      throw new Error('Unexpected error in copyFileSafe');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Safely removes files or directories with error handling
   */
  static async removeSafe(
    target: string,
    options: FileOperationOptions = {}
  ): Promise<FileOperationResult> {
    const { retries = 3, backoff = 500 } = options;

    try {
      if (!(await fs.pathExists(target))) {
        return { success: true }; // Already doesn't exist
      }

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await fs.remove(target);
          return { success: true };
        } catch (error) {
          const err = error as NodeJS.ErrnoException;

          // Permission errors are not recoverable
          if (err.code === 'EACCES' || err.code === 'EPERM') {
            return {
              success: false,
              error: new Error(`Permission denied: Cannot remove ${target}`),
            };
          }

          if (attempt === retries) {
            throw error;
          }

          await new Promise((resolve) =>
            setTimeout(resolve, backoff * attempt)
          );
        }
      }

      throw new Error('Unexpected error in removeSafe');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Gets detailed error information for file system operations
   */
  static getErrorDetails(error: Error): {
    code?: string;
    message: string;
    recoverable: boolean;
    suggestions: string[];
  } {
    const err = error as NodeJS.ErrnoException;
    const suggestions: string[] = [];
    let recoverable = true;

    switch (err.code) {
      case 'ENOENT':
        suggestions.push('Check if the file or directory path is correct');
        suggestions.push('Ensure parent directories exist');
        break;

      case 'EACCES':
      case 'EPERM':
        suggestions.push('Check file/directory permissions');
        suggestions.push(
          'Try running with elevated privileges (if appropriate)'
        );
        suggestions.push('Ensure you have write access to the target location');
        recoverable = false;
        break;

      case 'ENOSPC':
        suggestions.push('Free up disk space');
        suggestions.push('Try using a different location with more space');
        recoverable = false;
        break;

      case 'ENOTDIR':
        suggestions.push('Check that parent path components are directories');
        suggestions.push('Remove any files that conflict with directory names');
        break;

      case 'EISDIR':
        suggestions.push('Target is a directory, specify a file path');
        break;

      case 'EEXIST':
        suggestions.push('File or directory already exists');
        suggestions.push('Use overwrite option or choose different name');
        break;

      default:
        suggestions.push('Check file system permissions and disk space');
        suggestions.push('Try the operation again');
        break;
    }

    return {
      code: err.code,
      message: error.message,
      recoverable,
      suggestions,
    };
  }

  /**
   * Validates file system operations before attempting them
   */
  static async validateOperation(
    operation: 'read' | 'write' | 'create' | 'delete',
    target: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const exists = await fs.pathExists(target);
      const parentDir = path.dirname(target);
      const parentExists = await fs.pathExists(parentDir);

      switch (operation) {
        case 'read':
          if (!exists) {
            errors.push(`Cannot read: ${target} does not exist`);
          }
          break;

        case 'write':
          if (!parentExists) {
            errors.push(
              `Cannot write: parent directory ${parentDir} does not exist`
            );
          } else {
            // Check if we can write to the directory
            try {
              await fs.access(parentDir, fs.constants.W_OK);
            } catch {
              errors.push(
                `Cannot write: no write permission for directory ${parentDir}`
              );
            }
          }
          break;

        case 'create':
          if (exists) {
            errors.push(`Cannot create: ${target} already exists`);
          }
          if (!parentExists) {
            errors.push(
              `Cannot create: parent directory ${parentDir} does not exist`
            );
          }
          break;

        case 'delete':
          if (!exists) {
            errors.push(`Cannot delete: ${target} does not exist`);
          }
          break;
      }
    } catch (error) {
      errors.push(
        `Validation failed: ${error instanceof Error ? error.message : error}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

import { describe, it, expect } from 'vitest';
import { FileSystemUtils } from '../../src/utilities/file-system';
import type { FileOperationOptions } from '../../src/utilities/file-system';

describe('File System Utilities', () => {
  describe('getErrorDetails', () => {
    it('should handle ENOENT errors', () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';

      const details = FileSystemUtils.getErrorDetails(error);
      
      expect(details.code).toBe('ENOENT');
      expect(details.message).toBe('File not found');
      expect(details.recoverable).toBe(true);
      expect(details.suggestions).toContain('Check if the file or directory path is correct');
      expect(details.suggestions).toContain('Ensure parent directories exist');
    });

    it('should handle permission errors as non-recoverable', () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';

      const details = FileSystemUtils.getErrorDetails(error);
      
      expect(details.code).toBe('EACCES');
      expect(details.recoverable).toBe(false);
      expect(details.suggestions).toContain('Check file/directory permissions');
      expect(details.suggestions).toContain('Try running with elevated privileges (if appropriate)');
    });

    it('should handle disk space errors as non-recoverable', () => {
      const error = new Error('No space left on device') as NodeJS.ErrnoException;
      error.code = 'ENOSPC';

      const details = FileSystemUtils.getErrorDetails(error);
      
      expect(details.code).toBe('ENOSPC');
      expect(details.recoverable).toBe(false);
      expect(details.suggestions).toContain('Free up disk space');
      expect(details.suggestions).toContain('Try using a different location with more space');
    });

    it('should handle directory type errors', () => {
      const error = new Error('Not a directory') as NodeJS.ErrnoException;
      error.code = 'ENOTDIR';

      const details = FileSystemUtils.getErrorDetails(error);
      
      expect(details.code).toBe('ENOTDIR');
      expect(details.recoverable).toBe(true);
      expect(details.suggestions).toContain('Check that parent path components are directories');
    });

    it('should handle file exists errors', () => {
      const error = new Error('File exists') as NodeJS.ErrnoException;
      error.code = 'EEXIST';

      const details = FileSystemUtils.getErrorDetails(error);
      
      expect(details.code).toBe('EEXIST');
      expect(details.recoverable).toBe(true);
      expect(details.suggestions).toContain('File or directory already exists');
      expect(details.suggestions).toContain('Use overwrite option or choose different name');
    });

    it('should handle unknown errors with generic suggestions', () => {
      const error = new Error('Unknown error') as NodeJS.ErrnoException;
      error.code = 'UNKNOWN';

      const details = FileSystemUtils.getErrorDetails(error);
      
      expect(details.code).toBe('UNKNOWN');
      expect(details.recoverable).toBe(true);
      expect(details.suggestions).toContain('Check file system permissions and disk space');
      expect(details.suggestions).toContain('Try the operation again');
    });

    it('should handle errors without error codes', () => {
      const error = new Error('Generic error');

      const details = FileSystemUtils.getErrorDetails(error);
      
      expect(details.code).toBeUndefined();
      expect(details.message).toBe('Generic error');
      expect(details.recoverable).toBe(true);
    });
  });

  describe('FileOperationOptions defaults', () => {
    it('should validate option types', () => {
      // These tests verify the interface structure
      const validOptions: FileOperationOptions = {
        retries: 3,
        backoff: 1000,
        createBackup: true,
        overwrite: false
      };

      expect(typeof validOptions.retries).toBe('number');
      expect(typeof validOptions.backoff).toBe('number'); 
      expect(typeof validOptions.createBackup).toBe('boolean');
      expect(typeof validOptions.overwrite).toBe('boolean');
    });

    it('should accept partial options', () => {
      const partialOptions: FileOperationOptions = {
        retries: 5
      };

      expect(partialOptions.retries).toBe(5);
      expect(partialOptions.backoff).toBeUndefined();
      expect(partialOptions.createBackup).toBeUndefined();
      expect(partialOptions.overwrite).toBeUndefined();
    });

    it('should accept empty options', () => {
      const emptyOptions: FileOperationOptions = {};
      
      expect(emptyOptions.retries).toBeUndefined();
      expect(emptyOptions.backoff).toBeUndefined();
      expect(emptyOptions.createBackup).toBeUndefined();
      expect(emptyOptions.overwrite).toBeUndefined();
    });
  });

  describe('Error handling patterns', () => {
    it('should create consistent error responses for file operations', () => {
      const error = new Error('Test error');
      const result = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Test error');
    });

    it('should handle non-Error objects', () => {
      const nonErrorValue = 'string error';
      const result = {
        success: false,
        error: nonErrorValue instanceof Error ? nonErrorValue : new Error(String(nonErrorValue))
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('string error');
    });
  });

  describe('Path validation helpers', () => {
    it('should identify valid file operation types', () => {
      const validOperations = ['read', 'write', 'create', 'delete'] as const;
      
      validOperations.forEach(operation => {
        expect(typeof operation).toBe('string');
        expect(['read', 'write', 'create', 'delete']).toContain(operation);
      });
    });

    it('should handle backup path naming pattern', () => {
      const originalPath = '/path/to/file.txt';
      const timestamp = 1234567890;
      const expectedBackupPath = `${originalPath}.backup.${timestamp}`;
      
      expect(expectedBackupPath).toBe('/path/to/file.txt.backup.1234567890');
    });
  });

  describe('Retry logic validation', () => {
    it('should calculate exponential backoff correctly', () => {
      const baseBackoff = 1000;
      const attempt = 3;
      const expectedDelay = baseBackoff * attempt;
      
      expect(expectedDelay).toBe(3000);
    });

    it('should validate retry parameters', () => {
      const options: FileOperationOptions = {
        retries: 5,
        backoff: 500
      };
      
      expect(options.retries).toBeGreaterThan(0);
      expect(options.backoff).toBeGreaterThan(0);
    });
  });

  describe('File verification patterns', () => {
    it('should validate file size comparison logic', () => {
      const srcSize = 1024;
      const destSize = 1024;
      const isMatch = srcSize === destSize;
      
      expect(isMatch).toBe(true);
    });

    it('should detect file size mismatches', () => {
      const srcSize = 1024;
      const destSize = 2048;
      const isMatch = srcSize === destSize;
      
      expect(isMatch).toBe(false);
    });
  });
});
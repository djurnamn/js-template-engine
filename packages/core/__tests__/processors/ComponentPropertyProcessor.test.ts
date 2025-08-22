/**
 * Tests for ComponentPropertyProcessor - Template Properties Abstraction
 */

import { ComponentPropertyProcessor, DEFAULT_MERGE_STRATEGIES } from '../../src/processors/ComponentPropertyProcessor';
import type { ComponentDefinition, RenderOptions } from '../../src/processors/ComponentPropertyProcessor';
import { ErrorCollector } from '../../src/metadata';

describe('ComponentPropertyProcessor', () => {
  let processor: ComponentPropertyProcessor;
  let errorCollector: ErrorCollector;

  beforeEach(() => {
    errorCollector = new ErrorCollector();
    processor = new ComponentPropertyProcessor(DEFAULT_MERGE_STRATEGIES, errorCollector);
  });

  describe('Component Name Resolution', () => {
    it('should resolve component name with correct priority', () => {
      const options: RenderOptions = {
        framework: 'react',
        component: {
          name: 'ExplicitName', // Priority 1
          extensions: {
            react: { name: 'ReactSpecific' } // Priority 2
          }
        }
      };

      const component: ComponentDefinition = {
        common: { name: 'CommonName', props: {}, imports: [], script: '' } // Priority 3
      };

      const result = processor.resolveComponentName(options, component, 'DefaultName');
      expect(result).toBe('ExplicitName'); // Should use priority 1
    });

    it('should fall back to framework-specific name', () => {
      const options: RenderOptions = {
        framework: 'react',
        component: {
          extensions: {
            react: { name: 'ReactSpecific' }
          }
        }
      };

      const component: ComponentDefinition = {
        common: { name: 'CommonName', props: {}, imports: [], script: '' }
      };

      const result = processor.resolveComponentName(options, component, 'DefaultName');
      expect(result).toBe('ReactSpecific'); // Should use priority 2
    });

    it('should fall back to common name', () => {
      const options: RenderOptions = {
        framework: 'react',
        component: {}
      };

      const component: ComponentDefinition = {
        common: { name: 'CommonName', props: {}, imports: [], script: '' }
      };

      const result = processor.resolveComponentName(options, component, 'DefaultName');
      expect(result).toBe('CommonName'); // Should use priority 3
    });

    it('should use default name as last resort', () => {
      const options: RenderOptions = {
        framework: 'react',
        component: {}
      };

      const component: ComponentDefinition = {};

      const result = processor.resolveComponentName(options, component, 'DefaultName');
      expect(result).toBe('DefaultName'); // Should use priority 4
    });
  });

  describe('Props Merging', () => {
    it('should merge props with default strategy', () => {
      const common = { date: 'Date', title: 'string' };
      const framework = { date: 'Date', onUpdate: '(date: Date) => void' };

      const result = processor.mergeProps(common, framework, DEFAULT_MERGE_STRATEGIES.props);

      expect(result).toEqual({
        date: 'Date',
        title: 'string', 
        onUpdate: '(date: Date) => void'
      });
    });

    it('should handle prop conflicts with warning', () => {
      const common = { date: 'string', title: 'string' };
      const framework = { date: 'Date', onUpdate: 'function' };

      const result = processor.mergeProps(common, framework, {
        mode: 'merge',
        conflictResolution: 'warn'
      });

      expect(result.date).toBe('Date'); // Framework wins by default
      expect(errorCollector.hasWarnings()).toBe(true);
    });

    it('should resolve conflicts with common-wins strategy', () => {
      const common = { date: 'string', title: 'string' };
      const framework = { date: 'Date', onUpdate: 'function' };

      const result = processor.mergeProps(common, framework, {
        mode: 'merge',
        conflictResolution: 'common-wins'
      });

      expect(result.date).toBe('string'); // Common wins
      expect(result.onUpdate).toBe('function'); // No conflict
    });
  });

  describe('Script Merging', () => {
    it('should append scripts with default strategy', () => {
      const common = 'const date = new Date();';
      const framework = 'const [state, setState] = useState();';

      const result = processor.mergeScript(common, framework, DEFAULT_MERGE_STRATEGIES.script);

      expect(result).toBe(common + '\n\n' + framework);
    });

    it('should prepend framework script', () => {
      const common = 'const date = new Date();';
      const framework = 'const [state, setState] = useState();';

      const result = processor.mergeScript(common, framework, {
        mode: 'prepend',
        separator: '\n\n',
        includeComments: false
      });

      expect(result).toBe(framework + '\n\n' + common);
    });

    it('should replace with framework script only', () => {
      const common = 'const date = new Date();';
      const framework = 'const [state, setState] = useState();';

      const result = processor.mergeScript(common, framework, {
        mode: 'replace',
        separator: '\n\n',
        includeComments: false
      });

      expect(result).toBe(framework);
    });

    it('should include comments when enabled', () => {
      const common = 'const date = new Date();';
      const framework = 'const [state, setState] = useState();';

      const result = processor.mergeScript(common, framework, {
        mode: 'append',
        separator: '\n\n',
        includeComments: true
      });

      expect(result).toContain('// Merged: append');
    });
  });

  describe('Import Merging', () => {
    it('should merge imports with deduplication', () => {
      const common = [
        { from: 'dayjs', default: 'dayjs' },
        { from: 'lodash', named: ['merge'] }
      ];
      const framework = [
        { from: 'react', named: ['useState', 'useEffect'] },
        { from: 'dayjs', named: ['extend'] } // Should be merged with common
      ];

      const result = processor.mergeImports(common, framework, {
        mode: 'merge',
        deduplication: true,
        grouping: true
      });

      expect(result).toHaveLength(3); // dayjs, lodash, react
      
      const dayjsImport = result.find(imp => imp.from === 'dayjs');
      expect(dayjsImport).toEqual({
        from: 'dayjs',
        default: 'dayjs',
        named: ['extend']
      });
    });

    it('should override with framework imports', () => {
      const common = [{ from: 'dayjs', default: 'dayjs' }];
      const framework = [{ from: 'react', named: ['useState'] }];

      const result = processor.mergeImports(common, framework, {
        mode: 'override',
        deduplication: false,
        grouping: false
      });

      expect(result).toEqual(framework);
    });

    it('should group imports by type and source', () => {
      const imports = [
        { from: 'react', named: ['useState'] },
        { from: 'dayjs', default: 'dayjs', typeOnly: true },
        { from: 'lodash', named: ['merge'] }
      ];

      const result = processor.mergeImports(imports, [], {
        mode: 'merge',
        deduplication: false,
        grouping: true
      });

      // Type-only imports should come first
      expect(result[0].typeOnly).toBe(true);
    });
  });

  describe('Complete Component Merging', () => {
    it('should merge complete component definition', () => {
      const component: ComponentDefinition = {
        common: {
          name: 'DateComponent',
          props: { date: 'Date', title: 'string' },
          imports: [{ from: 'dayjs', default: 'dayjs' }],
          script: 'const formatDate = (date) => dayjs(date).format();'
        },
        framework: {
          props: { onDateChange: '(date: Date) => void' },
          imports: [{ from: 'react', named: ['useState', 'useEffect'] }],
          script: 'const [selectedDate, setSelectedDate] = useState();'
        }
      };

      const options: RenderOptions = {
        framework: 'react',
        component: {}
      };

      const result = processor.mergeComponentProperties(component, options);

      expect(result.name).toBe('DateComponent');
      expect(result.props).toEqual({
        date: 'Date',
        title: 'string',
        onDateChange: '(date: Date) => void'
      });
      expect(result.imports).toHaveLength(2); // dayjs and react
      expect(result.script).toContain('formatDate');
      expect(result.script).toContain('useState');
    });
  });

  describe('Error Collection', () => {
    it('should collect errors during processing', () => {
      const result = processor.mergeProps(
        { date: 'string' },
        { date: 'Date' },
        { mode: 'merge', conflictResolution: 'error' }
      );

      expect(errorCollector.hasErrors()).toBe(true);
      const errors = errorCollector.getErrors();
      expect(errors[0].message).toContain('Props conflicts detected');
    });

    it('should allow clearing errors', () => {
      processor.mergeProps(
        { date: 'string' },
        { date: 'Date' },
        { mode: 'merge', conflictResolution: 'error' }
      );

      expect(errorCollector.hasErrors()).toBe(true);
      processor.clearErrors();
      expect(errorCollector.hasErrors()).toBe(false);
    });
  });
});
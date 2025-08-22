/**
 * Template Processing Examples - Showcasing Concept Processing
 *
 * Comprehensive examples demonstrating all advanced processing features:
 * - Component property merging with different strategies
 * - Cross-framework event normalization
 * - Concept extraction and validation
 * - Framework consistency checking
 */

import { TemplateEngine } from '../engine/TemplateEngine';
import type {
  ComponentDefinition,
  ComponentResolutionStrategy,
  ScriptMergeStrategy,
  PropMergeStrategy,
  ImportMergeStrategy,
} from '../processors';

/**
 * Example 1: Date Component with Property Merging
 *
 * Demonstrates the key advanced processing scenario from the plan:
 * Common date logic + React-specific state management
 */
export function createDateComponentExample() {
  const engine = new TemplateEngine({
    enabled: true,
    defaultFramework: 'react',
    mergeStrategies: {
      script: { mode: 'merge', includeComments: true },
      props: { mode: 'merge', conflictResolution: 'warn' },
      imports: { mode: 'merge', deduplication: true, grouping: true },
    },
  });

  // Component definition with common and framework-specific parts
  const componentDefinition: ComponentDefinition = {
    common: {
      name: 'DatePicker',
      imports: [{ from: 'dayjs', default: 'dayjs' }],
      script: `// Common date utilities
const formatDate = (date) => {
  return dayjs(date).format('YYYY-MM-DD');
};

const twoDaysFromDate = (date) => {
  return dayjs(date).add(2, 'day').toDate();
};

const isWeekend = (date) => {
  const day = dayjs(date).day();
  return day === 0 || day === 6;
};`,
      props: {
        date: 'Date',
        format: 'string',
        title: 'string',
      },
    },
    framework: {
      imports: [
        { from: 'react', named: ['useState', 'useEffect', 'useCallback'] },
      ],
      script: `// React-specific state and event handling
const [selectedDate, setSelectedDate] = useState(date);
const [isOpen, setIsOpen] = useState(false);

useEffect(() => {
  console.log('Date changed:', selectedDate);
  onDateChange?.(selectedDate);
}, [selectedDate, onDateChange]);

const handleDateSelect = useCallback((newDate) => {
  setSelectedDate(newDate);
  setIsOpen(false);
}, []);

const toggleCalendar = useCallback(() => {
  setIsOpen(prev => !prev);
}, []);`,
      props: {
        onDateChange: '(date: Date) => void',
        onOpen: '() => void',
        onClose: '() => void',
      },
    },
  };

  const template = [
    {
      type: 'element',
      tag: 'div',
      attributes: {
        class: 'date-picker',
      },
      children: [
        {
          type: 'element',
          tag: 'input',
          attributes: {
            type: 'text',
            class: 'date-picker__input',
          },
          expressionAttributes: {
            value: 'formatDate(selectedDate)',
            onClick: 'toggleCalendar',
          },
        },
        {
          type: 'if',
          condition: 'isOpen',
          then: [
            {
              type: 'element',
              tag: 'div',
              attributes: {
                class: 'date-picker__calendar',
              },
              children: [
                {
                  type: 'text',
                  content: 'Calendar component here',
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  return {
    engine,
    componentDefinition,
    template,
    async render() {
      return engine.render(template, {
        framework: 'react',
        componentDefinition,
        component: { name: 'DatePicker' },
      });
    },
  };
}

/**
 * Example 2: Cross-Framework Event Normalization
 *
 * Shows how events are normalized across Vue, React, and Svelte
 */
export function createEventNormalizationExample() {
  const template = [
    {
      type: 'element',
      tag: 'button',
      attributes: {
        class: 'action-button',
      },
      expressionAttributes: {
        '@click.prevent': 'handleClick',
        '@keydown.enter': 'handleEnterKey',
        '@mouseover': 'handleHover',
      },
      children: [{ type: 'text', content: 'Click me' }],
    },
    {
      type: 'element',
      tag: 'input',
      attributes: {
        type: 'text',
        class: 'text-input',
      },
      expressionAttributes: {
        '@input': 'handleInput',
        '@focus': 'handleFocus',
        '@blur': 'handleBlur',
      },
    },
  ];

  const frameworks = ['vue', 'react', 'svelte'] as const;
  const examples = frameworks.map((framework) => {
    const engine = new TemplateEngine({
      enabled: true,
      defaultFramework: framework,
      normalization: {
        normalizeEventNames: true,
        validateNormalizedEvents: true,
      },
      extraction: {
        useEventExtractor: true,
      },
    });

    return {
      framework,
      engine,
      async render() {
        return engine.render(template, {
          framework,
          extraction: {
            normalizeEvents: true,
            validateConcepts: true,
          },
        });
      },
    };
  });

  return { template, examples };
}

/**
 * Example 3: Merge Strategy Comparison
 *
 * Demonstrates different script merge strategies
 */
export function createMergeStrategyExample() {
  const commonScript = `const baseFunction = () => {
  console.log('Base functionality');
  return 'base';
};

const sharedVariable = 'shared';`;

  const frameworkScript = `const frameworkFunction = () => {
  console.log('Framework-specific functionality');
  return 'framework';
};

const frameworkVariable = 'framework';`;

  const strategies: ScriptMergeStrategy[] = [
    { mode: 'append', separator: '\n\n', includeComments: true },
    { mode: 'prepend', separator: '\n\n', includeComments: true },
    { mode: 'merge', separator: '\n\n', includeComments: true },
    { mode: 'replace', includeComments: false },
  ];

  const examples = strategies.map((strategy) => {
    const engine = new TemplateEngine({
      enabled: true,
      mergeStrategies: {
        script: strategy,
        props: { mode: 'merge', conflictResolution: 'warn' },
        imports: { mode: 'merge', deduplication: true, grouping: true },
      },
    });

    const componentDefinition: ComponentDefinition = {
      common: { script: commonScript },
      framework: { script: frameworkScript },
    };

    return {
      strategy,
      engine,
      componentDefinition,
      async getMergedScript() {
        const processors = engine.getProcessors();
        const result = processors.scriptMergeProcessor.mergeScripts(
          commonScript,
          frameworkScript,
          strategy
        );
        return result;
      },
    };
  });

  return { strategies, examples };
}

/**
 * Example 4: Validation and Consistency Checking
 *
 * Shows comprehensive concept validation and framework consistency
 */
export function createValidationExample() {
  const complexTemplate = [
    {
      type: 'element',
      tag: 'div',
      attributes: {
        class: 'container responsive-grid',
        id: 'main-container',
      },
      expressionAttributes: {
        style: 'dynamicStyles',
        'aria-label': 'mainLabel',
      },
      children: [
        // Events with modifiers
        {
          type: 'element',
          tag: 'button',
          expressionAttributes: {
            '@click.prevent.stop': 'handleComplexClick',
            'on:keydown|preventDefault': 'handleKeyboard',
          },
          children: [{ type: 'text', content: 'Complex Button' }],
        },
        // Conditional rendering
        {
          type: 'if',
          condition: 'user.isLoggedIn && user.hasPermission',
          then: [
            {
              type: 'element',
              tag: 'div',
              attributes: { class: 'user-dashboard' },
              children: [
                // Iteration without key (React warning)
                {
                  type: 'for',
                  items: 'user.notifications',
                  item: 'notification',
                  children: [
                    {
                      type: 'element',
                      tag: 'div',
                      attributes: { class: 'notification' },
                      children: [
                        { type: 'text', content: 'notification.message' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        // Slots
        {
          type: 'slot',
          name: 'footer',
          fallback: [{ type: 'text', content: 'Default footer content' }],
        },
      ],
    },
  ];

  const engine = new TemplateEngine({
    enabled: true,
    validation: {
      enableFrameworkConsistency: true,
      enableCrossConceptValidation: true,
      checkAccessibility: true,
      checkPerformance: true,
      checkBestPractices: true,
    },
    extraction: {
      useEventExtractor: true,
      useStylingExtractor: true,
      validateCSS: true,
    },
  });

  return {
    template,
    engine,
    async validateForFramework(framework: 'vue' | 'react' | 'svelte') {
      const result = await engine.render(complexTemplate, {
        framework,
        extraction: {
          validateConcepts: true,
          normalizeEvents: true,
        },
      });

      return {
        framework,
        validation: result.validation,
        consistencyReport: result.consistencyReport,
        warnings: result.errors.getErrorsBySeverity('warning'),
        advancedMetadata: result.advancedMetadata,
      };
    },
    async validateAllFrameworks() {
      const frameworks: ('vue' | 'react' | 'svelte')[] = [
        'vue',
        'react',
        'svelte',
      ];
      const results = [];

      for (const framework of frameworks) {
        results.push(await this.validateForFramework(framework));
      }

      return results;
    },
  };
}

/**
 * Example 5: Import Processing and Deduplication
 *
 * Demonstrates advanced import merging and deduplication
 */
export function createImportProcessingExample() {
  const commonImports = [
    { from: 'dayjs', default: 'dayjs' },
    { from: 'lodash', named: ['merge', 'cloneDeep'] },
    { from: './utils', named: ['formatDate', 'parseDate'] },
    'import "./styles.css"',
  ];

  const reactImports = [
    { from: 'react', named: ['useState', 'useEffect', 'useCallback'] },
    { from: 'dayjs', named: ['extend'] }, // Duplicate source
    { from: 'lodash', named: ['debounce'] }, // Additional named import
    'import "react-datepicker/dist/react-datepicker.css"',
  ];

  const vueImports = [
    { from: 'vue', named: ['ref', 'computed', 'watch'] },
    { from: 'dayjs', named: ['extend'] }, // Duplicate source
    { from: '@vue/composition-api', named: ['defineComponent'] },
  ];

  const strategies: ImportMergeStrategy[] = [
    { mode: 'merge', deduplication: true, grouping: true },
    { mode: 'merge', deduplication: false, grouping: true },
    { mode: 'framework-first', deduplication: true, grouping: true },
    { mode: 'common-first', deduplication: true, grouping: true },
  ];

  const examples = strategies.map((strategy) => {
    const engine = new TemplateEngine({
      enabled: true,
      mergeStrategies: {
        imports: strategy,
        script: { mode: 'append' },
        props: { mode: 'merge', conflictResolution: 'warn' },
      },
    });

    return {
      strategy,
      engine,
      async processImports(framework: 'react' | 'vue') {
        const processors = engine.getProcessors();
        const frameworkImports =
          framework === 'react' ? reactImports : vueImports;

        return processors.importProcessor.mergeImports(
          commonImports,
          frameworkImports,
          { strategy, validateImports: true }
        );
      },
    };
  });

  return { commonImports, reactImports, vueImports, examples };
}

/**
 * Example 6: Complete Workflow
 *
 * End-to-end example showing all advanced processing features working together
 */
export function createCompleteWorkflowExample() {
  // Setup engine with all advanced processing features enabled
  const engine = new TemplateEngine({
    enabled: true,
    defaultFramework: 'react',
    mergeStrategies: {
      script: { mode: 'merge', includeComments: true },
      props: { mode: 'merge', conflictResolution: 'warn' },
      imports: { mode: 'merge', deduplication: true, grouping: true },
    },
    validation: {
      enableFrameworkConsistency: true,
      enableCrossConceptValidation: true,
      checkAccessibility: true,
      checkPerformance: true,
      checkBestPractices: true,
    },
    normalization: {
      normalizeEventNames: true,
      validateNormalizedEvents: true,
    },
    extraction: {
      useEventExtractor: true,
      useStylingExtractor: true,
      detectCSSFrameworks: true,
      extractCSSVariables: true,
      validateCSS: true,
    },
  });

  // Complex component definition
  const componentDefinition: ComponentDefinition = {
    common: {
      name: 'UserProfile',
      imports: [
        { from: 'dayjs', default: 'dayjs' },
        { from: './api', named: ['fetchUser', 'updateUser'] },
        { from: './utils', named: ['validateEmail', 'formatPhone'] },
      ],
      script: `// Common business logic
const formatLastSeen = (date) => {
  return dayjs(date).fromNow();
};

const validateUserData = (userData) => {
  return {
    email: validateEmail(userData.email),
    phone: formatPhone(userData.phone)
  };
};`,
      props: {
        userId: 'string',
        showLastSeen: 'boolean',
        theme: 'string',
      },
    },
    framework: {
      imports: [
        { from: 'react', named: ['useState', 'useEffect', 'useMemo'] },
        { from: 'react-query', named: ['useQuery', 'useMutation'] },
      ],
      script: `// React-specific state management
const [isEditing, setIsEditing] = useState(false);
const [userData, setUserData] = useState(null);

const { data: user, isLoading } = useQuery(
  ['user', userId],
  () => fetchUser(userId),
  { enabled: !!userId }
);

const updateMutation = useMutation(updateUser, {
  onSuccess: () => {
    setIsEditing(false);
    queryClient.invalidateQueries(['user', userId]);
  }
});

const formattedData = useMemo(() => {
  if (!user) return null;
  return validateUserData(user);
}, [user]);`,
      props: {
        onEdit: '() => void',
        onSave: '(data: UserData) => void',
        onCancel: '() => void',
      },
    },
  };

  // Complex template with all concept types
  const template = [
    {
      type: 'element',
      tag: 'div',
      attributes: {
        class: 'user-profile card shadow-lg',
        'data-testid': 'user-profile',
      },
      expressionAttributes: {
        style: 'themeStyles',
        'aria-label': 'userProfileLabel',
      },
      children: [
        // Loading state
        {
          type: 'if',
          condition: 'isLoading',
          then: [
            {
              type: 'element',
              tag: 'div',
              attributes: { class: 'loading-spinner' },
              children: [{ type: 'text', content: 'Loading...' }],
            },
          ],
        },
        // User data display
        {
          type: 'if',
          condition: 'user && !isLoading',
          then: [
            {
              type: 'element',
              tag: 'div',
              attributes: { class: 'user-profile__header' },
              children: [
                {
                  type: 'element',
                  tag: 'h2',
                  attributes: { class: 'user-profile__name' },
                  children: [{ type: 'text', content: 'user.name' }],
                },
                {
                  type: 'if',
                  condition: 'showLastSeen && user.lastSeen',
                  then: [
                    {
                      type: 'element',
                      tag: 'p',
                      attributes: { class: 'user-profile__last-seen' },
                      children: [
                        {
                          type: 'text',
                          content: 'formatLastSeen(user.lastSeen)',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            // Actions
            {
              type: 'element',
              tag: 'div',
              attributes: { class: 'user-profile__actions' },
              children: [
                {
                  type: 'element',
                  tag: 'button',
                  attributes: {
                    class: 'btn btn--primary',
                    type: 'button',
                  },
                  expressionAttributes: {
                    '@click': 'handleEdit',
                    disabled: 'updateMutation.isLoading',
                  },
                  children: [
                    { type: 'text', content: isEditing ? 'Save' : 'Edit' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  return {
    engine,
    componentDefinition,
    template,
    async runCompleteWorkflow() {
      console.log('🚀 Running Complete advanced processing Workflow');

      // Step 1: Process with enhanced pipeline
      console.log('Step 1: Processing...');
      const result = await engine.render(template, {
        framework: 'react',
        componentDefinition,
        component: { name: 'UserProfile' },
      });

      // Step 2: Check component properties
      console.log('Step 2: Component properties merged...');
      console.log('Properties:', result.componentProperties);

      // Step 3: Validation results
      console.log('Step 3: Validation results...');
      if (result.validation) {
        console.log('Validation score:', result.validation.score);
        console.log('Warnings:', result.validation.warnings.length);
        console.log('Suggestions:', result.validation.suggestions.length);
      }

      // Step 4: advanced processing metadata
      console.log('Step 4: advanced processing processing metadata...');
      console.log('Processors used:', result.advancedMetadata.processorsUsed);
      console.log('Events normalized:', result.advancedMetadata.eventsNormalized);
      console.log('Properties merged:', result.advancedMetadata.propertiesMerged);

      // Step 5: Framework consistency
      console.log('Step 5: Framework consistency check...');
      if (result.consistencyReport) {
        console.log('Overall score:', result.consistencyReport.overallScore);
        console.log(
          'Recommendations:',
          result.consistencyReport.recommendations.length
        );
      }

      return result;
    },

    async compareFrameworks() {
      const frameworks: ('vue' | 'react' | 'svelte')[] = [
        'vue',
        'react',
        'svelte',
      ];
      const results = [];

      for (const framework of frameworks) {
        console.log(`Processing for ${framework}...`);
        const result = await engine.render(template, {
          framework,
          componentDefinition,
          component: { name: 'UserProfile' },
        });

        results.push({
          framework,
          validationScore: result.validation?.score || 0,
          eventsNormalized: result.advancedMetadata.eventsNormalized,
          output: result.output,
        });
      }

      return results;
    },
  };
}

/**
 * Export all examples for easy access
 */
export const Phase2Examples = {
  dateComponent: createDateComponentExample,
  eventNormalization: createEventNormalizationExample,
  mergeStrategies: createMergeStrategyExample,
  validation: createValidationExample,
  importProcessing: createImportProcessingExample,
  completeWorkflow: createCompleteWorkflowExample,
};

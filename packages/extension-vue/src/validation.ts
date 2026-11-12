import {
  camelizePropName,
  latestValueName,
  routedElementOf,
} from '@js-template-engine/core/emitter';
import type {
  OverrideValidationContext,
  ReservedName,
  ReservedNameContext,
  Template,
  TemplateViolation,
} from '@js-template-engine/types';

/**
 * The names a Vue component declares itself in its `<script setup>`,
 * whatever the template: the BEM runtime import, the attribute, routing and
 * event helpers, the one-shot listener record and the attributes import.
 */
const COMPONENT_NAMES: readonly ReservedName[] = [
  { name: 'createBem', description: "Vue's and Svelte's BEM runtime import" },
  { name: 'definedProperties', description: "Vue's attribute helper" },
  { name: 'routedElement', description: "Vue's routed handle" },
  { name: 'vRoutedElement', description: "Vue's routed-handle directive" },
  { name: 'unlessDefaultPrevented', description: "Vue's event helper" },
  {
    name: 'usedOnceListeners',
    description: "Vue's one-shot listener record",
  },
  {
    name: 'claimOnceListener',
    description: "Vue's one-shot listener helper",
  },
  { name: 'useAttrs', description: "Vue's attributes import" },
  { name: 'mergeProps', description: "Vue's attribute merge import" },
];

/**
 * The names a Vue component imports or declares for its derived values,
 * declared ids and two-way props.
 */
const FEATURE_NAMES: readonly ReservedName[] = [
  {
    name: 'computed',
    description: "Vue's import for the derived values",
    when: 'derived',
  },
  {
    name: 'useId',
    description: "the import React's and Vue's ids use",
    when: 'ids',
  },
  {
    name: 'computed',
    description: "Vue's import for an id following a prop",
    when: 'ids',
  },
  {
    name: 'computed',
    description: "Vue's import for the two-way props",
    when: 'twoWay',
  },
  {
    name: 'shallowRef',
    description: "Vue's import for the two-way props",
    when: 'twoWay',
  },
];

/** The component's Vue override, when it sets one. */
function vueOverrideOf(
  template: Template
): Record<string, unknown> | undefined {
  const override = Array.isArray(template)
    ? undefined
    : template.extensions?.vue;
  return isRecord(override) ? override : undefined;
}

/** The `shallowRef` a Vue component with a routed handle imports. */
const ROUTED_HANDLE_NAME: ReservedName = {
  name: 'shallowRef',
  description: "Vue's import for the routed handle",
};

/** The `emit` a Vue component with two-way props declares. */
const EMIT_NAME: ReservedName = {
  name: 'emit',
  description: "Vue's emit function for the two-way props",
  when: 'twoWay',
  readable: false,
};

/**
 * Whether a script calls `defineEmits` (`defineEmits(` or `defineEmits<`),
 * read outside comments.
 *
 * @param script - The script, or anything else for none.
 * @returns `true` when it calls `defineEmits`.
 * @example
 * callsDefineEmits('const emit = defineEmits<{ close: [] }>();'); // true
 * callsDefineEmits('// no defineEmits() here'); // false
 */
export function callsDefineEmits(script: unknown): boolean {
  return (
    typeof script === 'string' &&
    /\bdefineEmits\s*[<(]/.test(
      script.replace(/\/\/[^\n]*|\/\*[^]*?\*\//g, ' ')
    )
  );
}

/** The scripts Vue compiles: the component `script` and `extensions.vue.script`. */
function vueScripts(
  template: Template
): Array<{ script: unknown; path: string }> {
  if (Array.isArray(template)) return [];
  return [
    { script: template.script, path: 'script' },
    { script: vueOverrideOf(template)?.script, path: 'extensions.vue.script' },
  ];
}

/**
 * The names a Vue component declares itself: those of every component,
 * those its derived values, declared ids and two-way props import or
 * declare, the `shallowRef` a routed handle imports, each copy-form
 * two-way prop's latest-value record (`latest<Prop>`), and `modelValue` when
 * `extensions.vue.model` binds a bare `v-model`. A script calling
 * `defineEmits` of its own is reported for that instead
 * ({@link validateVueOverrides}), so `emit` is left out beside it.
 *
 * @param context - The template and its two-way props.
 * @returns The reserved names.
 * @example
 * vueReservedNames({ template, twoWayProps: [] });
 * // [{ name: 'createBem', ... }, ..., { name: 'shallowRef', ..., when: 'twoWay' }]
 */
export function vueReservedNames(context: ReservedNameContext): ReservedName[] {
  const names = [...COMPONENT_NAMES, ...FEATURE_NAMES];
  if (
    !Array.isArray(context.template) &&
    routedElementOf(context.template.children ?? [])?.handlesRef === true
  ) {
    names.push(ROUTED_HANDLE_NAME);
  }
  if (
    !vueScripts(context.template).some(({ script }) => callsDefineEmits(script))
  ) {
    names.push(EMIT_NAME);
  }
  for (const { name, local, relayed } of context.twoWayProps) {
    if (relayed === true) continue;
    names.push({
      name: latestValueName(local),
      description: `Vue's record of the latest '${name}'`,
      when: 'twoWay',
      readable: false,
      path: `props.${name}`,
    });
  }
  const model = vueOverrideOf(context.template)?.model;
  if (typeof model === 'string') {
    names.push({
      name: 'modelValue',
      description: `the prop Vue's bare v-model binds, standing in for '${model}'`,
      when: 'twoWay',
      path: 'extensions.vue.model',
    });
  }
  return names;
}

/**
 * Validates what only the Vue target reads: `extensions.vue.model` names one
 * two-way prop, as a string; no two props camelize to one key, since Vue
 * declares and sets a hyphenated prop under its camelized key; and a script
 * Vue compiles (the component `script` or `extensions.vue.script`) calls no
 * `defineEmits` of its own beside two-way props, which generate the
 * component's one `defineEmits`.
 *
 * @param template - The template being validated.
 * @param context - The component's well-formed two-way props.
 * @returns The violations, each with its path.
 * @example
 * validateVueOverrides(template, { twoWayProps: ['pressed'] });
 * // [] when extensions.vue.model is 'pressed'
 */
export function validateVueOverrides(
  template: Template,
  context: OverrideValidationContext
): TemplateViolation[] {
  const violations: TemplateViolation[] = [];
  const override = vueOverrideOf(template);
  const model = override?.model;
  if (model !== undefined) {
    if (typeof model !== 'string') {
      violations.push({
        message: `extensions.vue.model names the one two-way prop a bare v-model binds, as a string; got ${describeValue(model)}`,
        nodePath: 'extensions.vue.model',
      });
    } else if (!context.twoWayProps.includes(model)) {
      violations.push({
        message: `extensions.vue.model names '${model}', which is not a prop declared with a bindable object`,
        nodePath: 'extensions.vue.model',
      });
    }
  }
  violations.push(...camelizedPropClashes(template));
  if (context.twoWayProps.length > 0) {
    for (const { script, path } of vueScripts(template)) {
      if (callsDefineEmits(script)) {
        violations.push({
          message:
            'The script calls defineEmits, but a component with two-way props generates its emits itself, and Vue takes one defineEmits; report other changes through on* function props',
          nodePath: path,
        });
      }
    }
  }
  return violations;
}

/**
 * Two props whose names Vue camelizes to one key (`aria-pressed` and
 * `ariaPressed`), which would be one prop there: the shared props, the Vue
 * override's and each root discriminated branch's.
 */
function camelizedPropClashes(template: Template): TemplateViolation[] {
  const props: Array<{ name: string; path: string }> = [];
  const rootChildren = Array.isArray(template) ? template : template.children;
  const rootPath = Array.isArray(template) ? '' : 'children';
  if (!Array.isArray(template)) {
    for (const name of Object.keys(template.props ?? {})) {
      props.push({ name, path: `props.${name}` });
    }
    const overrideProps = vueOverrideOf(template)?.props;
    if (isRecord(overrideProps)) {
      for (const name of Object.keys(overrideProps)) {
        props.push({ name, path: `extensions.vue.props.${name}` });
      }
    }
  }
  (rootChildren ?? []).forEach((node, index) => {
    if (node?.type !== 'conditional') return;
    node.conditions.forEach((branch, branchIndex) => {
      for (const name of Object.keys(branch.props ?? {})) {
        props.push({
          name,
          path: `${rootPath}[${index}].conditions[${branchIndex}].props.${name}`,
        });
      }
    });
  });
  const violations: TemplateViolation[] = [];
  const keys = new Map<string, string>();
  for (const { name, path } of props) {
    const key = camelizePropName(name);
    const first = keys.get(key);
    if (first !== undefined && first !== name) {
      violations.push({
        message: `The props '${first}' and '${name}' are both declared as '${key}' in Vue, which camelizes a prop's name; rename one`,
        nodePath: path,
      });
      continue;
    }
    keys.set(key, name);
  }
  return violations;
}

/** Describes a value's kind for an error message: `null`, `an array`, ... */
function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'string' && value.trim() === '') {
    return 'an empty string';
  }
  if (typeof value === 'string') return `the string '${value}'`;
  return typeof value === 'object'
    ? 'an object'
    : `${typeof value} ${String(value)}`;
}

/** Whether a value is a plain record: an object, not null or an array. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

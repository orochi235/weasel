import type { PrefGroup, PrefLeaf } from '@weasel-js/ui';
import type { ConfigField } from '../controls/types';
import type { LeafPatch, ResolvedConfig } from './types';

/** One `ConfigField` as the `Pref*` vocabulary spells it. The two describe the
 *  same thing; `ConfigField` just keys on the control where `PrefLeaf`
 *  separates the value's kind from how it is presented. */
function toLeaf(field: ConfigField): LeafPatch {
  const base = { name: field.label, description: '' };
  switch (field.type) {
    case 'slider':
      return {
        ...base,
        kind: 'number',
        control: 'slider',
        min: field.min,
        max: field.max,
        step: field.step,
      };
    case 'number':
      return {
        ...base,
        kind: 'number',
        control: 'input',
        min: field.min,
        max: field.max,
        step: field.step,
      };
    case 'checkbox':
      return { ...base, kind: 'boolean', control: 'checkbox' };
    case 'select':
      return { ...base, kind: 'enum', options: field.options };
    case 'text':
      return {
        ...base,
        kind: 'string',
        placeholder: field.placeholder,
        maxLength: field.maxLength,
        debounceMs: field.debounceMs,
      };
    case 'color':
      return { ...base, kind: 'color' };
    default:
      // A schema can arrive from outside TypeScript. Carry the kind through
      // so a lab-supplied renderer can still claim it.
      return { ...base, kind: (field as ConfigField).type };
  }
}

/**
 * Adapt a legacy `configSchema(): ConfigField[]` into the resolved shape, so
 * both instrument paths reach one renderer.
 *
 * Rules do not run here: a hand-written `ConfigField` already states its label
 * and control, which is everything the rule chain would have inferred.
 *
 * A dotted `key` is a config path, as it is to every read and write, so its
 * leaf is filed under headless groups at that path rather than as one child
 * whose name contains dots — which no path lookup would find.
 */
export function fromConfigFields(fields: readonly ConfigField[]): ResolvedConfig {
  const root: PrefGroup = { name: '', children: {} };
  for (const field of fields) {
    const patch = toLeaf(field);
    for (const key of Object.keys(patch)) {
      if ((patch as Record<string, unknown>)[key] === undefined) {
        delete (patch as Record<string, unknown>)[key];
      }
    }
    const segments = field.key.split('.');
    const leafKey = segments.pop() as string;
    let group = root;
    for (const segment of segments) {
      const existing = group.children[segment];
      if (existing === undefined || !('children' in existing) || 'kind' in existing) {
        group.children[segment] = { name: '', children: {} };
      }
      group = group.children[segment] as PrefGroup;
    }
    group.children[leafKey] = { ...patch, default: field.default } as PrefLeaf;
  }
  return {
    group: root,
    sections: [],
    showIf: new Map(),
    renderers: {},
    dialogs: {},
  };
}

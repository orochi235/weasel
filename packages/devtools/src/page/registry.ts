/** What one canvas has registered — its tools, actions, deps and node kinds — as plain data for `get-registry`. */
import {
  actionBindings, buildDepsFromRequires, evaluateActive, evaluateEnabled, overriddenBindings, routesForSpec,
  type Action, type ActionSource, type Contribution, type DepRegistry, type GestureBinding, type ResolvedBindingOverrides,
  type ToolShortcuts,
} from '@weasel-js/routing';
import { formatShortcut } from '@weasel-js/gestures';
import type {
  DevtoolsActionEntry, DevtoolsBinding, DevtoolsRegistry, DevtoolsToolEntry,
} from './protocol';
import { serialize } from './serialize';
import { iconSpecRefs, type IconSpec } from '@weasel-js/icons';

/** A spec as the text the panel shows: its refs, subject first. */
const iconText = (spec: IconSpec | undefined): string | null => iconSpecRefs(spec).join(' + ') || null;

type Entry = Contribution<unknown> & { cursor?: unknown };

/** The live registries {@link describeRegistry} reads. */
export interface RegistryInputs {
  /** `shortcuts` is the keys that activate each tool now (`ToolsApi.shortcuts`). */
  tools: { registry: Readonly<Record<string, Entry>>; ambient: readonly Entry[]; shortcuts: ToolShortcuts };
  /** The entries a `features` preset brought beside the tools. */
  contributions: readonly Entry[];
  actions: ActionSource | null;
  /** Binding overrides in force, applied to the entries' bindings; `actions`
   *  lists its own already overridden. */
  overrides?: ResolvedBindingOverrides;
  deps: DepRegistry | null;
  routingKinds: readonly string[];
}

function routesOf(binding: GestureBinding): string[] {
  try {
    return [...routesForSpec(binding.spec)];
  } catch {
    return [];
  }
}

function bindingOf(binding: GestureBinding): DevtoolsBinding {
  return {
    actionId: binding.actionId,
    spec: serialize(binding.spec),
    routes: routesOf(binding),
    opts: serialize(binding.opts),
  };
}

function toolOf(
  entry: Entry, slot: DevtoolsToolEntry['slot'], overrides: ResolvedBindingOverrides | undefined, shortcuts: ToolShortcuts,
): DevtoolsToolEntry {
  const p = entry.presentation;
  return {
    id: entry.id,
    slot,
    label: p?.label ?? entry.id,
    icon: iconText(p?.icon),
    group: p?.group ?? null,
    shortcut: formatShortcut(shortcuts[entry.id]?.[0]) ?? null,
    hotkey: entry.eligibility?.offhand ?? null,
    hidden: p?.hide === true,
    cursor: serialize(entry.cursor),
    eligibility: serialize(entry.eligibility),
    bindings: overriddenBindings(entry.bindings ?? [], entry.id, overrides).map(bindingOf),
    actions: (entry.actions ?? []).map((a) => a.id),
    deps: Object.keys(entry.deps ?? {}),
    hasOverlay: entry.overlay !== undefined,
  };
}

function actionOf(action: Action, deps: DepRegistry | null): DevtoolsActionEntry {
  const bag = deps ? buildDepsFromRequires(action, deps) : undefined;
  const enabled = evaluateEnabled(action, bag);
  const rule: unknown = action.eligible;
  return {
    id: action.id,
    label: action.label ?? action.id,
    icon: iconText(action.icon),
    group: action.group ?? null,
    tags: [...(action.tags ?? [])],
    shortcut: action.shortcut ?? null,
    scope: action.scope === 'hotkey' ? 'hotkey' : 'ambient',
    invoker: action.invoker?.timing ?? null,
    requires: [...(action.requires ?? [])],
    variants: (action.variants ?? []).map((v) => ({
      key: v.key, label: v.label, icon: iconText(v.icon), params: serialize(v.params),
    })),
    enabled: enabled.enabled ? true : (enabled.reason ?? 'disabled'),
    active: evaluateActive(action, bag) ?? null,
    hasPreview: action.preview !== undefined,
    // A fluent condition is callable and carries its rule tree on `.rule`.
    eligible: serialize(typeof rule === 'function' ? (rule as { rule?: unknown }).rule : (rule ?? null)),
    bindings: actionBindings(action).map(bindingOf),
  };
}

export function describeRegistry(inputs: RegistryInputs): DevtoolsRegistry {
  const seen = new Set<string>();
  const tools: DevtoolsToolEntry[] = [];
  const add = (entries: readonly Entry[], slot: DevtoolsToolEntry['slot']): void => {
    for (const e of entries) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      tools.push(toolOf(e, slot, inputs.overrides, inputs.tools.shortcuts));
    }
  };
  add(Object.values(inputs.tools.registry), 'tool');
  add(inputs.tools.ambient, 'ambient');
  add(inputs.contributions, 'contribution');
  return {
    tools,
    actions: (inputs.actions?.list() ?? []).map((a) => actionOf(a, inputs.deps)),
    deps: (inputs.deps?.list?.() ?? []).map((d) => ({ ...d })),
    routingKinds: [...inputs.routingKinds],
  };
}

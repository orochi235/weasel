# labkit config schema — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An instrument declares its config once, as a typed builder, and labkit generates the control panel from it — with seams for custom controls, per-field overrides, lab-wide derivation rules and conditional visibility.

**Architecture:** A new `packages/labkit/src/config/` module holds the builder, the rule chain and the resolve pass. Resolution emits `@weasel-js/ui`'s `PrefGroup` — the vocabulary `PrefsForm` and (via core's structurally-identical `ToolPrefLeaf`) `SelectionPanel` already render — so labkit stops being a third dialect. `ControlPanel` becomes a second renderer over that vocabulary, keeping its dense `lk-` property rows. The legacy `ConfigField[]` path is adapted up into the same shape so there is one renderer and one code path.

**Tech Stack:** TypeScript 6, React 19, vitest (`--project=labkit`), `@weasel-js/ui` `Pref*` schema types.

**Spec:** `docs/superpowers/specs/2026-08-26-labkit-config-schema-design.md`

---

## File Structure

**Create — `packages/labkit/src/config/`**

| File | Responsibility |
|---|---|
| `types.ts` | `ConfigNode` hierarchy, `ConfigSchema`, `ConfigRule`, `LeafPatch`, `ControlRenderer`, `ResolvedConfig`, `SectionSpec`, `InferConfig`/`ConfigOf` |
| `builder.ts` | The `f` namespace and the node classes behind it |
| `rules.ts` | `applyRules`, the four built-in rules, `titleCase` |
| `resolve.ts` | `resolveConfigSchema(schema, rules)` → `ResolvedConfig` |
| `fromConfigField.ts` | Legacy `ConfigField[]` → `ResolvedConfig` adapter |
| `visible.ts` | `isLeafVisible(resolved, path, config)` — `showIf` + `hidden` |
| `useConfigSchema.ts` | The render-time hook reading lab rules |
| `index.ts` | Module barrel |

**Modify**

| File | Change |
|---|---|
| `src/controls/ControlPanel.tsx` | Take `schema` + `renderers`; render `PrefLeaf` kinds; sections via `PropertyGroup` |
| `src/instrument/types.ts` | `Instrument.config?: ConfigSchema<TC>`; add `InstrumentSpec` |
| `src/instrument/defineInstrument.ts` | Synthesize `defaultConfig` from `config` |
| `src/instrument/validateConfigSchema.ts` | Unknown kind is valid, not an error |
| `src/chrome/types.ts` | `TrialChromeContext.configSchema: ResolvedConfig`; deprecate `configFields` |
| `src/chrome/builtins.tsx` | Settings sidebar reads `configSchema` |
| `src/trial/TrialChrome.tsx` | Populate `configSchema` via `useConfigSchema` |
| `src/lab/Lab.tsx`, `src/lab/LabContext.ts` | `configRules` + `controls` props into context |
| `src/passthrough/weasel-ui.ts` | Re-export the `Pref*` types |
| `src/index.ts` | Export the config module |
| `examples/weasel-lab/SceneInstrument.tsx` | Migrate to the builder |

Test command throughout: `npx vitest run --project=labkit` from the repo root.
Typecheck: `npx tsc --noEmit` from the repo root.

---

### Task 1: Types and the builder

**Files:**
- Create: `packages/labkit/src/config/types.ts`
- Create: `packages/labkit/src/config/builder.ts`
- Test: `packages/labkit/src/config/builder.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { f } from './builder';

describe('builder', () => {
  it('carries kind and default', () => {
    const n = f.number(20);
    expect(n.kind).toBe('number');
    expect(n.default).toBe(20);
  });

  it('chains annotations immutably', () => {
    const base = f.number(20);
    const a = base.label('A');
    const b = base.label('B');
    expect(a.annotations.name).toBe('A');
    expect(b.annotations.name).toBe('B');
    expect(base.annotations.name).toBeUndefined();
  });

  it('range and step land on the annotation bag', () => {
    const n = f.number(20).range(5, 80).step(5);
    expect(n.annotations).toMatchObject({ min: 5, max: 80, step: 5 });
  });

  it('expands a bare enum option list', () => {
    const n = f.enum('fast', ['fast', 'accurate']);
    expect(n.annotations.options).toEqual([
      { value: 'fast', label: 'fast' },
      { value: 'accurate', label: 'accurate' },
    ]);
  });

  it('f.value carries no kind', () => {
    expect(f.value(3).kind).toBeNull();
  });

  it('schema.defaults() collects every default', () => {
    const s = f.schema({ showGrid: f.boolean(true), cellSize: f.number(20) });
    expect(s.defaults()).toEqual({ showGrid: true, cellSize: 20 });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=labkit config/builder`
Expected: FAIL — cannot resolve `./builder`.

- [ ] **Step 3: Write `types.ts`**

Key shapes (full file written during implementation):

```ts
export interface Annotations {
  name?: string; description?: string; hidden?: boolean; block?: boolean;
  pair?: string; min?: number; max?: number; step?: number; control?: string;
  options?: readonly { value: string; label: string }[];
  alpha?: boolean; debounceMs?: number; placeholder?: string; maxLength?: number;
}

/** A patch a rule contributes. `kind` is settable only while it is unset. */
export type LeafPatch = Annotations & { kind?: string };

export type ControlRenderer = PrefRenderer;   // identical contract; alias, don't clone

export interface SectionSpec { label: string; paths: readonly string[] }

export interface ResolvedConfig {
  group: PrefGroup;
  sections: readonly SectionSpec[];
  showIf: ReadonlyMap<string, (config: Record<string, unknown>) => boolean>;
  renderers: Readonly<Record<string, ControlRenderer>>;
}

export type ConfigOf<S> = S extends ConfigSchema<infer TC> ? TC : never;
```

- [ ] **Step 4: Write `builder.ts`**

An abstract `BaseNode<T>` holding `default`, `annotations` and `opts`
(`section` / `showIf` / `render` / `validate`), with a protected `with()` that
clones into the same subclass so chaining stays immutable. Subclasses
`NumberNode`, `BooleanNode`, `StringNode`, `EnumNode<T>`, `ColorNode`,
`ValueNode<T>`, `CustomNode<T>` add their kind and kind-specific methods
(`range`, `step`, `slider` on number; `options` on enum; `placeholder`,
`maxLength`, `debounce` on string). `f.enum` uses a `const` type parameter so
`f.enum('fast', ['fast','accurate'])` infers `'fast' | 'accurate'`.

`f.schema(shape)` returns `{ nodes, defaults() }` typed `ConfigSchema<InferConfig<S>>`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run --project=labkit config/builder`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/labkit/src/config/types.ts packages/labkit/src/config/builder.ts packages/labkit/src/config/builder.test.ts
git commit -m "add the labkit config builder"
```

---

### Task 2: Rules and the resolve pass

**Files:**
- Create: `packages/labkit/src/config/rules.ts`, `packages/labkit/src/config/resolve.ts`
- Test: `packages/labkit/src/config/resolve.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';
import type { ConfigRule } from './types';

const leafAt = (r: ReturnType<typeof resolveConfigSchema>, k: string) =>
  r.group.children[k] as Record<string, unknown>;

describe('resolveConfigSchema', () => {
  it('titleCases a missing label', () => {
    const r = resolveConfigSchema(f.schema({ cellSize: f.number(20) }), []);
    expect(leafAt(r, 'cellSize').name).toBe('Cell size');
  });

  it('an explicit label beats the built-in rule', () => {
    const r = resolveConfigSchema(f.schema({ cellSize: f.number(20).label('Grid spacing') }), []);
    expect(leafAt(r, 'cellSize').name).toBe('Grid spacing');
  });

  it('picks a slider when a number has both bounds', () => {
    const r = resolveConfigSchema(f.schema({ a: f.number(1).range(0, 10), b: f.number(1) }), []);
    expect(leafAt(r, 'a').control).toBe('slider');
    expect(leafAt(r, 'b').control).toBeUndefined();
  });

  it('infers kind from typeof for an f.value leaf', () => {
    const r = resolveConfigSchema(f.schema({ on: f.value(true), n: f.value(2), s: f.value('x') }), []);
    expect(leafAt(r, 'on').kind).toBe('boolean');
    expect(leafAt(r, 'n').kind).toBe('number');
    expect(leafAt(r, 's').kind).toBe('string');
  });

  it('a consumer rule claims an f.value kind before the built-in', () => {
    const colorByName: ConfigRule = (ctx) =>
      ctx.key.endsWith('Color') ? { kind: 'color' } : null;
    const r = resolveConfigSchema(f.schema({ tintColor: f.value('#fff') }), [colorByName]);
    expect(leafAt(r, 'tintColor').kind).toBe('color');
  });

  it('a consumer rule cannot overwrite an explicit annotation', () => {
    const forceLabel: ConfigRule = () => ({ name: 'Forced' });
    const r = resolveConfigSchema(f.schema({ a: f.number(1).label('Mine') }), [forceLabel]);
    expect(leafAt(r, 'a').name).toBe('Mine');
  });

  it('collects sections, showIf and node renderers', () => {
    const r = resolveConfigSchema(
      f.schema({
        showGrid: f.boolean(true),
        seed: f.value(0).section('Advanced').showIf((c) => c.showGrid === true),
        custom: f.number(1).render(() => null),
      }),
      [],
    );
    expect(r.sections).toEqual([{ label: 'Advanced', paths: ['seed'] }]);
    expect(r.showIf.has('seed')).toBe(true);
    expect(r.renderers.custom).toBeTypeOf('function');
  });

  it('every leaf gets a description, since PrefBase requires one', () => {
    const r = resolveConfigSchema(f.schema({ a: f.number(1) }), []);
    expect(leafAt(r, 'a').description).toBe('');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=labkit config/resolve`
Expected: FAIL — cannot resolve `./resolve`.

- [ ] **Step 3: Write `rules.ts`**

`titleCase('cellSize') === 'Cell size'` (split camelCase, capitalize first word only).
`applyRules(ctx, rules)` folds patches with **gap-fill merge**: a key already
present on the accumulator is never overwritten. Built-in rules, in order,
appended after the consumer's:

1. `kindFromValue` — `kind ??= typeof default` mapped to `boolean|number|string`
2. `labelFromKey` — `name ??= titleCase(key)`
3. `sliderWhenBounded` — `control ??= 'slider'` when `kind === 'number'` and both bounds are set
4. `descriptionDefault` — `description ??= ''`

- [ ] **Step 4: Write `resolve.ts`**

Walk `schema.nodes` in declaration order. Seed the accumulator with the node's
kind and defined annotations, run the rule chain, assemble the `PrefLeaf`, and
collect `section` / `showIf` / `render` into the sibling maps. Sections keep
first-appearance order.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run --project=labkit config/resolve`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/labkit/src/config/rules.ts packages/labkit/src/config/resolve.ts packages/labkit/src/config/resolve.test.ts
git commit -m "resolve a config schema through a gap-filling rule chain"
```

---

### Task 3: The legacy adapter and the visibility pass

**Files:**
- Create: `packages/labkit/src/config/fromConfigField.ts`, `packages/labkit/src/config/visible.ts`, `packages/labkit/src/config/index.ts`
- Test: `packages/labkit/src/config/fromConfigField.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import type { ConfigField } from '../controls/types';
import { fromConfigFields } from './fromConfigField';

const leaf = (fields: ConfigField[], k: string) =>
  fromConfigFields(fields).group.children[k] as Record<string, unknown>;

describe('fromConfigFields', () => {
  it('maps every ConfigField type to its PrefLeaf kind', () => {
    expect(leaf([{ type: 'slider', key: 'a', label: 'A', default: 1, min: 0, max: 2 }], 'a'))
      .toMatchObject({ kind: 'number', control: 'slider', min: 0, max: 2, default: 1, name: 'A' });
    expect(leaf([{ type: 'number', key: 'b', label: 'B', default: 1 }], 'b'))
      .toMatchObject({ kind: 'number', control: 'input' });
    expect(leaf([{ type: 'checkbox', key: 'c', label: 'C', default: true }], 'c'))
      .toMatchObject({ kind: 'boolean', control: 'checkbox' });
    expect(leaf([{ type: 'select', key: 'd', label: 'D', default: 'x', options: [{ value: 'x', label: 'X' }] }], 'd'))
      .toMatchObject({ kind: 'enum', options: [{ value: 'x', label: 'X' }] });
    expect(leaf([{ type: 'text', key: 'e', label: 'E', default: '' }], 'e'))
      .toMatchObject({ kind: 'string' });
    expect(leaf([{ type: 'color', key: 'g', label: 'G', default: '#fff' }], 'g'))
      .toMatchObject({ kind: 'color' });
  });

  it('carries the text debounce through as a labkit extra', () => {
    expect(leaf([{ type: 'text', key: 'e', label: 'E', default: '', debounceMs: 0 }], 'e').debounceMs).toBe(0);
  });

  it('preserves declaration order', () => {
    const r = fromConfigFields([
      { type: 'checkbox', key: 'z', label: 'Z', default: true },
      { type: 'checkbox', key: 'a', label: 'A', default: true },
    ]);
    expect(Object.keys(r.group.children)).toEqual(['z', 'a']);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=labkit config/fromConfigField`
Expected: FAIL — cannot resolve `./fromConfigField`.

- [ ] **Step 3: Write `fromConfigField.ts`**

One `switch` over the six types, per the spec's mapping table. Returns a
`ResolvedConfig` with empty `sections` / `showIf` / `renderers`.

- [ ] **Step 4: Write `visible.ts` and `index.ts`**

```ts
export function isLeafVisible(
  resolved: ResolvedConfig,
  path: string,
  config: Record<string, unknown>,
  showHidden = false,
): boolean {
  const leaf = resolved.group.children[path];
  if (leaf && 'hidden' in leaf && leaf.hidden && !showHidden) return false;
  const pred = resolved.showIf.get(path);
  return pred ? pred(config) : true;
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run --project=labkit config/`
Expected: PASS, all three config test files.

- [ ] **Step 6: Commit**

```bash
git add packages/labkit/src/config/
git commit -m "adapt legacy ConfigField lists into the resolved schema"
```

---

### Task 4: `ControlPanel` renders the schema

**Files:**
- Modify: `packages/labkit/src/controls/ControlPanel.tsx`
- Test: `packages/labkit/src/controls/ControlPanel.test.tsx`

- [ ] **Step 1: Write the failing tests** (added to the existing file, which must keep passing)

```ts
it('renders a schema through the built-in rows', () => {
  const resolved = resolveConfigSchema(f.schema({ showGrid: f.boolean(true) }), []);
  render(<ControlPanel schema={resolved} config={{ showGrid: true }} setConfig={vi.fn()} />);
  expect(screen.getByLabelText('Show grid')).toBeInTheDocument();
});

it('renderers[path] beats renderers[kind]', () => {
  const resolved = resolveConfigSchema(f.schema({ tint: f.color('#fff') }), []);
  render(
    <ControlPanel
      schema={resolved}
      config={{ tint: '#fff' }}
      setConfig={vi.fn()}
      renderers={{ color: () => <span>by-kind</span>, tint: () => <span>by-path</span> }}
    />,
  );
  expect(screen.getByText('by-path')).toBeInTheDocument();
  expect(screen.queryByText('by-kind')).not.toBeInTheDocument();
});

it('a renderer returning null collapses the row', () => {
  const resolved = resolveConfigSchema(f.schema({ tint: f.color('#fff') }), []);
  render(<ControlPanel schema={resolved} config={{ tint: '#fff' }} setConfig={vi.fn()} renderers={{ color: () => null }} />);
  expect(screen.queryByText('Tint')).not.toBeInTheDocument();
});

it('an unregistered kind renders a placeholder, not a blank panel', () => {
  const resolved = resolveConfigSchema(f.schema({ a: f.custom('vector2', { x: 0 }), b: f.boolean(true) }), []);
  render(<ControlPanel schema={resolved} config={{ a: { x: 0 }, b: true }} setConfig={vi.fn()} />);
  expect(screen.getByText(/vector2/)).toBeInTheDocument();
  expect(screen.getByLabelText('B')).toBeInTheDocument();
});

it('hides a row whose showIf is false', () => {
  const resolved = resolveConfigSchema(
    f.schema({ showGrid: f.boolean(true), cellSize: f.number(20).showIf((c) => c.showGrid === true) }),
    [],
  );
  const { rerender } = render(<ControlPanel schema={resolved} config={{ showGrid: true, cellSize: 20 }} setConfig={vi.fn()} />);
  expect(screen.getByLabelText('Cell size')).toBeInTheDocument();
  rerender(<ControlPanel schema={resolved} config={{ showGrid: false, cellSize: 20 }} setConfig={vi.fn()} />);
  expect(screen.queryByLabelText('Cell size')).not.toBeInTheDocument();
});

it('groups sectioned leaves under a PropertyGroup', () => {
  const resolved = resolveConfigSchema(f.schema({ seed: f.number(0).section('Advanced') }), []);
  render(<ControlPanel schema={resolved} config={{ seed: 0 }} setConfig={vi.fn()} />);
  expect(screen.getByText('Advanced')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and watch the new tests fail**

Run: `npx vitest run --project=labkit ControlPanel`
Expected: the six new tests FAIL; the existing `fields`-prop tests still PASS.

- [ ] **Step 3: Rewrite `ControlPanel.tsx`**

`ControlPanelProps` gains `schema?: ResolvedConfig` and
`renderers?: Record<string, ControlRenderer>`; `fields` becomes optional and
deprecated. Internally `const resolved = schema ?? fromConfigFields(fields ?? [])`,
so there is one render path. Rows dispatch on `PrefLeaf` kind
(`number` + `control === 'slider'` → `SliderRow`, else `NumberRow` with the
existing clamp; `boolean` → `CheckboxRow`; `enum` → `SelectRow`;
`string` → the existing debounced row, reading `debounceMs` off the leaf;
`color` → `ColorRow`), with the unknown-kind placeholder as the fallback.
Renderer precedence: `renderers[path] → resolved.renderers[path] → renderers[kind] → built-in`.
Ungrouped leaves render first in declaration order, then each section through
`PropertyGroup`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=labkit ControlPanel`
Expected: PASS — new and pre-existing.

- [ ] **Step 5: Commit**

```bash
git add packages/labkit/src/controls/ControlPanel.tsx packages/labkit/src/controls/ControlPanel.test.tsx
git commit -m "render the resolved config schema from ControlPanel"
```

---

### Task 5: Instrument wiring

**Files:**
- Modify: `packages/labkit/src/instrument/types.ts`, `packages/labkit/src/instrument/defineInstrument.ts`, `packages/labkit/src/instrument/validateConfigSchema.ts`
- Test: `packages/labkit/src/instrument/defineInstrument.test.ts`, `packages/labkit/src/instrument/validateConfigSchema.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('synthesizes defaultConfig from a builder schema', () => {
  const inst = defineInstrument({
    name: 'X',
    config: f.schema({ showGrid: f.boolean(true), cellSize: f.number(20) }),
    initialState: () => ({}),
    render: () => null,
  });
  expect(inst.defaultConfig()).toEqual({ showGrid: true, cellSize: 20 });
});

it('leaves an explicit defaultConfig alone', () => {
  const inst = defineInstrument({
    name: 'X',
    defaultConfig: () => ({ a: 1 }),
    initialState: () => ({}),
    render: () => null,
  });
  expect(inst.defaultConfig()).toEqual({ a: 1 });
});
```

and, in `validateConfigSchema.test.ts`:

```ts
it('treats an unknown kind as valid — a lab may supply its renderer', () => {
  const r = validateConfigSchema([{ type: 'vector2', key: 'a', label: 'A' } as unknown as ConfigField]);
  expect(r.valid).toBe(true);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run --project=labkit instrument/`
Expected: the three new tests FAIL.

- [ ] **Step 3: Implement**

`Instrument` gains `config?: ConfigSchema<TC>`. `InstrumentSpec` is the input
union making `defaultConfig` optional when `config` is present.
`defineInstrument` stops being identity: when `config` is present and
`defaultConfig` is not, it returns `{ ...spec, defaultConfig: () => spec.config.defaults() }`.
`validateConfigSchema` drops the `KNOWN_TYPES` rejection — an unrecognized type
skips its type-specific checks and is not an error; key/label checks still run.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=labkit instrument/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/labkit/src/instrument/
git commit -m "accept a config schema on an instrument"
```

---

### Task 6: Lab props, context and `TrialChrome`

**Files:**
- Create: `packages/labkit/src/config/useConfigSchema.ts`
- Modify: `packages/labkit/src/lab/LabContext.ts`, `packages/labkit/src/lab/Lab.tsx`, `packages/labkit/src/chrome/types.ts`, `packages/labkit/src/trial/TrialChrome.tsx`, `packages/labkit/src/chrome/builtins.tsx`
- Test: `packages/labkit/src/trial/Trial.config.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it('renders an instrument config schema into the settings sidebar', () => {
  const inst = defineInstrument({
    name: 'Schema',
    config: f.schema({ showGrid: f.boolean(true) }),
    initialState: () => ({}),
    render: () => null,
  });
  render(<Lab instruments={[inst]} defaultInstrument="Schema" />);
  expect(screen.getByLabelText('Show grid')).toBeInTheDocument();
});

it('applies a lab-wide config rule', () => {
  const inst = defineInstrument({
    name: 'Schema',
    config: f.schema({ tintColor: f.value('#ffffff') }),
    initialState: () => ({}),
    render: () => null,
  });
  const colorByName: ConfigRule = (ctx) => (ctx.key.endsWith('Color') ? { kind: 'color' } : null);
  render(<Lab instruments={[inst]} defaultInstrument="Schema" configRules={[colorByName]} />);
  expect(screen.getByLabelText('Tint color')).toHaveAttribute('type', 'color');
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run --project=labkit Trial.config`
Expected: FAIL.

- [ ] **Step 3: Implement**

`LabProps` and `LabContextValue` gain `configRules?: readonly ConfigRule[]` and
`controls?: Record<string, ControlRenderer>`, beside the existing `chrome` /
`suppress` / `tools`. `useConfigSchema(instrument)` reads `configRules` from lab
context and memoizes `resolveConfigSchema(instrument.config, rules)`, falling
back to `fromConfigFields(instrument.configSchema?.() ?? [])`.
`TrialChromeContext` gains `configSchema: ResolvedConfig` (always populated) and
keeps `configFields` marked deprecated. `builtins.tsx` gates the Settings
section on `Object.keys(ctx.configSchema.group.children).length > 0` and passes
`schema` + the lab's `controls` to `ControlPanel`.

- [ ] **Step 4: Run the whole labkit suite**

Run: `npx vitest run --project=labkit`
Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add packages/labkit/src/lab/ packages/labkit/src/chrome/ packages/labkit/src/trial/ packages/labkit/src/config/useConfigSchema.ts
git commit -m "resolve an instrument's config schema against lab-wide rules"
```

---

### Task 7: Public surface

**Files:**
- Modify: `packages/labkit/src/passthrough/weasel-ui.ts`, `packages/labkit/src/index.ts`

- [ ] **Step 1: Add the `Pref*` re-exports**

`PrefBoolean`, `PrefBooleanControl`, `PrefColor`, `PrefCustom`, `PrefEnum`,
`PrefEnumControl`, `PrefGroup`, `PrefLeaf`, `PrefNumber`, `PrefNumberControl`,
`PrefNumberUnit`, `PrefRenderContext`, `PrefRenderer`, `PrefString`,
`PrefStringControl`, `BuiltinPref`, plus `isPrefLeaf` / `prefValueAtPath` /
`visiblePrefSubtree`, in the alphabetical position the file already keeps.

- [ ] **Step 2: Export the config module from the barrel**

`f`, and the types `ConfigNode`, `ConfigOf`, `ConfigRule`, `ConfigRuleContext`,
`ConfigSchema`, `ControlRenderer`, `InferConfig`, `LeafPatch`, `ResolvedConfig`,
`SectionSpec`, plus `resolveConfigSchema`, `fromConfigFields`, `isLeafVisible`.

- [ ] **Step 3: Verify the barrel test still passes**

Run: `npx vitest run --project=labkit index.test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/labkit/src/index.ts packages/labkit/src/passthrough/weasel-ui.ts
git commit -m "export the config schema surface"
```

---

### Task 8: Migrate `SceneInstrument`, and close out

**Files:**
- Modify: `packages/labkit/examples/weasel-lab/SceneInstrument.tsx`
- Modify: `docs/TODO.md`
- Delete: `docs/superpowers/plans/2026-08-26-labkit-config-schema.md`

- [ ] **Step 1: Migrate the instrument**

```ts
const sceneConfig = f.schema({
  showGrid: f.boolean(true).label('Show grid'),
  cellSize: f.number(20).range(5, 80).step(5).label('Grid spacing'),
});

export const SceneInstrument = defineInstrument<SceneState, ConfigOf<typeof sceneConfig>>({
  name: 'WeaselScene',
  config: sceneConfig,
  initialState: () => ({ scene: null }),
  // …unchanged
});
```

`GardenInstrument` and `StubInstrument` stay on the legacy path deliberately,
so both paths keep live coverage. Add a one-line comment saying so on
`GardenInstrument`.

- [ ] **Step 2: Full verification**

Run: `npx vitest run --project=labkit` — expect PASS.
Run: `npx tsc --noEmit` from the repo root — expect clean.
Run: `npm run dev` in `packages/labkit` and confirm the settings panel still
renders both controls, since jsdom cannot catch a layout collapse.

- [ ] **Step 3: Retire the TODO entry**

Rewrite the P1 entry at `docs/TODO.md:73` around what is actually left, and fix
the matching line in the hand-maintained index at `docs/TODO.md:24`. Add two new
entries: nested config values (path writes, `onConfigChange` diffing, storage),
and reconciling core's `ToolPrefLeaf` with ui's `PrefLeaf` — the `paint` kind
gap is the evidence.

- [ ] **Step 4: Write the changeset**

A `patch` changeset. Never `minor` or `major` without Mike saying so in the
conversation.

- [ ] **Step 5: Delete this plan and commit**

```bash
git rm docs/superpowers/plans/2026-08-26-labkit-config-schema.md
git add docs/TODO.md .changeset packages/labkit/examples/
git commit -m "migrate SceneInstrument to the config builder"
```

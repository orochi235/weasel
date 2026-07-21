# SelectionPanel + NodeProperties Trait Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the pre-baked, extensible selection properties panel (`<SelectionPanel>` in `@weasel-js/ui`) backed by a new core `NodeProperties` trait registry, with mixed-kind/mixed-value multi-selection support, then migrate WeaselDraw onto it.

**Architecture:** Core gains the `properties` trait (per-kind property schemas in the `ToolPref*` schema language, leaf keys = dotted node paths like `pose.x` / `data.fill`) plus pre-baked default schemas. `@weasel-js/ui` gains `ColorField` and `SelectionPanel`; the panel classifies selected nodes via routing entries, intersects schemas across kinds, aggregates values with a `MIXED` sentinel, and commits edits as one `scene.batch` fan-out per edit.

**Tech Stack:** TypeScript, React 18, react-aria-components, vitest + @testing-library/react, CSS Modules. Repo-internal imports of `@weasel-js/core` resolve via tsconfig `paths` + `weaselAliases` (no package.json change).

**Spec:** `docs/superpowers/specs/2026-07-20-selection-panel-design.md`

**Verification gate (run at the end of each task):** the project's per-task test command given in the steps; full gate `npx tsc --noEmit && npx vitest run && npm run build` in the final task.

**Conventions reminders:**
- Kit-internal imports use `baseUrl: src` bare paths (`core/scene/NodeRouting`, `tools/prefs`); packages/apps import `@weasel-js/core`.
- ui components: one dir per component (`ComponentName/ComponentName.tsx`, `ComponentName.module.css`, `index.ts`, `ComponentName.test.tsx`), CSS Modules imported as `s`, styling against `--wzl-*` tokens.
- No inline styles; no `!important`.
- Commit messages follow the repo's `feat(scope):` / `refactor(scope):` style, ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Core schema-type additions (`ToolPrefColor`, `ToolPrefCustom`, `pair`, `unit`)

**Files:**
- Modify: `src/tools/prefs.ts`
- Test: `src/tools/prefs.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/tools/prefs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type {
  ToolPrefColor,
  ToolPrefCustom,
  ToolPrefGroup,
  ToolPrefLeaf,
  ToolPrefNumber,
} from './prefs';

describe('ToolPref schema additions', () => {
  it('accepts color, custom, pair, and unit fields', () => {
    const fill: ToolPrefColor = {
      kind: 'color',
      name: 'Fill',
      description: 'Fill color.',
      default: '#000000ff',
      alpha: true,
    };
    const x: ToolPrefNumber = {
      kind: 'number',
      name: 'X',
      description: 'Left edge.',
      default: 0,
      pair: 'Position',
    };
    const rotation: ToolPrefNumber = {
      kind: 'number',
      name: 'Rotation',
      description: 'Rotation about center.',
      default: 0,
      unit: {
        toDisplay: (rad) => (rad * 180) / Math.PI,
        fromDisplay: (deg) => (deg * Math.PI) / 180,
        suffix: '°',
      },
    };
    const custom: ToolPrefCustom = {
      kind: 'my-app-kind',
      name: 'Special',
      description: 'App-defined leaf.',
      default: null,
    };
    const group: ToolPrefGroup = {
      name: 'Layout',
      children: { 'pose.x': x, 'pose.rotation': rotation, 'data.fill': fill, 'data.special': custom },
    };
    const leaves: ToolPrefLeaf[] = [fill, x, rotation, custom];
    expect(Object.keys(group.children)).toHaveLength(4);
    expect(leaves).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit src/tools/prefs.test.ts`
Expected: FAIL — type errors surface at runtime as transform/type-check failure (`ToolPrefColor` etc. not exported). If vitest doesn't type-fail, `npx tsc --noEmit` will; the point is the exports don't exist yet.

- [ ] **Step 3: Implement the additions in `src/tools/prefs.ts`**

Apply these edits (the file is small — shown as the complete new content of the changed regions):

```ts
export type ToolPrefKind = 'number' | 'boolean' | 'string' | 'enum' | 'color';

interface ToolPrefBase<K extends string, Value> {
  kind: K;
  /** Human-readable label. */
  name: string;
  /** Longer help text — shown in tooltips / a settings pane. */
  description: string;
  /** Fallback when nothing is persisted. */
  default: Value;
  /** Hide from a host app's settings UI by default. */
  hidden?: boolean;
  /** Render full-width with no label row in schema-driven settings UIs
   *  (weasel-ui `PrefsForm` honors this for leaves whose control brings
   *  its own chrome). */
  block?: boolean;
  /** Row-pairing hint for compact property UIs (weasel-ui
   *  `SelectionPanel`): leaves sharing a `pair` id render side-by-side
   *  on one row labeled with the `pair` string (e.g. `'Position'` for
   *  `pose.x` / `pose.y`). Purely presentational. */
  pair?: string;
}
```

(Note the base's `K` widens from `ToolPrefKind` to `string` so `ToolPrefCustom` can extend it — the built-in leaf interfaces still pass literal kinds.)

After `ToolPrefEnumControl`, add:

```ts
/** Display-unit conversion for number leaves whose stored value uses a
 *  canonical unit the user shouldn't see (e.g. radians stored, degrees
 *  shown). The stored value stays canonical; UIs convert at the edge. */
export interface ToolPrefNumberUnit {
  toDisplay: (stored: number) => number;
  fromDisplay: (display: number) => number;
  /** Shown after the input, e.g. `'°'`. */
  suffix?: string;
}
```

Extend `ToolPrefNumber` with `unit?: ToolPrefNumberUnit;`, and after `ToolPrefEnum` add:

```ts
export interface ToolPrefColor extends ToolPrefBase<'color', string> {
  /** Value is `#rrggbb`, or `#rrggbbaa` when `alpha` is set (UIs then
   *  offer an opacity control). */
  alpha?: boolean;
}

/**
 * Open leaf: any node with a `kind` outside the built-ins. Schema-driven
 * UIs (weasel-ui `PrefsForm` / `SelectionPanel`) dispatch it to an
 * app-supplied renderer. Deliberately NOT index-signatured so concrete
 * app interfaces stay assignable. Mirrors weasel-ui's `PrefCustom`.
 */
export interface ToolPrefCustom extends ToolPrefBase<string, unknown> {}
```

Update the unions and group:

```ts
export type ToolPref =
  | ToolPrefNumber
  | ToolPrefBoolean
  | ToolPrefString
  | ToolPrefEnum
  | ToolPrefColor;

/** Built-in or app-defined leaf. */
export type ToolPrefLeaf = ToolPref | ToolPrefCustom;

/** Nestable group: branch nodes a tool can use to organize its prefs. */
export interface ToolPrefGroup {
  name: string;
  description?: string;
  children: Record<string, ToolPrefLeaf | ToolPrefGroup>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit src/tools/prefs.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors anywhere in the repo.

- [ ] **Step 5: Commit**

```bash
git add src/tools/prefs.ts src/tools/prefs.test.ts
git commit -m "feat(tools): extend ToolPref schema — color/custom leaves, pair + unit hints"
```

---

### Task 2: `NodeProperties` trait registry

**Files:**
- Create: `src/core/scene/NodeProperties.ts`
- Test: `src/core/scene/NodeProperties.test.ts`
- Reference: `src/core/scene/NodeRouting.ts` (mirror its structure and JSDoc framing)

- [ ] **Step 1: Write the failing test**

Create `src/core/scene/NodeProperties.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createNodeProperties, type NodePropertiesEntry } from './NodeProperties';

const entry = (name: string): NodePropertiesEntry => ({
  name,
  schema: {
    name: 'Properties',
    children: {
      layout: {
        name: 'Layout',
        children: {
          'pose.x': { kind: 'number', name: 'X', description: 'x', default: 0 },
        },
      },
    },
  },
});

describe('createNodeProperties', () => {
  it('registers, looks up, and lists in registration order', () => {
    const reg = createNodeProperties();
    reg.register(entry('rect'));
    reg.register(entry('text'));
    expect(reg.get('rect')?.name).toBe('rect');
    expect(reg.get('nope')).toBeUndefined();
    expect(reg.list().map((e) => e.name)).toEqual(['rect', 'text']);
  });

  it('throws on duplicate kind names', () => {
    const reg = createNodeProperties();
    reg.register(entry('rect'));
    expect(() => reg.register(entry('rect'))).toThrow(/duplicate/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit src/core/scene/NodeProperties.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/scene/NodeProperties.ts`**

```ts
import type { ToolPrefGroup } from 'tools/prefs';

/**
 * NodePropertiesEntry — one kind's entry in the **properties trait's**
 * registry: a declarative schema of the kind's editable properties.
 *
 * Leaf keys inside `schema` are dotted node paths (`pose.x`,
 * `data.fill`) — two segments, rooted at `pose` or `data` — so schema
 * consumers (weasel-ui `SelectionPanel`) can read/aggregate/write
 * generically with no per-kind code. Group keys are organizational
 * only; they do not contribute to the node path.
 *
 * Kind names share the routing trait's vocabulary — an entry registered
 * as `'rect'` describes nodes `NodeRouting.classify` maps to `'rect'`.
 * See `docs/superpowers/specs/2026-07-20-selection-panel-design.md` and
 * the trait taxonomy in
 * `docs/superpowers/specs/2026-05-24-node-traits-reframe-design.md`.
 */
export interface NodePropertiesEntry {
  /** Kind name — same vocabulary as the routing trait. */
  name: string;
  /** Property schema for this kind. */
  schema: ToolPrefGroup;
}

/**
 * NodeProperties — the **properties trait's** registry. Each trait of a
 * node (shape, routing, properties, …) is its own registry; this one
 * answers "what editable properties does this kind expose?" Consumed by
 * weasel-ui's `<SelectionPanel>`.
 *
 * (Supersedes the speculative `NodePropertyRows` name in the traits
 * spec — the stored value is a schema, not render contributors.)
 */
export interface NodeProperties {
  /** Register a kind. Throws if a kind with this name is already
   *  registered. */
  register(entry: NodePropertiesEntry): void;
  /** Lookup a kind's entry by name. */
  get(name: string): NodePropertiesEntry | undefined;
  /** Enumerate registered kinds in registration order. */
  list(): readonly NodePropertiesEntry[];
}

export function createNodeProperties(): NodeProperties {
  const entries: NodePropertiesEntry[] = [];
  const byName = new Map<string, NodePropertiesEntry>();
  return {
    register(entry) {
      if (byName.has(entry.name)) {
        throw new Error(
          `createNodeProperties: duplicate kind name "${entry.name}"`,
        );
      }
      byName.set(entry.name, entry);
      entries.push(entry);
    },
    get(name) {
      return byName.get(name);
    },
    list() {
      return entries;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit src/core/scene/NodeProperties.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/scene/NodeProperties.ts src/core/scene/NodeProperties.test.ts
git commit -m "feat(scene): NodeProperties trait registry — per-kind property schemas"
```

---

### Task 3: `defaultNodeProperties` + `inferredNodeProperties`

**Files:**
- Create: `src/canvas/SceneCanvas/defaultNodeProperties.ts`
- Test: `src/canvas/SceneCanvas/defaultNodeProperties.test.ts`
- Reference: `src/canvas/SceneCanvas/defaultNodeRouting.ts` (sibling file; mirror its doc style)

- [ ] **Step 1: Write the failing test**

Create `src/canvas/SceneCanvas/defaultNodeProperties.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defaultNodeProperties, inferredNodeProperties } from './defaultNodeProperties';
import { KIT_SHAPE_KINDS } from './useBuiltinShapeTools';
import { inferredNodeRouting } from './defaultNodeRouting';

describe('defaultNodeProperties', () => {
  it('stays in lockstep with KIT_SHAPE_KINDS', () => {
    expect(defaultNodeProperties.map((e) => e.name)).toEqual([...KIT_SHAPE_KINDS]);
  });

  it('every entry has Layout pose leaves and Appearance data leaves', () => {
    for (const e of defaultNodeProperties) {
      const layout = e.schema.children.layout;
      const appearance = e.schema.children.appearance;
      expect(layout && 'children' in layout).toBe(true);
      expect(appearance && 'children' in appearance).toBe(true);
      if (layout && 'children' in layout) {
        expect(Object.keys(layout.children)).toEqual(
          expect.arrayContaining(['pose.x', 'pose.y', 'pose.width', 'pose.height', 'pose.rotation']),
        );
      }
      if (appearance && 'children' in appearance) {
        expect(Object.keys(appearance.children)).toEqual(
          expect.arrayContaining(['data.fill', 'data.stroke', 'data.strokeWidth']),
        );
      }
    }
  });

  it('text kind carries a data.text leaf', () => {
    const text = defaultNodeProperties.find((e) => e.name === 'text');
    const textGroup = text?.schema.children.text;
    expect(textGroup && 'children' in textGroup && 'data.text' in textGroup.children).toBe(true);
  });
});

describe('inferredNodeProperties', () => {
  it('stays in lockstep with inferredNodeRouting kind names', () => {
    expect(inferredNodeProperties.map((e) => e.name)).toEqual(
      inferredNodeRouting.map((e) => e.name),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit src/canvas/SceneCanvas/defaultNodeProperties.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/canvas/SceneCanvas/defaultNodeProperties.ts`**

```ts
import { KIT_SHAPE_KINDS } from './useBuiltinShapeTools';
import { inferredNodeRouting } from './defaultNodeRouting';
import type { NodePropertiesEntry } from 'core/scene/NodeProperties';
import type { ToolPrefGroup, ToolPrefNumberUnit } from 'tools/prefs';

const RAD_TO_DEG = 180 / Math.PI;

/** Radians-stored / degrees-shown conversion for `pose.rotation` leaves.
 *  Display rounds to 0.1° so a canonical radian value doesn't render as
 *  a 15-digit float. */
export const rotationDegreesUnit: ToolPrefNumberUnit = {
  toDisplay: (rad) => Math.round(rad * RAD_TO_DEG * 10) / 10,
  fromDisplay: (deg) => deg / RAD_TO_DEG,
  suffix: '°',
};

/** Build the standard shape schema — Layout (pose box + rotation) +
 *  Appearance (fill / stroke / stroke width), optionally a Text group.
 *  Matches the kit's builtin-shape data template
 *  (`{ path, fill, stroke?, strokeWidth?, text? }`, `useBuiltinShapeTools`). */
function shapeSchema(opts: { text?: boolean } = {}): ToolPrefGroup {
  return {
    name: 'Properties',
    children: {
      layout: {
        name: 'Layout',
        children: {
          'pose.x': { kind: 'number', name: 'X', description: 'Left edge, world units.', default: 0, pair: 'Position' },
          'pose.y': { kind: 'number', name: 'Y', description: 'Top edge, world units.', default: 0, pair: 'Position' },
          'pose.width': { kind: 'number', name: 'W', description: 'Width, world units.', default: 0, min: 0, pair: 'Size' },
          'pose.height': { kind: 'number', name: 'H', description: 'Height, world units.', default: 0, min: 0, pair: 'Size' },
          'pose.rotation': { kind: 'number', name: 'Rotation', description: 'Rotation about the box center.', default: 0, step: 1, unit: rotationDegreesUnit },
        },
      },
      appearance: {
        name: 'Appearance',
        children: {
          'data.fill': { kind: 'color', name: 'Fill', description: 'Fill color.', default: '#000000ff', alpha: true },
          'data.stroke': { kind: 'color', name: 'Stroke', description: 'Stroke color.', default: '#000000ff', alpha: true },
          'data.strokeWidth': { kind: 'number', name: 'Stroke width', description: 'Stroke width, world units.', default: 0, min: 0, step: 0.5 },
        },
      },
      ...(opts.text
        ? {
            text: {
              name: 'Text',
              children: {
                'data.text': { kind: 'string', name: 'Text', description: 'Text content.', default: '' },
              },
            },
          }
        : {}),
    },
  };
}

/**
 * Default properties-trait entries covering the kit's built-in shape
 * kinds (`KIT_SHAPE_KINDS`) — the sibling of `defaultNodeRouting`. Every
 * kind gets the standard box schema; `text` adds a Text group. In
 * lockstep with `KIT_SHAPE_KINDS` by construction (derived via `.map`).
 */
export const defaultNodeProperties: readonly NodePropertiesEntry[] =
  KIT_SHAPE_KINDS.map((name) => ({
    name,
    schema: shapeSchema({ text: name === 'text' }),
  }));

/**
 * Properties-trait entries for the *inferred* routing kinds
 * (`inferredNodeRouting`: `text` / `path` / `image`) — the vocabulary
 * consumers produce when they don't tag `data.kind` (e.g. WeaselDraw).
 * In lockstep with `inferredNodeRouting` by construction.
 */
export const inferredNodeProperties: readonly NodePropertiesEntry[] =
  inferredNodeRouting.map((e) => ({
    name: e.name,
    schema: shapeSchema({ text: e.name === 'text' }),
  }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit src/canvas/SceneCanvas/defaultNodeProperties.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/canvas/SceneCanvas/defaultNodeProperties.ts src/canvas/SceneCanvas/defaultNodeProperties.test.ts
git commit -m "feat(canvas): defaultNodeProperties + inferredNodeProperties trait defaults"
```

---

### Task 4: Core barrel exports

**Files:**
- Modify: `src/index.ts`
- Reference: existing `NodeRouting` / `defaultNodeRouting` export lines (grep `defaultNodeRouting` in `src/index.ts` and place the new exports adjacent)

- [ ] **Step 1: Add exports**

Next to the existing `NodeRouting` exports in `src/index.ts`, add:

```ts
export { createNodeProperties } from './core/scene/NodeProperties';
export type { NodeProperties, NodePropertiesEntry } from './core/scene/NodeProperties';
export {
  defaultNodeProperties,
  inferredNodeProperties,
  rotationDegreesUnit,
} from './canvas/SceneCanvas/defaultNodeProperties';
```

Also confirm `ToolPrefColor`, `ToolPrefCustom`, `ToolPrefLeaf`, `ToolPrefNumberUnit` are exported wherever the existing `ToolPref*` types are re-exported (grep `ToolPrefGroup` in `src/index.ts`; extend that type-export list).

- [ ] **Step 2: Verify**

Run: `npx vitest run --project=kit src/index.barrel.test.ts && npx tsc --noEmit`
Expected: PASS. (If the barrel test enforces an export inventory, update its expected list per its own instructions.)

- [ ] **Step 3: Commit**

```bash
git add src/index.ts src/index.barrel.test.ts
git commit -m "feat(core): export NodeProperties trait + defaults from the barrel"
```

---

### Task 5: Mirror schema additions in weasel-ui Prefs schema

Keep `packages/ui/src/components/Prefs/schema.ts` field-for-field in sync with core's `ToolPref*` (its header comment mandates this).

**Files:**
- Modify: `packages/ui/src/components/Prefs/schema.ts`
- Modify: `packages/ui/src/components/Prefs/index.ts` (export new types)
- Test: extend `packages/ui/src/components/Prefs/PrefsForm.test.tsx` only if it has a schema-shape test; otherwise type-checking is the gate

- [ ] **Step 1: Add to `schema.ts`**

In `PrefBase`, after `block?`, add (same JSDoc as core's `pair`):

```ts
  /** Row-pairing hint for compact property UIs (`SelectionPanel`):
   *  leaves sharing a `pair` id render side-by-side on one row labeled
   *  with the `pair` string. Purely presentational. */
  pair?: string;
```

After `PrefEnumControl`, add:

```ts
/** Display-unit conversion for number leaves whose stored value uses a
 *  canonical unit the user shouldn't see (radians → degrees). Mirrors
 *  core's `ToolPrefNumberUnit`. */
export interface PrefNumberUnit {
  toDisplay: (stored: number) => number;
  fromDisplay: (display: number) => number;
  suffix?: string;
}
```

Extend `PrefNumber` with `unit?: PrefNumberUnit;`. After `PrefEnum`, add:

```ts
export interface PrefColor extends PrefBase<'color', string> {
  /** Value is `#rrggbb`, or `#rrggbbaa` when `alpha` is set. */
  alpha?: boolean;
}
```

Update the union: `export type BuiltinPref = PrefNumber | PrefBoolean | PrefString | PrefEnum | PrefColor;`

- [ ] **Step 2: Export from `Prefs/index.ts`**

Add `type PrefColor,` and `type PrefNumberUnit,` to the schema type-export list.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npx vitest run --project=weasel-ui packages/ui/src/components/Prefs`
Expected: PASS

```bash
git add packages/ui/src/components/Prefs/schema.ts packages/ui/src/components/Prefs/index.ts
git commit -m "feat(ui): mirror ToolPref schema additions (color, pair, unit) in Prefs schema"
```

---

### Task 6: `ColorField` component in weasel-ui

Lift WeaselDraw's `PropertyColorInput` (`apps/draw/src/ui/PropertiesPanel/PropertiesPanel.tsx:197-306`) into a generic controlled component — no ActionsRegistry. Color helpers `toHex8` / `getAlpha01` / `withAlpha01` come from `@weasel-js/core` (resolved via repo aliases; do NOT add a package.json dependency).

**Files:**
- Create: `packages/ui/src/components/ColorField/ColorField.tsx`
- Create: `packages/ui/src/components/ColorField/ColorField.module.css`
- Create: `packages/ui/src/components/ColorField/index.ts`
- Test: `packages/ui/src/components/ColorField/ColorField.test.tsx`
- Modify: `packages/ui/src/index.ts` (add `export * from './components/ColorField';`)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorField } from './ColorField';

describe('ColorField', () => {
  it('renders the rgb value in the color input', () => {
    render(<ColorField value="#ff000080" alpha onChange={() => {}} aria-label="Fill" />);
    expect(screen.getByLabelText('Fill')).toHaveValue('#ff0000');
  });

  it('emits live onInput and a single commit onChange on blur', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<ColorField value="#112233ff" alpha onInput={onInput} onChange={onChange} aria-label="Fill" />);
    const input = screen.getByLabelText('Fill');
    fireEvent.input(input, { target: { value: '#445566' } });
    expect(onInput).toHaveBeenCalledWith('#445566ff');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#445566ff');
  });

  it('commits alpha on pointer-up of the opacity slider', () => {
    const onChange = vi.fn();
    render(<ColorField value="#11223380" alpha onChange={onChange} aria-label="Fill" />);
    const slider = screen.getByLabelText('Opacity');
    fireEvent.input(slider, { target: { value: '100' } });
    fireEvent.pointerUp(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#112233ff');
  });

  it('mixed renders the indeterminate chip and no value', () => {
    const { container } = render(<ColorField mixed alpha onChange={() => {}} aria-label="Fill" />);
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });

  it('hides the opacity slider without alpha', () => {
    render(<ColorField value="#112233" onChange={() => {}} aria-label="Fill" />);
    expect(screen.queryByLabelText('Opacity')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/ColorField`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ColorField.tsx`**

```tsx
import { useState } from 'react';
import { toHex8, getAlpha01, withAlpha01 } from '@weasel-js/core';
import s from './ColorField.module.css';

export interface ColorFieldProps {
  /** Current color, `#rrggbb` or `#rrggbbaa`. Omit when `mixed`. */
  value?: string;
  /** Indeterminate presentation (multi-selection with differing colors):
   *  checkered chip, empty value. The first edit produces a real value. */
  mixed?: boolean;
  /** Show the opacity slider; emitted values are `#rrggbbaa`. */
  alpha?: boolean;
  /** Live value during interaction (picker drag, slider drag). Optional —
   *  wire it for live preview; omit it for commit-only consumers. */
  onInput?: (hex: string) => void;
  /** Committed value — picker close (blur) or slider release. One call
   *  per user gesture; pair with an undoable write. */
  onChange: (hex: string) => void;
  'aria-label'?: string;
  className?: string;
}

/**
 * Compact color editor: native color input + optional opacity slider.
 * Commit semantics are gesture-based (see `onChange`) because native
 * color/range inputs fire `change` continuously during interaction —
 * commit-on-change would emit one undo entry per tick.
 */
export function ColorField(props: ColorFieldProps) {
  const { value, mixed = false, alpha = false, onInput, onChange, className } = props;
  const hex8 = toHex8(value ?? '#000000');
  const rgb6 = hex8.slice(0, 7);
  const alpha01 = getAlpha01(hex8);
  const alphaPct = Math.round(alpha01 * 100);

  // Drafts track the control during a gesture (the committed prop only
  // updates after onChange), then reset to follow the prop again.
  const [colorDraft, setColorDraft] = useState<string | null>(null);
  const [alphaDraft, setAlphaDraft] = useState<number | null>(null);
  const visibleRgb = colorDraft ?? rgb6;
  const visibleAlphaPct = alphaDraft ?? alphaPct;

  const compose = (rgb: string, a01: number): string =>
    alpha ? withAlpha01(rgb, a01) : rgb;

  // Commit only when a gesture actually changed something — blur with no
  // preceding input must not emit (it would create a no-op undo entry).
  const commit = (rgb: string, a01: number): void => {
    if (colorDraft === null && alphaDraft === null) return;
    onChange(compose(rgb, a01));
    setColorDraft(null);
    setAlphaDraft(null);
  };

  return (
    <span
      className={[s.root, className].filter(Boolean).join(' ')}
      {...(mixed && colorDraft === null ? { 'data-mixed': '' } : {})}
    >
      <span className={s.chip}>
        <input
          className={s.color}
          type="color"
          value={visibleRgb}
          aria-label={props['aria-label'] ?? 'Color'}
          onInput={(e) => {
            const rgb = (e.target as HTMLInputElement).value;
            setColorDraft(rgb);
            onInput?.(compose(rgb, (visibleAlphaPct) / 100));
          }}
          onBlur={() => commit(visibleRgb, visibleAlphaPct / 100)}
        />
      </span>
      {alpha && (
        <>
          <input
            className={s.alphaRange}
            type="range"
            min={0}
            max={100}
            step={1}
            value={visibleAlphaPct}
            aria-label="Opacity"
            onInput={(e) => {
              const pct = Number((e.target as HTMLInputElement).value);
              setAlphaDraft(pct);
              onInput?.(compose(visibleRgb, pct / 100));
            }}
            onPointerUp={() => commit(visibleRgb, visibleAlphaPct / 100)}
            onPointerCancel={() => commit(visibleRgb, visibleAlphaPct / 100)}
            onKeyUp={() => commit(visibleRgb, visibleAlphaPct / 100)}
          />
          <span className={s.alphaReadout}>{visibleAlphaPct}</span>
        </>
      )}
    </span>
  );
}
```

Note: the commit-on-blur test fires `input` then `blur`; blur commits the *draft* value, so `onChange` receives `#445566ff`. The mixed test asserts `data-mixed` on the root. The alpha-commit test drags to 100 then pointer-ups → commit uses the draft (100%).

- [ ] **Step 4: Implement `ColorField.module.css`**

```css
.root {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.chip {
  position: relative;
  display: inline-flex;
  border-radius: 4px;
  overflow: hidden;
}

.color {
  inline-size: 28px;
  block-size: 20px;
  padding: 0;
  border: 1px solid var(--wzl-border, #444);
  border-radius: 4px;
  background: none;
  cursor: pointer;
}

/* Indeterminate (mixed) presentation: checkerboard overlay atop the
 * swatch. pointer-events: none so the input stays clickable. */
.root[data-mixed] .chip::after {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: 3px;
  pointer-events: none;
  background: repeating-conic-gradient(
      var(--wzl-border, #666) 0% 25%,
      var(--wzl-surface, #2e2f36) 0% 50%
    )
    50% / 8px 8px;
}

.alphaRange {
  flex: 1;
  min-inline-size: 48px;
  accent-color: var(--wzl-accent, #7ab8d4);
}

.alphaReadout {
  min-inline-size: 3ch;
  text-align: end;
  font-size: 11px;
  opacity: 0.7;
}
```

- [ ] **Step 5: Create `index.ts`, export from ui barrel**

`packages/ui/src/components/ColorField/index.ts`:

```ts
export { ColorField, type ColorFieldProps } from './ColorField';
```

Add `export * from './components/ColorField';` to `packages/ui/src/index.ts`.

- [ ] **Step 6: Run tests**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/ColorField && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/ColorField packages/ui/src/index.ts
git commit -m "feat(ui): ColorField — generic color+alpha editor lifted from WeaselDraw"
```

---

### Task 7: `NumberField` placeholder prop

**Files:**
- Modify: `packages/ui/src/components/NumberField/NumberField.tsx`
- Test: extend `packages/ui/src/components/NumberField/NumberField.test.tsx`

- [ ] **Step 1: Write the failing test** (append to the existing test file, matching its render helpers)

```tsx
it('threads placeholder to the input', () => {
  render(<NumberField aria-label="X" value={NaN} placeholder="Mixed" />);
  expect(screen.getByLabelText('X')).toHaveAttribute('placeholder', 'Mixed');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/NumberField`
Expected: FAIL — placeholder attribute absent.

- [ ] **Step 3: Implement**

In `NumberField.tsx`: add `placeholder?: string;` to `NumberFieldProps`, destructure it, and pass `<RACInput ref={ref} placeholder={placeholder} />`.

- [ ] **Step 4: Run test to verify it passes, commit**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/NumberField`

```bash
git add packages/ui/src/components/NumberField
git commit -m "feat(ui): NumberField placeholder prop"
```

---

### Task 8: PrefsForm renders `color` leaves via ColorField

**Files:**
- Modify: `packages/ui/src/components/Prefs/PrefsForm.tsx`
- Test: extend `packages/ui/src/components/Prefs/PrefsForm.test.tsx`

- [ ] **Step 1: Write the failing test** (append; match the existing file's render/schema helpers)

```tsx
it('renders color leaves with ColorField and applies commits', () => {
  const onChange = vi.fn();
  render(
    <PrefsForm
      schema={{
        name: 'root',
        children: {
          paint: {
            name: 'Paint',
            children: {
              accent: { kind: 'color', name: 'Accent', description: 'Accent color.', default: '#112233' },
            },
          },
        },
      }}
      onChange={onChange}
    />,
  );
  const input = screen.getByLabelText('Accent');
  fireEvent.input(input, { target: { value: '#445566' } });
  fireEvent.blur(input);
  expect(onChange).toHaveBeenCalledWith('paint.accent', '#445566');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Prefs`
Expected: FAIL — the leaf renders the "(color: no renderer)" placeholder.

- [ ] **Step 3: Implement**

In `PrefsForm.tsx`: import `ColorField` and `type PrefColor`, and add a case to `renderBuiltin` before `default`:

```tsx
    case 'color': {
      const p = pref as PrefColor;
      const hex = typeof value === 'string' ? value : p.default;
      return (
        <ColorField
          value={hex}
          alpha={p.alpha}
          onChange={setValue}
          aria-label={p.name}
        />
      );
    }
```

- [ ] **Step 4: Run tests, commit**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Prefs && npx tsc --noEmit`

```bash
git add packages/ui/src/components/Prefs/PrefsForm.tsx packages/ui/src/components/Prefs/PrefsForm.test.tsx
git commit -m "feat(ui): PrefsForm built-in color renderer via ColorField"
```

---

### Task 9: SelectionPanel model (pure functions)

**Files:**
- Create: `packages/ui/src/components/SelectionPanel/model.ts`
- Test: `packages/ui/src/components/SelectionPanel/model.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import type { NodePropertiesEntry, NodeRoutingEntry } from '@weasel-js/core';
import {
  MIXED,
  aggregateValue,
  classifyKind,
  effectiveSections,
  kindBreakdown,
} from './model';

const routing: NodeRoutingEntry[] = [
  { name: 'rect', matches: (d) => (d as { kind?: string })?.kind === 'rect' },
  { name: 'text', matches: (d) => (d as { kind?: string })?.kind === 'text' },
];

const num = (name: string, pair?: string) =>
  ({ kind: 'number', name, description: name, default: 0, ...(pair ? { pair } : {}) }) as const;

const entries: NodePropertiesEntry[] = [
  {
    name: 'rect',
    schema: {
      name: 'Properties',
      children: {
        layout: {
          name: 'Layout',
          children: {
            'pose.x': num('X', 'Position'),
            'pose.y': num('Y', 'Position'),
            'pose.width': num('W', 'Size'),
          },
        },
        appearance: {
          name: 'Appearance',
          children: {
            'data.fill': { kind: 'color', name: 'Fill', description: 'f', default: '#000' },
            'data.corner': num('Corner radius'),
          },
        },
      },
    },
  },
  {
    name: 'text',
    schema: {
      name: 'Properties',
      children: {
        layout: {
          name: 'Layout',
          children: { 'pose.x': num('X', 'Position'), 'pose.y': num('Y', 'Position') },
        },
        appearance: {
          name: 'Appearance',
          children: {
            'data.fill': { kind: 'color', name: 'Fill', description: 'f', default: '#000' },
            // deliberately different leaf kind at a shared path:
            'data.corner': { kind: 'string', name: 'Corner', description: 'c', default: '' },
          },
        },
      },
    },
  },
];

const leaf = (id: string, data: unknown, pose = { x: 0, y: 0 }) =>
  ({ id, kind: 'leaf', layer: 'default', pose, data, parent: null }) as never;

describe('classifyKind', () => {
  it('classifies containers as group and data by routing match', () => {
    expect(classifyKind(leaf('a', { kind: 'rect' }), routing)).toBe('rect');
    expect(classifyKind({ ...(leaf('c', {}) as object), kind: 'container' } as never, routing)).toBe('group');
    expect(classifyKind(leaf('u', { kind: 'blob' }), routing)).toBe('unknown');
  });
});

describe('effectiveSections', () => {
  it('returns the full schema for a single kind, with pair rows merged', () => {
    const sections = effectiveSections(['rect'], entries);
    expect(sections.map((s) => s.name)).toEqual(['Layout', 'Appearance']);
    const layout = sections[0];
    expect(layout.rows.map((r) => r.label)).toEqual(['Position', 'Size']);
    expect(layout.rows[0].leaves.map((l) => l.path)).toEqual(['pose.x', 'pose.y']);
  });

  it('intersects across kinds by (path, leaf kind)', () => {
    const sections = effectiveSections(['rect', 'text'], entries);
    const paths = sections.flatMap((s) => s.rows.flatMap((r) => r.leaves.map((l) => l.path)));
    expect(paths).toContain('pose.x');
    expect(paths).toContain('data.fill');
    expect(paths).not.toContain('pose.width');   // absent from text
    expect(paths).not.toContain('data.corner');  // kind conflict number vs string
  });

  it('a kind with no registered schema collapses the intersection', () => {
    expect(effectiveSections(['rect', 'unknown'], entries)).toEqual([]);
  });

  it('duplicate kinds count once', () => {
    expect(effectiveSections(['rect', 'rect'], entries)).toEqual(effectiveSections(['rect'], entries));
  });
});

describe('aggregateValue', () => {
  it('returns the shared value, MIXED on divergence, and reads pose/data roots', () => {
    const a = leaf('a', { kind: 'rect', fill: '#f00' }, { x: 5, y: 1 });
    const b = leaf('b', { kind: 'rect', fill: '#f00' }, { x: 9, y: 1 });
    expect(aggregateValue([a, b], 'data.fill')).toBe('#f00');
    expect(aggregateValue([a, b], 'pose.x')).toBe(MIXED);
    expect(aggregateValue([a, b], 'pose.y')).toBe(1);
  });

  it('treats missing values as a divergence when only some nodes have them', () => {
    const a = leaf('a', { kind: 'rect', fill: '#f00' });
    const b = leaf('b', { kind: 'rect' });
    expect(aggregateValue([a, b], 'data.fill')).toBe(MIXED);
    expect(aggregateValue([b], 'data.fill')).toBeUndefined();
  });
});

describe('kindBreakdown', () => {
  it('formats counts newest-order-preserving', () => {
    expect(kindBreakdown(['rect', 'text', 'rect'])).toBe('rect ×2 · text');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/SelectionPanel`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `model.ts`**

```ts
// Pure selection→panel derivations for SelectionPanel. Kept free of
// React so intersection/aggregation semantics are unit-testable.
//
// Path convention (see core `NodePropertiesEntry`): a leaf's OWN KEY in
// the schema is its node path — two dotted segments rooted at `pose` or
// `data` (`pose.x`, `data.fill`). Group keys are organizational only.

import type {
  Node,
  NodePropertiesEntry,
  NodeRoutingEntry,
  ToolPrefGroup,
  ToolPrefLeaf,
} from '@weasel-js/core';

/** Sentinel for "selected nodes disagree at this path". */
export const MIXED: unique symbol = Symbol('weasel-ui:mixed');
export type Mixed = typeof MIXED;

export type AnyNode = Node<unknown, string, unknown>;

export interface PanelLeaf {
  /** Dotted node path — the leaf's key in the schema. */
  path: string;
  leaf: ToolPrefLeaf;
}

export interface PanelRow {
  label: string;
  leaves: PanelLeaf[];
}

export interface PanelSection {
  key: string;
  name: string;
  rows: PanelRow[];
}

/** Derive a node's kind: containers are `'group'`; leaves classify their
 *  `data` through the routing entries (first match wins, `'unknown'`
 *  otherwise) — same semantics as core's `NodeRouting.classify`. */
export function classifyKind(
  node: AnyNode,
  routing: readonly NodeRoutingEntry[],
): string {
  if (node.kind === 'container') return 'group';
  for (const entry of routing) {
    if (entry.matches(node.data)) return entry.name;
  }
  return 'unknown';
}

function isGroup(n: ToolPrefLeaf | ToolPrefGroup): n is ToolPrefGroup {
  return !('kind' in n);
}

/** Flatten a schema to sections of leaves. Nested groups fold into their
 *  top-level section; top-level leaves get an untitled leading section. */
function flatten(schema: ToolPrefGroup): PanelSection[] {
  const sections: PanelSection[] = [];
  const untitled: PanelLeaf[] = [];

  const collect = (group: ToolPrefGroup, into: PanelLeaf[]): void => {
    for (const [key, child] of Object.entries(group.children)) {
      if (isGroup(child)) collect(child, into);
      else into.push({ path: key, leaf: child });
    }
  };

  for (const [key, child] of Object.entries(schema.children)) {
    if (isGroup(child)) {
      const leaves: PanelLeaf[] = [];
      collect(child, leaves);
      sections.push({ key, name: child.name, rows: pairRows(leaves) });
    } else {
      untitled.push({ path: key, leaf: child });
    }
  }
  if (untitled.length > 0) {
    sections.unshift({ key: '', name: '', rows: pairRows(untitled) });
  }
  return sections;
}

/** Merge consecutive leaves sharing a `pair` id into one labeled row. */
function pairRows(leaves: readonly PanelLeaf[]): PanelRow[] {
  const rows: PanelRow[] = [];
  for (const item of leaves) {
    const pair = item.leaf.pair;
    const prev = rows[rows.length - 1];
    if (pair !== undefined && prev !== undefined && prev.label === pair) {
      prev.leaves.push(item);
    } else {
      rows.push({ label: pair ?? item.leaf.name, leaves: [item] });
    }
  }
  return rows;
}

/**
 * The schema the panel shows for a set of kinds: one kind → its full
 * schema; several → the intersection by (path, leaf kind), shaped by the
 * first kind's section/row layout. Kinds without a registered schema
 * contribute nothing, so their presence collapses the intersection.
 */
export function effectiveSections(
  kinds: readonly string[],
  entries: readonly NodePropertiesEntry[],
): PanelSection[] {
  const uniq = [...new Set(kinds)];
  if (uniq.length === 0) return [];
  const byName = new Map(entries.map((e) => [e.name, e]));
  const schemas = uniq.map((k) => byName.get(k)?.schema);
  if (schemas.some((s) => s === undefined)) return [];
  const [first, ...rest] = schemas as ToolPrefGroup[];

  const flatFirst = flatten(first);
  if (rest.length === 0) return flatFirst;

  const restKeys = rest.map(
    (schema) =>
      new Set(
        flatten(schema)
          .flatMap((s) => s.rows)
          .flatMap((r) => r.leaves)
          .map((l) => `${l.path} ${l.leaf.kind}`),
      ),
  );
  const keep = (l: PanelLeaf): boolean =>
    restKeys.every((set) => set.has(`${l.path} ${l.leaf.kind}`));

  return flatFirst
    .map((section) => ({
      ...section,
      rows: section.rows
        .map((row) => ({ ...row, leaves: row.leaves.filter(keep) }))
        .filter((row) => row.leaves.length > 0),
    }))
    .filter((section) => section.rows.length > 0);
}

/** Read a node value at a two-segment path (`pose.x` / `data.fill`). */
export function nodeValueAt(node: AnyNode, path: string): unknown {
  const dot = path.indexOf('.');
  if (dot < 0) return undefined;
  const head = path.slice(0, dot);
  const key = path.slice(dot + 1);
  const root = head === 'pose' ? node.pose : head === 'data' ? node.data : undefined;
  if (root == null || typeof root !== 'object') return undefined;
  return (root as Record<string, unknown>)[key];
}

/** Aggregate a path across nodes: the shared value, or `MIXED`. */
export function aggregateValue(
  nodes: readonly AnyNode[],
  path: string,
): unknown | Mixed {
  let value: unknown;
  let first = true;
  for (const node of nodes) {
    const v = nodeValueAt(node, path);
    if (first) {
      value = v;
      first = false;
    } else if (!Object.is(v, value)) {
      return MIXED;
    }
  }
  return value;
}

/** `'rect ×2 · text'` — kinds in first-seen order with counts. */
export function kindBreakdown(kinds: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()]
    .map(([k, n]) => (n > 1 ? `${k} ×${n}` : k))
    .join(' · ');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/SelectionPanel`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/SelectionPanel/model.ts packages/ui/src/components/SelectionPanel/model.test.ts
git commit -m "feat(ui): SelectionPanel model — classify, intersect, aggregate, breakdown"
```

---

### Task 10: `SelectionPanel` component

**Files:**
- Create: `packages/ui/src/components/SelectionPanel/SelectionPanel.tsx`
- Create: `packages/ui/src/components/SelectionPanel/SelectionPanel.module.css`
- Create: `packages/ui/src/components/SelectionPanel/index.ts`
- Test: `packages/ui/src/components/SelectionPanel/SelectionPanel.test.tsx`
- Modify: `packages/ui/src/index.ts` (barrel export + amend the header comment)

- [ ] **Step 1: Write the failing test**

Use a real scene via core's `createScene` and a minimal `SelectionApi` stub (only `current` is read by the panel; keep the stub honest by typing it through `Pick`).

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  createScene,
  asNodeId,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type SelectionApi,
} from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';

interface Data { kind: string; fill?: string; label?: string }
type Layer = 'default';
interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

const routing: NodeRoutingEntry[] = [
  { name: 'rect', matches: (d) => (d as Data)?.kind === 'rect' },
  { name: 'text', matches: (d) => (d as Data)?.kind === 'text' },
];

const properties: NodePropertiesEntry[] = [
  {
    name: 'rect',
    schema: {
      name: 'Properties',
      children: {
        layout: {
          name: 'Layout',
          children: {
            'pose.x': { kind: 'number', name: 'X', description: 'x', default: 0, pair: 'Position' },
            'pose.y': { kind: 'number', name: 'Y', description: 'y', default: 0, pair: 'Position' },
          },
        },
        appearance: {
          name: 'Appearance',
          children: {
            'data.fill': { kind: 'color', name: 'Fill', description: 'f', default: '#000000ff', alpha: true },
          },
        },
      },
    },
  },
];

function makeScene() {
  const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('a'), kind: 'leaf', layer: 'default', pose: { x: 10, y: 20, width: 30, height: 40 }, data: { kind: 'rect', fill: '#ff0000ff' } });
  scene.add({ id: asNodeId('b'), kind: 'leaf', layer: 'default', pose: { x: 50, y: 20, width: 30, height: 40 }, data: { kind: 'rect', fill: '#00ff00ff' } });
  return scene;
}

const selectionOf = (ids: string[]): SelectionApi =>
  ({ current: ids } as unknown as SelectionApi);

describe('SelectionPanel', () => {
  it('renders empty state with no selection', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf([])}
        properties={properties}
        routing={routing}
        emptyState={<em>Nothing selected</em>}
      />,
    );
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
  });

  it('shows kind header, sections, and values for a single node', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
      />,
    );
    expect(screen.getByText('Rect')).toBeInTheDocument();
    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByLabelText('X')).toHaveValue('10');
    expect(screen.getByLabelText('Fill')).toHaveValue('#ff0000');
  });

  it('multi-select shows count header and Mixed placeholders', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a', 'b'])}
        properties={properties}
        routing={routing}
      />,
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByText('rect ×2')).toBeInTheDocument();
    expect(screen.getByLabelText('X')).toHaveAttribute('placeholder', 'Mixed');
    expect(screen.getByLabelText('Y')).toHaveValue('20'); // shared value renders
  });

  it('editing a number fans out to every selected node in one undo step', () => {
    const scene = makeScene();
    render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['a', 'b'])}
        properties={properties}
        routing={routing}
      />,
    );
    const y = screen.getByLabelText('Y');
    fireEvent.change(y, { target: { value: '99' } });
    fireEvent.blur(y);
    expect((scene.get(asNodeId('a')) as { pose: Pose }).pose.y).toBe(99);
    expect((scene.get(asNodeId('b')) as { pose: Pose }).pose.y).toBe(99);
    scene.undo();
    expect((scene.get(asNodeId('a')) as { pose: Pose }).pose.y).toBe(20);
    expect((scene.get(asNodeId('b')) as { pose: Pose }).pose.y).toBe(20);
  });

  it('custom renderer overrides a built-in kind', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
        renderers={{ color: (ctx) => <button type="button">custom:{ctx.path}</button> }}
      />,
    );
    expect(screen.getByText('custom:data.fill')).toBeInTheDocument();
  });

  it('kindLabel overrides the header derivation', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
        kindLabel={(k) => `<${k}>`}
      />,
    );
    expect(screen.getByText('<rect>')).toBeInTheDocument();
  });
});
```

Note for the executor: if `scene.undo()` isn't a method on the Scene interface, grep `undo` in `src/core/scene/scene.ts` / `src/index.ts` for the actual undo entry point (e.g. a `useUndoRedo` helper or `scene.undo()`); assert whatever the real API is — the requirement is one undo step reverting both writes.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/SelectionPanel`
Expected: FAIL — `SelectionPanel` not found.

- [ ] **Step 3: Implement `SelectionPanel.tsx`**

```tsx
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  asNodeId,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type Scene,
  type SelectionApi,
  type ToolPrefColor,
  type ToolPrefEnum,
  type ToolPrefLeaf,
  type ToolPrefNumber,
  type ToolPrefString,
} from '@weasel-js/core';
import { ColorField } from '../ColorField';
import { Input } from '../Input';
import { NumberField } from '../NumberField';
import { Select } from '../Select';
import { Switch } from '../Switch';
import {
  MIXED,
  aggregateValue,
  classifyKind,
  effectiveSections,
  kindBreakdown,
  type AnyNode,
  type PanelLeaf,
} from './model';
import s from './SelectionPanel.module.css';

export interface PropertyRenderContext {
  /** Dotted node path of the leaf (`pose.x`, `data.fill`). */
  path: string;
  /** The schema leaf. App renderers narrow it to their own kind shape. */
  pref: ToolPrefLeaf;
  /** Aggregated value across the selection; `undefined` when mixed. */
  value: unknown;
  /** True when selected nodes disagree at this path. */
  mixed: boolean;
  /** Commit a value — fans out to every selected node in one undo step. */
  setValue: (value: unknown) => void;
}

export type PropertyRenderer = (ctx: PropertyRenderContext) => ReactNode;

export interface SelectionPanelProps<TData, TLayer extends string, TPose> {
  /** The scene handle (`useScene`). The panel subscribes itself, so it
   *  re-renders on scene mutations regardless of parent renders. */
  scene: Scene<TData, TLayer, TPose>;
  /** Selection handle (`useSelection`). Only `current` is read. */
  selection: Pick<SelectionApi, 'current'>;
  /** Properties-trait entries, e.g. core's `defaultNodeProperties` /
   *  `inferredNodeProperties` (+ consumer extras). Memoize or hoist. */
  properties: readonly NodePropertiesEntry[];
  /** Routing-trait classifiers used to derive each node's kind — pass
   *  the same list the canvas uses. Memoize or hoist. */
  routing: readonly NodeRoutingEntry[];
  /** Per-kind control overrides / app-defined kinds (PrefsForm-style). */
  renderers?: Record<string, PropertyRenderer>;
  /** Kind → header label. Default: capitalized kind name. */
  kindLabel?: (kind: string) => string;
  /** Rendered when the selection is empty. */
  emptyState?: ReactNode;
  className?: string;
}

const defaultKindLabel = (kind: string): string =>
  kind.length === 0 ? kind : kind[0].toUpperCase() + kind.slice(1);

/**
 * Pre-baked selection properties panel. Shows the selected nodes' kind
 * and the properties-trait schema for that kind; multi-selections show
 * the intersection of the kinds' schemas with per-field Mixed state.
 * Edits commit as one labeled `scene.batch` fan-out per gesture.
 */
export function SelectionPanel<TData, TLayer extends string, TPose>(
  props: SelectionPanelProps<TData, TLayer, TPose>,
) {
  const {
    scene,
    selection,
    properties,
    routing,
    renderers,
    kindLabel = defaultKindLabel,
    emptyState = null,
    className,
  } = props;

  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  const nodes = selection.current
    .map((id) => scene.get(asNodeId(id)))
    .filter((n): n is NonNullable<typeof n> => n != null) as readonly AnyNode[];

  const kinds = nodes.map((n) => classifyKind(n, routing));
  const sections = useMemo(
    () => effectiveSections(kinds, properties),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kinds is
    // rebuilt per render; key on its content.
    [kinds.join(' '), properties],
  );

  if (nodes.length === 0) {
    return <div className={[s.root, className].filter(Boolean).join(' ')}>{emptyState}</div>;
  }

  const commit = (leaf: PanelLeaf, value: unknown): void => {
    const ids = selection.current.map(asNodeId);
    const dot = leaf.path.indexOf('.');
    const head = leaf.path.slice(0, dot);
    const key = leaf.path.slice(dot + 1);
    scene.batch(`Edit ${leaf.leaf.name}`, () => {
      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        if (head === 'pose') {
          scene.setPose(id, { ...(node.pose as object), [key]: value } as TPose);
        } else if (head === 'data') {
          scene.update(id, { data: { ...(node.data as object), [key]: value } as TData });
        }
      }
    });
  };

  return (
    <div className={[s.root, className].filter(Boolean).join(' ')}>
      <header className={s.header}>
        {nodes.length === 1 ? (
          <span className={s.kind}>{kindLabel(kinds[0])}</span>
        ) : (
          <>
            <span className={s.kind}>{nodes.length} selected</span>
            <span className={s.breakdown}>{kindBreakdown(kinds)}</span>
          </>
        )}
      </header>
      {sections.map((section) => (
        <section key={section.key} className={s.section}>
          {section.name !== '' && <h4 className={s.sectionTitle}>{section.name}</h4>}
          {section.rows.map((row) => (
            <div key={row.leaves[0].path} className={s.row}>
              <span className={s.rowLabel}>{row.label}</span>
              <span className={s.rowControls}>
                {row.leaves.map((panelLeaf) => (
                  <LeafControl
                    key={panelLeaf.path}
                    panelLeaf={panelLeaf}
                    nodes={nodes}
                    renderers={renderers}
                    commit={commit}
                  />
                ))}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function LeafControl({
  panelLeaf,
  nodes,
  renderers,
  commit,
}: {
  panelLeaf: PanelLeaf;
  nodes: readonly AnyNode[];
  renderers?: Record<string, PropertyRenderer>;
  commit: (leaf: PanelLeaf, value: unknown) => void;
}) {
  const { path, leaf } = panelLeaf;
  const aggregated = aggregateValue(nodes, path);
  const mixed = aggregated === MIXED;
  const value = mixed ? undefined : aggregated;

  const ctx: PropertyRenderContext = {
    path,
    pref: leaf,
    value,
    mixed,
    setValue: (v) => commit(panelLeaf, v),
  };

  const custom = renderers?.[leaf.kind];
  if (custom) return <>{custom(ctx)}</>;
  return <>{renderBuiltin(ctx)}</>;
}

function renderBuiltin(ctx: PropertyRenderContext): ReactNode {
  const { pref, value, mixed, setValue } = ctx;
  switch (pref.kind) {
    case 'number': {
      const p = pref as ToolPrefNumber;
      const stored = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
      const display = stored !== undefined ? (p.unit ? p.unit.toDisplay(stored) : stored) : NaN;
      return (
        <NumberField
          className={s.number}
          value={mixed || stored === undefined ? NaN : display}
          placeholder={mixed ? 'Mixed' : undefined}
          minValue={p.min}
          maxValue={p.max}
          step={p.step ?? 1}
          hideSteppers
          aria-label={p.name}
          onChange={(n) => {
            if (Number.isNaN(n)) return;
            setValue(p.unit ? p.unit.fromDisplay(n) : n);
          }}
        />
      );
    }
    case 'string': {
      const p = pref as ToolPrefString;
      return (
        <DraftInput
          text={mixed ? undefined : typeof value === 'string' ? value : ''}
          placeholder={mixed ? 'Mixed' : undefined}
          ariaLabel={p.name}
          onCommit={setValue}
        />
      );
    }
    case 'boolean': {
      return (
        <Switch
          isSelected={Boolean(value)}
          onChange={setValue}
          aria-label={pref.name}
        />
      );
    }
    case 'enum': {
      const p = pref as ToolPrefEnum;
      return (
        <Select<string>
          className={s.select}
          options={p.options.map((o) => ({ value: o.value, label: o.label }))}
          selectedKey={mixed ? null : typeof value === 'string' ? value : p.default}
          placeholder="Mixed"
          onSelectionChange={setValue}
          aria-label={p.name}
        />
      );
    }
    case 'color': {
      const p = pref as ToolPrefColor;
      return (
        <ColorField
          value={mixed ? undefined : typeof value === 'string' ? value : p.default}
          mixed={mixed}
          alpha={p.alpha}
          onChange={setValue}
          aria-label={p.name}
        />
      );
    }
    default:
      return <span className={s.unrenderable}>({pref.kind}: no renderer)</span>;
  }
}

/** Text input with commit-on-blur/Enter semantics — live-per-keystroke
 *  writes would emit one undo step per character. */
function DraftInput({
  text,
  placeholder,
  ariaLabel,
  onCommit,
}: {
  text: string | undefined;
  placeholder?: string;
  ariaLabel: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      value={draft ?? text ?? ''}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={setDraft}
      onBlur={() => {
        if (draft !== null && draft !== text) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
```

Executor notes:
- If `Input` doesn't accept `onBlur`/`onKeyDown` (RAC TextField props), check `InputProps` — RAC `TextFieldProps` includes `onBlur`/`onKeyDown`; if not threaded, use the RAC-supported equivalents or wrap in a span with capture handlers. Keep commit-on-blur/Enter semantics.
- RAC `NumberField` commits `onChange` on blur/Enter natively (not per keystroke) — that's why it needs no draft wrapper.
- If `Select` lacks a `placeholder` passthrough rendering for `selectedKey={null}`, accept whatever RAC renders for empty selection; the mixed affordance for enums is secondary.
- If the `useSyncExternalStore` server-snapshot argument trips types, drop the third argument.

- [ ] **Step 4: Implement `SelectionPanel.module.css`**

```css
.root {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  color: var(--wzl-text, #d7d8de);
}

.header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 10px;
  border-block-end: 1px solid var(--wzl-border, #33343c);
}

.kind {
  font-weight: 600;
  font-size: 13px;
}

.breakdown {
  font-size: 11px;
  opacity: 0.6;
}

.section {
  padding: 6px 10px 8px;
  border-block-end: 1px solid var(--wzl-border-subtle, #2a2b31);
}

.section:last-child {
  border-block-end: none;
}

.sectionTitle {
  margin: 0 0 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.55;
}

.row {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 6px;
  align-items: center;
  margin-block-end: 5px;
}

.rowLabel {
  opacity: 0.75;
}

.rowControls {
  display: flex;
  gap: 6px;
  align-items: center;
  min-inline-size: 0;
}

.rowControls > * {
  flex: 1;
  min-inline-size: 0;
}

.number :global(input),
.select {
  font-size: 11px;
}

.unrenderable {
  font-size: 11px;
  opacity: 0.5;
  font-style: italic;
}
```

(If the project's CSS-module setup rejects `:global`, drop that rule — cosmetic only.)

- [ ] **Step 5: `index.ts` + barrel + comment amendment**

`packages/ui/src/components/SelectionPanel/index.ts`:

```ts
export {
  SelectionPanel,
  type SelectionPanelProps,
  type PropertyRenderer,
  type PropertyRenderContext,
} from './SelectionPanel';
export {
  MIXED,
  aggregateValue,
  classifyKind,
  effectiveSections,
  kindBreakdown,
  type Mixed,
  type PanelLeaf,
  type PanelRow,
  type PanelSection,
} from './model';
```

In `packages/ui/src/index.ts`, add `export * from './components/SelectionPanel';` and replace the lines 1–3 header comment with:

```ts
// `@weasel-js/ui` ships generic UI primitives plus scene-aware panels
// that stay generic over consumer data (SelectionPanel). App-specific
// policy panels (LayerList composition, document props) live in their
// consuming app (today: `apps/draw/src/ui/`).
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/SelectionPanel && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/SelectionPanel packages/ui/src/index.ts
git commit -m "feat(ui): SelectionPanel — pre-baked selection properties panel"
```

---

### Task 11: WeaselDraw migration

**Files:**
- Modify: `apps/draw/src/App.tsx` (`RightSidebar`, ~lines 291–475)
- Reference: `apps/draw/src/ui/PropertiesPanel/PropertiesPanel.tsx` (keep — doc branch still uses its primitives)

- [ ] **Step 1: Add imports and module-level constants**

In `App.tsx`, import `SelectionPanel, type PropertyRenderer` from `@weasel-js/ui`, and `inferredNodeProperties, inferredNodeRouting` from `@weasel-js/core`. At module level (near `INITIAL_FILL_COLOR`):

```tsx
/** WeaselDraw's kinds come from the kit's inferred routing (`text` /
 *  `path` / `image` — no `data.kind` tag), so the panel classifies with
 *  the same entries SceneCanvas applies when `routing` is unset. */
const WD_PROPERTIES = inferredNodeProperties;

/** Fill/stroke keep their ActionsRegistry begin/update/end path (drag-
 *  coalesced live preview + one undo entry per gesture) by overriding
 *  the built-in color renderer with the existing PropertyColorInput. */
const wdColorRenderer: PropertyRenderer = (ctx) => {
  const ids =
    ctx.path === 'data.fill'
      ? { color: 'setFill', opacity: 'setFillOpacity' }
      : { color: 'setStroke', opacity: 'setStrokeOpacity' };
  return (
    <PropertyColorInput
      value={typeof ctx.value === 'string' ? ctx.value : '#000000'}
      colorActionId={ids.color}
      opacityActionId={ids.opacity}
    />
  );
};
const WD_RENDERERS: Record<string, PropertyRenderer> = { color: wdColorRenderer };
```

- [ ] **Step 2: Replace the object/no-selection branches of `RightSidebar`**

Replace the `<PropertiesPanel title=...>` block (App.tsx:386–475) with:

```tsx
      <SidebarPanel title={docSelected ? 'Document' : 'Properties'}>
        {docSelected ? (
          <PropertiesGrid>
            <PropertyRow label="file">
              <PropertyTextInput value={filename} placeholder={DEFAULT_FILENAME} onChange={setFilename} />
            </PropertyRow>
            <PropertyRow label="paper">
              <PropertySelect<PaperSizeKey>
                value={paperSize}
                options={[
                  { value: 'letter', label: 'Letter' },
                  { value: 'a4', label: 'A4' },
                  { value: 'legal', label: 'Legal' },
                ]}
                onChange={setPaperSize}
              />
            </PropertyRow>
            <PropertyRow label="bg">
              <PropertyColorInput value={backgroundColor} onChange={setBackgroundColor} />
            </PropertyRow>
          </PropertiesGrid>
        ) : (
          <SelectionPanel
            scene={scene}
            selection={selection}
            properties={WD_PROPERTIES}
            routing={inferredNodeRouting}
            renderers={WD_RENDERERS}
            emptyState={<em className="wd-no-selection">No selection</em>}
          />
        )}
      </SidebarPanel>
```

Add a `.wd-no-selection` rule in the app stylesheet that already holds `wd-` classes (grep `wd-canvas-host` for the file): `padding: 8px; font-size: 12px; opacity: 0.6;` (replaces the removed inline style).

- [ ] **Step 3: Delete dead code**

- Remove the `patchSelection` callback and the `firstSelected` / `selectedCount` / `selectedIds` derivations from `RightSidebar` if nothing else references them (grep within `App.tsx` first).
- Remove now-unused imports (`PropertiesPanel`, `PropertyNumberInput`, … — keep `PropertiesGrid`, `PropertyRow`, `PropertyTextInput`, `PropertySelect`, `PropertyColorInput`, `SidebarPanel`).
- Do NOT delete the `PropertiesPanel.tsx` primitives file — the doc branch and `wdColorRenderer` still use parts of it. After the edit, grep `apps/draw/src` for `PropertyNumberInput|PropertySliderInput|PropertyAxisInput|PropertySwatchGrid|PropertyButton|PropertyMiniLabel|PropertyReadOnly` — remove any of those exports that now have zero references (and their helpers), keeping the ones still used (e.g. by `ColorsPanel`).

- [ ] **Step 4: Verify by tests + typecheck**

Run: `npx tsc --noEmit && npx vitest run --project=draw`
Expected: PASS. If a draw test asserted the old inspector markup, update it to the SelectionPanel equivalents (labels `X`/`Y`/`W`/`H` → `Position`/`Size` rows etc.).

- [ ] **Step 5: Manual smoke check (dev server)**

Run in background: `npm run dev` (or the draw app's dev script — check root `package.json` scripts; memory says `dev:kit` serves the site, draw has its own). Verify with the browser or ask the user to check: select one rect → full schema; select rect+text → intersection + Mixed; fill drag previews live; pose edits fan out; undo once reverts a whole edit.

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src
git commit -m "refactor(draw): RightSidebar object inspector → kit SelectionPanel"
```

---

### Task 12: Registry inspector surfaces the properties trait

**Files:**
- Modify: `apps/draw/src/dev/registryData.ts`
- Modify: `apps/draw/src/dev/registryProbe.tsx` and/or `apps/draw/src/dev/RegistryInspector.tsx` (grep `collectRoutingTrait` for the exact call sites)
- Test: mirror however `collectRoutingTrait` is covered (grep `collectRoutingTrait` in `apps/draw/src/**/*.test.*`; if it has no test, add none)

- [ ] **Step 1: Add the entry type + collector to `registryData.ts`**

Add to the `TreeEntry` union: `| PropertiesKindEntry`, and:

```ts
/** One properties-trait kind. `leafPaths` lists the schema's dotted node
 *  paths so the detail pane can show what the kind exposes. */
export interface PropertiesKindEntry {
  kind: 'propertiesKind';
  trait: 'properties';
  id: string;
  label: string;
  leafPaths: readonly string[];
}

export function collectPropertiesTrait(
  live?: readonly Weasel.NodePropertiesEntry[],
): readonly PropertiesKindEntry[] {
  const source = live ?? Weasel.defaultNodeProperties;
  const flattenPaths = (group: Weasel.ToolPrefGroup): string[] =>
    Object.entries(group.children).flatMap(([key, child]) =>
      'kind' in child ? [key] : flattenPaths(child),
    );
  return source.map((e) => ({
    kind: 'propertiesKind',
    trait: 'properties',
    id: e.name,
    label: e.name,
    leafPaths: flattenPaths(e.schema),
  }));
}
```

- [ ] **Step 2: Wire into the tree**

Grep `collectRoutingTrait` across `apps/draw/src/dev/` and mirror every wiring point for `collectPropertiesTrait`: the probe/snapshot assembly, the `'traits'` parent category in the inspector tree (add a `'properties'` child beside `'shape'` and `'routing'`), and the detail pane's `trait` field handling (render `leafPaths` as the detail body).

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npx vitest run --project=draw`
Expected: PASS.

```bash
git add apps/draw/src/dev
git commit -m "feat(draw): registry inspector lists the properties trait"
```

---

### Task 13: Site demo

**Files:**
- Create: `apps/site/demos/SelectionPanelDemo.tsx`
- Modify: `apps/site/registry.ts` (new entry; put it in the same category as the LayerList demo — grep `LayerList` in `registry.ts`)
- Reference: `apps/site/demos/AlignmentGuidesDemo.tsx` (structure model)

- [ ] **Step 1: Write the demo**

```tsx
import { useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  defaultNodeRouting,
  defaultNodeProperties,
} from '@weasel-js/core';
import { SelectionPanel } from '@weasel-js/ui';
import type { DrawCommand } from '../../../src/renderer';
import type { View } from '../../../src/core/viewport/view';

interface NodeData { kind: string; fill: string; stroke?: string; strokeWidth?: number }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

const W = 460, H = 320;

export function SelectionPanelDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'a' as never, kind: 'leaf', layer: 'default', pose: { x: 60, y: 50, width: 120, height: 80 }, data: { kind: 'rect', fill: '#7fb069ff' } },
      { id: 'b' as never, kind: 'leaf', layer: 'default', pose: { x: 240, y: 90, width: 90, height: 90 }, data: { kind: 'ellipse', fill: '#d98f6fff', stroke: '#5a3d2bff', strokeWidth: 2 } },
      { id: 'c' as never, kind: 'leaf', layer: 'default', pose: { x: 130, y: 190, width: 140, height: 70 }, data: { kind: 'rect', fill: '#6f9fd9ff' } },
    ],
  });
  const selection = useSelection({ mode: 'multi' });
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  return (
    <div className="ckd-row">
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectionMode="multi"
        routing={defaultNodeRouting}
        view={view}
        onViewChange={setView}
        viewport={{}}
        layers={{
          scene: {
            drawOne: (n, p): DrawCommand[] => [{
              kind: 'path',
              path: n.data.kind === 'ellipse'
                ? { kind: 'ellipse', cx: p.x + p.width / 2, cy: p.y + p.height / 2, rx: p.width / 2, ry: p.height / 2 }
                : { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: n.data.fill },
              ...(n.data.stroke ? { stroke: { color: n.data.stroke, width: n.data.strokeWidth ?? 1 } } : {}),
            }],
          },
          selectionOverlay: {},
        }}
      />
      <SelectionPanel
        scene={scene}
        selection={selection}
        properties={defaultNodeProperties}
        routing={defaultNodeRouting}
        emptyState={<em>Click a shape (shift-click for multi)</em>}
        className="ckd-panel"
      />
    </div>
  );
}
```

Executor notes: check `DrawCommand`'s actual path variants (grep `kind: 'ellipse'` in `src/renderer`) — if there's no ellipse path command, draw both nodes as rects and drop the ellipse branch; the demo's point is the panel, not the painter. Check whether existing demos define layout classes (`ckd-row` / `ckd-panel`) in the site stylesheet; if absent, add small rules next to the existing `ckd-canvas` styles (flex row, gap, panel width ~230px, panel background var(--wzl-surface)).

- [ ] **Step 2: Register the demo**

Add to `apps/site/registry.ts` (same category as the LayerList demo):

```ts
  {
    id: 'selection-panel',
    title: 'Selection properties panel',
    category: '<same as LayerList demo>',
    description:
      'SelectionPanel from @weasel-js/ui wired to a scene with the kit\'s pre-baked property schemas (defaultNodeProperties). Click a shape to inspect and edit its kind-specific properties; shift-click several — including different kinds — to see the schema intersection and per-field Mixed state. Edits fan out to the whole selection as one undo step.',
    hint: 'Select shapes and edit X/Y/W/H, fill, stroke. Shift-click a rect and the ellipse for Mixed state.',
    Component: SelectionPanelDemo,
    path: 'apps/site/demos/SelectionPanelDemo.tsx',
  },
```

(Import `SelectionPanelDemo` at the top of the registry; fill `category` with the literal used by the LayerList entry; add `full`/`extras` fields only if the registry's `DemoEntry` type requires them.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run --project=smoke`
Expected: PASS. Then start the site dev server (background) and load the demo to confirm the panel renders and edits work.

- [ ] **Step 4: Commit**

```bash
git add apps/site/demos/SelectionPanelDemo.tsx apps/site/registry.ts
git commit -m "feat(site): selection-panel demo — pre-baked panel on default schemas"
```

---

### Task 14: Full gate + docs

**Files:**
- Modify: `docs/TODO.md` (check for related entries)

- [ ] **Step 1: Run the full release gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all pass (this mirrors `prepublishOnly`). Fix anything that fails before proceeding.

- [ ] **Step 2: TODO.md**

Grep `docs/TODO.md` for `propert|inspector|panel|trait` — if an entry covers this feature, mark it per the repo's TODO retention policy (completed blocks stay only while they have open follow-ups). Add nothing speculative.

- [ ] **Step 3: Commit any doc changes**

```bash
git add docs/TODO.md
git commit -m "docs(todo): selection panel shipped"
```

(Skip the commit if TODO.md needed no change.)

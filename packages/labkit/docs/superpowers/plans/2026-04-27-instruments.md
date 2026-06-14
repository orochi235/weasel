# Labkit Plan 4 — Instruments Subsystem

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the declarative authoring layer for Labkit instruments: the `Instrument<TS, TC>` interface, `defineInstrument()`, `ConfigField` schema types, `<ControlPanel>` component, `RenderContext<TS, TC>`, lifecycle hooks, and `validateConfigSchema()`. Plans 1, 2, and 3 are assumed shipped.

**Architecture:** Two source directories. `src/instrument/` owns the core types, `defineInstrument`, and `validateConfigSchema`. `src/controls/` owns `ConfigField` types and the `<ControlPanel>` component. New exports are wired into `src/index.ts` and a new `controls` entry point. No capabilities runtime (Plan 5) is implemented here; capability interfaces are type-declared only.

**Tech Stack:** Same as Plan 1. No new dependencies. LESS for `ControlPanel.less`. All class names `lk-` prefixed.

**Spec:** `docs/superpowers/specs/2026-04-27-instruments-design.md`

---

## File Structure

After this plan:
```
labkit/
  src/
    instrument/
      types.ts                  # Instrument, RenderContext, capability shapes, SystemEvent
      defineInstrument.ts       # identity function
      validateConfigSchema.ts   # pure validation
      validateConfigSchema.test.ts
      defineInstrument.test.ts
      index.ts
    controls/
      types.ts                  # ConfigField discriminated union + each field type
      ControlPanel.tsx
      ControlPanel.less
      ControlPanel.test.tsx
      ControlPanel.stories.tsx
      index.ts
    index.ts                    # updated: re-exports instrument/* and controls/*
  package.json                  # updated: adds ./controls export entry
```

---

## Task 1: `ConfigField` type declarations

**Files:**
- Create: `src/controls/types.ts`
- Create: `src/controls/index.ts`

- [ ] **Step 1: Write `src/controls/types.ts`**

Declare `ConfigFieldBase`, then one interface per field type (`SliderField`, `CheckboxField`, `SelectField`, `NumberField`, `TextField`, `ColorField`), then the `ConfigField` discriminated union and `ConfigFieldType` alias. Include `SelectOption`. Match the spec §4 exactly.

- [ ] **Step 2: Write `src/controls/index.ts`**

```ts
export type {
  ConfigField,
  ConfigFieldType,
  SliderField,
  CheckboxField,
  SelectField,
  SelectOption,
  NumberField,
  TextField,
  ColorField,
} from './types';
export { ControlPanel } from './ControlPanel';
```

(ControlPanel will be added in Task 3; this file can be written now with the export commented out, or written in full now — the module graph is fine as long as ControlPanel.tsx exists by the time tests run.)

- [ ] **Step 3: Type-check**

Run: `cd ~/src/labkit && npx tsc -b`
Expected: exits 0.

- [ ] **Step 4: Commit**

```
git add src/controls/types.ts src/controls/index.ts
git commit -m "Add ConfigField schema type declarations"
```

---

## Task 2: `Instrument`, `RenderContext`, capability shape declarations

**Files:**
- Create: `src/instrument/types.ts`
- Create: `src/instrument/index.ts`

- [ ] **Step 1: Write `src/instrument/types.ts`**

Declare in order:
1. `SystemEvent` union type (from design spec §7, State section)
2. Capability shapes: `CanvasLayer`, `CanvasCapability`, `LayerCapability`, `DragDropCapability`, `UndoCapability` — typed stubs only; implementations live in Plan 5
3. `RenderContext<TS, TC>` — exact shape from design spec §5
4. `Instrument<TS, TC>` — exact shape from design spec §5

Import `ConfigField` from `../controls/types`. Import `ReactNode` from `react`.

Supporting types needed for capability stubs: `Point`, `HitResult`, `ViewTransform`, `LayerDescriptor`, `PaletteItem`, `DragFeedback`. Declare these as minimal type aliases (`type Point = { x: number; y: number }`, etc.) inside this file or a `src/instrument/capabilityTypes.ts` helper.

- [ ] **Step 2: Write `src/instrument/index.ts`**

```ts
export type {
  Instrument,
  RenderContext,
  CanvasCapability,
  CanvasLayer,
  LayerCapability,
  DragDropCapability,
  UndoCapability,
  SystemEvent,
  Point,
  HitResult,
  ViewTransform,
  LayerDescriptor,
  PaletteItem,
  DragFeedback,
} from './types';
export { defineInstrument } from './defineInstrument';
export { validateConfigSchema } from './validateConfigSchema';
```

(defineInstrument and validateConfigSchema will be added in Tasks 3–4.)

- [ ] **Step 3: Type-check**

Run: `cd ~/src/labkit && npx tsc -b`
Expected: exits 0.

- [ ] **Step 4: Commit**

```
git add src/instrument/types.ts src/instrument/index.ts
git commit -m "Add Instrument, RenderContext, and capability type declarations"
```

---

## Task 3: `defineInstrument`

**Files:**
- Create: `src/instrument/defineInstrument.ts`
- Create: `src/instrument/defineInstrument.test.ts`

- [ ] **Step 1: Write failing test `src/instrument/defineInstrument.test.ts`**

Tests:
- Returns the exact same object reference passed in
- TypeScript: calling `defineInstrument({ name: 'X', ... })` infers the correct `TS` and `TC` (use `expectTypeOf` from vitest to assert)

Run: `cd ~/src/labkit && npx vitest run src/instrument/defineInstrument.test.ts`
Expected: test file collected, tests fail (module not found).

- [ ] **Step 2: Write `src/instrument/defineInstrument.ts`**

```ts
import type { Instrument } from './types';

export function defineInstrument<TS, TC>(spec: Instrument<TS, TC>): Instrument<TS, TC> {
  return spec;
}
```

- [ ] **Step 3: Run tests — expect pass**

Run: `cd ~/src/labkit && npx vitest run src/instrument/defineInstrument.test.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```
git add src/instrument/defineInstrument.ts src/instrument/defineInstrument.test.ts
git commit -m "Add defineInstrument type-passthrough function with tests"
```

---

## Task 4: `validateConfigSchema`

**Files:**
- Create: `src/instrument/validateConfigSchema.ts`
- Create: `src/instrument/validateConfigSchema.test.ts`

- [ ] **Step 1: Write failing tests `src/instrument/validateConfigSchema.test.ts`**

Cover every validation rule from the spec §8.2:
- Valid schema returns `{ valid: true, errors: [] }`
- Duplicate keys
- Unknown field type
- Slider min >= max
- Slider default outside [min, max]
- Select with empty options
- Select with duplicate option values
- Select default not in options
- Non-finite number/slider default
- Empty key string
- Empty label string
- Multiple errors collected in a single call (schema with two distinct errors returns both)

Run: `cd ~/src/labkit && npx vitest run src/instrument/validateConfigSchema.test.ts`
Expected: tests collected, fail (module not found).

- [ ] **Step 2: Write `src/instrument/validateConfigSchema.ts`**

Implement all rules from spec §8.2. Return type is `ValidationResult` (declare it in this file or in `types.ts` — either is fine, but export it from `src/instrument/index.ts`).

- [ ] **Step 3: Run tests — expect pass**

Run: `cd ~/src/labkit && npx vitest run src/instrument/validateConfigSchema.test.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```
git add src/instrument/validateConfigSchema.ts src/instrument/validateConfigSchema.test.ts
git commit -m "Add validateConfigSchema with full rule coverage"
```

---

## Task 5: `<ControlPanel>` — Slider and Checkbox fields

**Files:**
- Create: `src/controls/ControlPanel.tsx` (partial — slider + checkbox only)
- Create: `src/controls/ControlPanel.less` (scaffolded)
- Create: `src/controls/ControlPanel.test.tsx` (partial)

Split the component implementation across Tasks 5–7 by field type group to keep each task under 15 minutes.

- [ ] **Step 1: Write failing tests for slider and checkbox**

`src/controls/ControlPanel.test.tsx` — test cases:
- Slider: renders `<input type="range">`; `min`, `max`, `step` attributes set correctly; firing `onChange` calls `setConfig(key, Number(value))`; numeric value label is present in DOM and matches initial config value
- Checkbox: renders `<input type="checkbox">`; `checked` matches `config[key]`; `onChange` calls `setConfig(key, event.target.checked)`
- Label text appears adjacent to each input

Run: `cd ~/src/labkit && npx vitest run src/controls/ControlPanel.test.tsx`
Expected: tests collected, fail (module not found).

- [ ] **Step 2: Scaffold `src/controls/ControlPanel.less`**

Create the file with BEM-style selectors:
```less
.lk-control-panel { ... }
.lk-control-row { ... }
.lk-control-label { ... }
.lk-control-input { ... }
.lk-control-slider-value { ... }
```
No visual polish required — just structure. Real tokens used (`var(--lk-spacing-sm)`, etc.).

- [ ] **Step 3: Write `src/controls/ControlPanel.tsx` (slider + checkbox)**

Implement the component with a `switch (field.type)` dispatch. For this task, handle `'slider'` and `'checkbox'` cases; all other cases fall through to `null`.

Props: `ControlPanelProps<TC>` as defined in spec §5.1. Import `ControlPanel.less`.

- [ ] **Step 4: Run tests — expect pass for slider and checkbox cases**

Run: `cd ~/src/labkit && npx vitest run src/controls/ControlPanel.test.tsx`
Expected: slider and checkbox tests pass.

- [ ] **Step 5: Commit**

```
git add src/controls/ControlPanel.tsx src/controls/ControlPanel.less src/controls/ControlPanel.test.tsx
git commit -m "Add ControlPanel with slider and checkbox field rendering"
```

---

## Task 6: `<ControlPanel>` — Select, Number, and Text fields

**Files:**
- Modify: `src/controls/ControlPanel.tsx`
- Modify: `src/controls/ControlPanel.test.tsx`

- [ ] **Step 1: Add failing tests for select, number, text**

Append to `ControlPanel.test.tsx`:
- Select: renders `<select>` with correct `<option>` elements; `onChange` calls `setConfig(key, value)` with the selected string
- Number: renders `<input type="number">`; initial `value` matches config; `onChange` calls `setConfig`; `onBlur` clamps to `[min, max]` when both are defined
- Text: renders `<input type="text">`; `onChange` calls `setConfig(key, value)` live; `placeholder` and `maxLength` attributes set when provided

Run: `cd ~/src/labkit && npx vitest run src/controls/ControlPanel.test.tsx`
Expected: new tests fail; slider/checkbox tests still pass.

- [ ] **Step 2: Implement select, number, text cases in `ControlPanel.tsx`**

Add `'select'`, `'number'`, `'text'` branches to the switch.

- [ ] **Step 3: Run all ControlPanel tests — expect pass**

Run: `cd ~/src/labkit && npx vitest run src/controls/ControlPanel.test.tsx`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```
git add src/controls/ControlPanel.tsx src/controls/ControlPanel.test.tsx
git commit -m "Add select, number, and text field rendering to ControlPanel"
```

---

## Task 7: `<ControlPanel>` — Color field and defensive unknown type

**Files:**
- Modify: `src/controls/ControlPanel.tsx`
- Modify: `src/controls/ControlPanel.test.tsx`

- [ ] **Step 1: Add failing tests for color and unknown type**

Append to `ControlPanel.test.tsx`:
- Color: renders `<input type="color">`; `value` attribute matches config value; `onChange` calls `setConfig(key, value)` with the hex string
- Unknown type: a field object with an unrecognized `type` value causes the row to render nothing (no crash, no visible output)

Run: `cd ~/src/labkit && npx vitest run src/controls/ControlPanel.test.tsx`
Expected: new tests fail.

- [ ] **Step 2: Implement color case and default/unknown-type fallback**

Add `'color'` branch. The `default` branch in the switch returns `null`.

- [ ] **Step 3: Run all ControlPanel tests — expect all pass**

Run: `cd ~/src/labkit && npx vitest run src/controls/ControlPanel.test.tsx`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```
git add src/controls/ControlPanel.tsx src/controls/ControlPanel.test.tsx
git commit -m "Add color field and defensive unknown-type fallback to ControlPanel"
```

---

## Task 8: Storybook stories for `<ControlPanel>`

**Files:**
- Create: `src/controls/ControlPanel.stories.tsx`

- [ ] **Step 1: Write `src/controls/ControlPanel.stories.tsx`**

Two stories:
1. **Default** — shows all six field types using inline `useState` to simulate controlled behavior. Use realistic field definitions (frequency slider, amplitude slider, show-grid checkbox, color picker, a select for waveform type, a text field for a title).
2. **Minimal** — slider + checkbox only, minimal config.

Each story uses `useState` for `config`; `setConfig` calls `setState` on the local copy. No Zustand dependency.

- [ ] **Step 2: Verify Storybook builds without errors**

Run: `cd ~/src/labkit && npm run build-storybook 2>&1 | tail -20`
Expected: exits 0, `storybook-static/` created.

- [ ] **Step 3: Commit**

```
git add src/controls/ControlPanel.stories.tsx
git commit -m "Add ControlPanel Storybook stories (Default and Minimal)"
```

---

## Task 9: Wire exports — update `src/index.ts` and `package.json`

**Files:**
- Modify: `src/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Add instrument and controls exports to `src/index.ts`**

Re-export everything from `./instrument/index` and `./controls/index` (types + `defineInstrument` + `validateConfigSchema` + `ControlPanel`).

- [ ] **Step 2: Add `./controls` entry to `package.json` exports**

```json
"./controls": {
  "types": "./dist/controls/index.d.ts",
  "import": "./dist/controls/index.js"
}
```

- [ ] **Step 3: Type-check the full project**

Run: `cd ~/src/labkit && npx tsc -b`
Expected: exits 0.

- [ ] **Step 4: Verify library build succeeds**

Run: `cd ~/src/labkit && npm run build`
Expected: `dist/` populated; `dist/index.js`, `dist/controls/index.js`, `dist/index.d.ts`, `dist/controls/index.d.ts` present.

Spot-check: `grep -l 'defineInstrument\|ControlPanel' dist/index.js dist/controls/index.js`
Expected: both files found.

- [ ] **Step 5: Commit**

```
git add src/index.ts package.json
git commit -m "Wire instrument and controls exports; add ./controls package entry"
```

---

## Task 10: Full test run and coverage check

**Files:** None created. Validation task.

- [ ] **Step 1: Run full test suite**

Run: `cd ~/src/labkit && npm test`
Expected: all tests pass; 0 failures.

- [ ] **Step 2: Check coverage for new modules**

Run: `cd ~/src/labkit && npx vitest run --coverage --reporter=text 2>&1 | grep -E 'instrument|controls'`
Expected: `src/instrument/` and `src/controls/` both show ≥ 70% line coverage.

If coverage is below 70%, identify uncovered branches in `validateConfigSchema` or `ControlPanel` and add targeted tests before proceeding.

- [ ] **Step 3: Run lint**

Run: `cd ~/src/labkit && npm run lint`
Expected: exits 0 (no biome errors; class prefix check passes for all new `.tsx` files).

- [ ] **Step 4: Commit any coverage-gap tests added in Step 2**

If new tests were added: `git add src/... && git commit -m "Improve test coverage for instrument and controls modules"`

---

## Task 11: Smoke test — SineWave instrument end-to-end

**Files:**
- Create: `src/instrument/SineWave.smoke.test.tsx`

This task verifies that a real instrument definition compiles, validates cleanly, and that its `render` output can be mounted in a test harness.

- [ ] **Step 1: Write `src/instrument/SineWave.smoke.test.tsx`**

```
- Define SineWaveInstrument inline (matching the spec §9 worked example exactly)
- Call validateConfigSchema(SineWaveInstrument.configSchema()) and assert valid: true
- Call SineWaveInstrument.initialState(SineWaveInstrument.defaultConfig()) and assert { frame: 0 }
- Call SineWaveInstrument.onConfigChange!({ frequency: 5, amplitude: 0.5, showGrid: true }, { frequency: 2, amplitude: 0.5, showGrid: true }, { frame: 3 }) and assert { frame: 0 }
- Call serialize({ frame: 7 }) and assert the result is { frame: 7 }
- Call deserialize({ frame: 7 }) and assert { frame: 7 }
- Call deserialize({}) and assert { frame: 0 } (missing field fallback)
- Mount instrument.render() with a minimal RenderContext stub (state, config, setState as vi.fn(), setConfig as vi.fn(), workspace stub, emit as vi.fn()) and assert the rendered output contains a .lk-sine-wave element
```

- [ ] **Step 2: Run smoke test**

Run: `cd ~/src/labkit && npx vitest run src/instrument/SineWave.smoke.test.tsx`
Expected: all assertions pass.

- [ ] **Step 3: Commit**

```
git add src/instrument/SineWave.smoke.test.tsx
git commit -m "Add SineWave smoke test for full instrument contract end-to-end"
```

---

## Completion Checklist

Before declaring Plan 4 done, verify:

- [ ] `npx tsc -b` exits 0
- [ ] `npm test` exits 0, all tests pass
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0; `dist/controls/index.js` exists
- [ ] `npm run build-storybook` exits 0; ControlPanel Default and Minimal stories visible
- [ ] `validateConfigSchema` covers all 10 error rules with dedicated tests
- [ ] `<ControlPanel>` renders all 6 field types and the unknown-type defensive case
- [ ] SineWave smoke test passes end-to-end
- [ ] All new `className=` literals in `src/controls/` begin with `lk-`

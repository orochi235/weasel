# Instruments — Design Spec

**Date:** 2026-04-27
**Status:** Draft (unattended Claude default — review before implementation)
**Depends on:** Plan 1 (Foundation), Plan 2 (state-runtime), Plan 3 (lab-workspace)
**Builds toward:** Plan 5 (capabilities)
**Package paths:** `src/instrument/`, `src/controls/`, `@labkit/react`, `@labkit/react/controls`

---

## 1. Summary

The instruments subsystem is the declarative authoring layer for what runs inside a `<Workspace>`. It lets consumers define self-contained interactive experiments — their configuration schema, initial state, rendering, and lifecycle — without touching internal runtime machinery.

Key deliverables:

- **`Instrument<TS, TC>` interface** — the full contract a consumer implements
- **`defineInstrument<TS, TC>()`** — type-level passthrough for inference convenience
- **`ConfigField` schema types** — a discriminated union describing each control type; used by `<ControlPanel>` and by `validateConfigSchema`
- **`<ControlPanel>`** — a schema-driven React component that renders the right input for each `ConfigField` and calls back on change
- **`RenderContext<TS, TC>`** — the object `<Workspace>` hands to `instrument.render()` on every render
- **Lifecycle hooks** — `onConfigChange`, `serialize`, `deserialize`; where and when `<Workspace>` calls them
- **`validateConfigSchema()`** — pure validation function called at instrument registration time
- **Capability type stubs** — `CanvasCapability`, `LayerCapability`, `DragDropCapability`, `UndoCapability` are declared here as typed shapes; their runtime is Plan 5

The subsystem is intentionally thin on runtime. It defines contracts and provides the `<ControlPanel>` leaf component. Heavy wiring (store subscription, undo dispatch, canvas rendering) lives in Plan 2/3/5.

---

## 2. Public API

### Exports from `@labkit/react`

```ts
export { defineInstrument } from './instrument/defineInstrument';
export type {
  Instrument,
  RenderContext,
  CanvasCapability,
  CanvasLayer,
  LayerCapability,
  DragDropCapability,
  UndoCapability,
  SystemEvent,
} from './instrument/types';
export { validateConfigSchema } from './instrument/validateConfigSchema';
```

### Exports from `@labkit/react/controls`

```ts
export { ControlPanel } from './controls/ControlPanel';
export type {
  ConfigField,
  SliderField,
  CheckboxField,
  SelectField,
  NumberField,
  TextField,
  ColorField,
} from './controls/types';
```

---

## 3. `defineInstrument` — What It Does, What It Returns

```ts
function defineInstrument<TS, TC>(spec: Instrument<TS, TC>): Instrument<TS, TC> {
  return spec;
}
```

`defineInstrument` is a **type-level identity function**. Its sole value is enabling TypeScript to infer `TS` and `TC` from the object literal passed in, so the consumer gets typed `state` and `config` throughout the instrument without manually annotating them.

**CLAUDE'S DEFAULT:** `defineInstrument` does **not** call `validateConfigSchema` at runtime (no side-effects). Validation happens at a separate registration call site inside `<Lab>` / `<Workspace>` (Plan 3). Rationale: tree-shaking friendliness; instruments defined in modules but never registered should not pay any runtime cost.

**CLAUDE'S DEFAULT:** `defineInstrument` returns the spec object unchanged (no `Object.freeze` or defensive copy). Instruments are intended to be defined once at module scope and treated as constants.

---

## 4. `ConfigField` Schema

`ConfigField` is a discriminated union on `type`. Every field carries the common base properties plus type-specific extras.

### 4.1 Common Base

```ts
interface ConfigFieldBase {
  key: string;       // matches a key of TC; unique within a schema
  label: string;     // display label shown above or beside the control
  type: ConfigFieldType;
}
```

### 4.2 Field Types

#### `slider`

```ts
interface SliderField extends ConfigFieldBase {
  type: 'slider';
  default: number;
  min: number;
  max: number;
  step?: number;       // default: 1
}
```

Renders: `<input type="range">` with `min`, `max`, `step`.

**CLAUDE'S DEFAULT:** The current numeric value is displayed as a read-only text label to the right of the slider track (e.g., `5`). No separate `<input type="number">` for direct entry in v0.

**CLAUDE'S DEFAULT:** `step` defaults to `1` when absent.

#### `checkbox`

```ts
interface CheckboxField extends ConfigFieldBase {
  type: 'checkbox';
  default: boolean;
}
```

Renders: `<input type="checkbox">` with `label` on the right.

#### `select`

```ts
interface SelectOption {
  value: string;
  label: string;
}

interface SelectField extends ConfigFieldBase {
  type: 'select';
  default: string;
  options: SelectOption[];
}
```

Renders: `<select>` with one `<option>` per entry.

**CLAUDE'S DEFAULT:** `select` does **not** support optgroups in v0. A flat `options` array is the only form. Add optgroup support later if a real instrument needs it.

**CLAUDE'S DEFAULT:** `options` must be a static array (no function form). Dynamic options (state-dependent) require an `Instrument.render()` that builds its own `<select>` directly.

#### `number`

```ts
interface NumberField extends ConfigFieldBase {
  type: 'number';
  default: number;
  min?: number;
  max?: number;
  step?: number;
}
```

Renders: `<input type="number">`. Distinct from `slider` — used when a precise typed value is more appropriate than a drag gesture.

**CLAUDE'S DEFAULT:** `onChange` fires on every keystroke (uncontrolled input converted to controlled via local state). Values outside `[min, max]` are clamped on blur, not while typing.

#### `text`

```ts
interface TextField extends ConfigFieldBase {
  type: 'text';
  default: string;
  placeholder?: string;
  maxLength?: number;
  /** Milliseconds to debounce live `setConfig` calls. Default 150 ms. Set to 0 to disable. */
  debounceMs?: number;
}
```

Renders: `<input type="text">`.

**Decision (resolved):** `setConfig` is debounced by **150 ms** by default (overridable via `debounceMs`). Live updates remain responsive but avoid storing one record per keystroke. Instruments needing finer control can set `debounceMs: 0` for live updates.

#### `color`

```ts
interface ColorField extends ConfigFieldBase {
  type: 'color';
  default: string;   // CSS hex string, e.g. "#3a86ff"
}
```

Renders: native `<input type="color">`.

**CLAUDE'S DEFAULT:** Uses native `<input type="color">`, not a custom picker. No alpha channel support in v0. If an instrument needs alpha or a richer picker it provides its own `render()`.

### 4.3 Discriminated Union

```ts
type ConfigField =
  | SliderField
  | CheckboxField
  | SelectField
  | NumberField
  | TextField
  | ColorField;

type ConfigFieldType = ConfigField['type'];
```

### 4.4 Type-safe `defaultConfig` helper (informational)

Instruments should implement `defaultConfig()` by reading `configSchema()`:

```ts
defaultConfig: () => ({
  frequency: 2,
  showGrid: true,
}),
```

There is no runtime helper that auto-derives `defaultConfig` from `configSchema`; the instrument author writes both and they must agree. **CLAUDE'S DEFAULT:** A future plan may add `deriveDefaultConfig(fields)` as a convenience; not in scope here.

---

## 5. `<ControlPanel>` Component

### 5.1 Props

```ts
interface ControlPanelProps<TC extends Record<string, unknown>> {
  fields: ConfigField[];
  config: TC;
  setConfig: (key: keyof TC, value: unknown) => void;
  className?: string;   // merged onto the root element
}
```

`<ControlPanel>` is a **pure presentational component** — it has no internal state for config values (they are fully controlled via `config` + `setConfig`).

**CLAUDE'S DEFAULT:** The `slider` field maintains one piece of local React state for the displayed number label (derived from `config[field.key]`). This is purely presentational; the canonical value is always `config[field.key]`.

### 5.2 Layout

`<ControlPanel>` renders a `<div className="lk-control-panel">` containing one `<div className="lk-control-row">` per field. Each row has:

- `<label className="lk-control-label">` — the field's `label` string
- The appropriate input element with `className="lk-control-input"`

**CLAUDE'S DEFAULT:** `<ControlPanel>` does **not** support sections or groups in v0. All fields render in a single flat vertical list. Add grouping (e.g., a `group` property on `ConfigFieldBase`) in a later plan if a real instrument needs it.

**CLAUDE'S DEFAULT:** `<ControlPanel>` does not render a heading or title of its own. If a heading is needed, the parent (`<Workspace>` sidebar or a custom layout) supplies it.

### 5.3 Integration with `useExperimentState`

`<ControlPanel>` is a **primitive** — it does not call `useExperimentState` or any Zustand hook directly. It receives `config` and `setConfig` as props. The caller (`<Workspace>`, a story, or a consumer app) is responsible for wiring those props to the store.

Inside `<Workspace>` (Plan 3), the wiring looks like:

```tsx
const { config, setConfig } = useExperimentState(workspaceId);
<ControlPanel fields={instrument.configSchema()} config={config} setConfig={setConfig} />
```

### 5.4 `setConfig` unknown key behavior

**Decision (resolved):** Plan 4 adds a dev-mode guard. `<ControlPanel>` and `useExperimentState`'s `setConfig` (when called with an instrument-aware wrapper exposed by Plan 4) check that the key exists in the active workspace's `config` object. If it doesn't, a `console.warn` is emitted in dev mode (`process.env.NODE_ENV !== 'production'`) and the call still proceeds. This catches typos in custom controls without breaking runtime behavior. The Plan 2 store remains permissive — the guard lives at the instrument boundary where the schema is known.

### 5.5 Storybook

`src/controls/ControlPanel.stories.tsx` ships a Default story showing all six field types, plus a Minimal story (slider + checkbox only). Stories use inline `useState` to simulate controlled behavior without the full state runtime.

---

## 6. `RenderContext<TS, TC>` — Construction Site

### 6.1 Shape (from design spec §5)

```ts
interface RenderContext<TS, TC> {
  state: TS;
  config: TC;
  setState: (next: TS | ((prev: TS) => TS)) => void;
  setConfig: (key: keyof TC, value: unknown) => void;
  workspace: {
    id: string;
    zoom: number;
    setZoom: (z: number) => void;
  };
  emit: (event: string) => void;
}
```

### 6.2 Construction inside `<Workspace>` (Plan 3)

`<Workspace>` builds a `RenderContext` on each render cycle and passes it to `instrument.render(ctx)`. The construction pulls values from two sources:

1. **Per-workspace Zustand slice** (Plan 2) — provides `state`, `config`, `setState`, `setConfig`
2. **`<Workspace>` own props / local state** — provides `workspace.id`, `workspace.zoom`, `workspace.setZoom`

Pseudo-code:

```ts
// Inside Workspace.tsx (Plan 3)
const { state, config, setState, setConfig } = useExperimentState(workspaceId);
const [zoom, setZoom] = useWorkspaceView(workspaceId);

const ctx: RenderContext<TS, TC> = {
  state,
  config,
  setState,
  setConfig,
  workspace: { id: workspaceId, zoom, setZoom },
  emit: (event) => emitSystemEvent(workspaceId, event),
};

return instrument.render(ctx);
```

`emitSystemEvent` is Plan 2's event bus hook; it dispatches a string event that the `UndoCapability.snapshotOn` listener watches.

### 6.3 Lifecycle

`RenderContext` is a plain object constructed on each React render. It is **not memoized** by default. Instruments that need referential stability for callbacks should memoize inside their own `render` function.

**CLAUDE'S DEFAULT:** `setState` and `setConfig` are stable function references (created once per workspace via `useCallback` in Plan 2/3). `emit` is also stable. `workspace.setZoom` is stable per workspace. Only `state` and `config` change identity on updates.

---

## 7. Lifecycle Hooks

### 7.1 `onConfigChange`

```ts
onConfigChange?: (config: TC, prev: TC, state: TS) => TS;
```

Called by `<Workspace>` (via Plan 2 store action) **after** a `setConfig` call changes any config value. Returns the new `state` — this allows the instrument to derive updated state from the new config (e.g., recalculate a data structure).

**Call site (Plan 3):**

```ts
// Inside the store's setConfig action (Plan 2):
const newConfig = { ...prev.config, [key]: value };
const newState = instrument.onConfigChange
  ? instrument.onConfigChange(newConfig, prev.config, prev.state)
  : prev.state;
store.setState({ config: newConfig, state: newState });
```

**CLAUDE'S DEFAULT:** `onConfigChange` is called synchronously inside the Zustand action, not in a React effect. This keeps config + state updates atomic and avoids a double-render.

**CLAUDE'S DEFAULT:** If `onConfigChange` throws, the error is not caught by the library. Instruments are responsible for their own error handling.

### 7.2 `serialize`

```ts
serialize?: (state: TS) => unknown;
```

Called by the persistence layer (Plan 2) when writing workspace state to a `StorageAdapter`. The return value must be JSON-serializable.

**CLAUDE'S DEFAULT:** If `serialize` is absent, the persistence layer falls back to the state value directly (equivalent to `(s) => s`). Combined with `JSON.stringify` in the storage adapter, this is effectively `JSON.stringify(state)`.

**CLAUDE'S DEFAULT:** `serialize` is called once per save/persist operation, not on every `setState`. The persistence layer throttles writes (Plan 2 detail).

### 7.3 `deserialize`

```ts
deserialize?: (data: unknown) => TS;
```

Called by the persistence layer when reading workspace state back from a `StorageAdapter`. The `data` argument is the value that `serialize` previously returned (after passing through `JSON.parse`).

**CLAUDE'S DEFAULT:** If `deserialize` is absent, the persistence layer casts `data` directly to `TS` with no transformation (equivalent to `(d) => d as TS`). Instruments with non-trivially-serializable state (e.g., `Map`, `Set`, class instances) must provide `deserialize`.

**CLAUDE'S DEFAULT:** If `deserialize` throws (e.g., data is from an older version), the workspace falls back to `instrument.initialState(currentConfig)` and logs a console warning. No crash.

### 7.4 Undo snapshot hooks

`undo.snapshot` and `undo.restore` are capability-level hooks defined on `UndoCapability` (Plan 5 runtime). They are typed here but not called by this subsystem.

---

## 8. Validation — `validateConfigSchema`

### 8.1 Signature

```ts
function validateConfigSchema(fields: ConfigField[]): ValidationResult;

interface ValidationResult {
  valid: boolean;
  errors: string[];   // empty when valid
}
```

### 8.2 Rules checked

| Rule | Error message |
|---|---|
| Duplicate `key` values | `"Duplicate config key: \"<key>\""` |
| `type` is not a known `ConfigFieldType` | `"Unknown field type: \"<type>\" on key \"<key>\""` |
| `slider` with `min >= max` | `"Slider \"<key>\": min must be < max"` |
| `slider` with `default` outside `[min, max]` | `"Slider \"<key>\": default <n> is outside [min, max]"` |
| `select` with empty `options` | `"Select \"<key>\": options array must not be empty"` |
| `select` with duplicate option values | `"Select \"<key>\": duplicate option value \"<v>\""` |
| `select` with `default` not in `options` | `"Select \"<key>\": default \"<v>\" is not among options"` |
| `number` / `slider` with non-finite `default` | `"Field \"<key>\": default must be a finite number"` |
| `key` is empty string | `"Field has empty key"` |
| `label` is empty string | `"Field \"<key>\" has empty label"` |

**CLAUDE'S DEFAULT:** `validateConfigSchema` does **not** throw on invalid input. It returns `{ valid: false, errors: [...] }`. The caller (the `<Lab>` registration site in Plan 3) decides whether to throw, warn, or ignore.

**CLAUDE'S DEFAULT:** `validateConfigSchema` collects **all** errors, not just the first. This makes debugging easier during development.

### 8.3 Call site

`validateConfigSchema` is called inside the `<Lab>` component (Plan 3) when an instrument is registered, in development mode only:

```ts
if (import.meta.env.DEV) {
  const result = validateConfigSchema(instrument.configSchema());
  if (!result.valid) {
    console.error(
      `[labkit] Invalid config schema for instrument "${instrument.name}":`,
      result.errors,
    );
  }
}
```

**CLAUDE'S DEFAULT:** In production builds, `validateConfigSchema` is dead-code-eliminated by the `import.meta.env.DEV` guard. It is still exported for consumers who want to call it in their own tests.

---

## 9. Worked Example — Sine Wave Renderer

A simple instrument with a frequency slider, an amplitude slider, and a "show grid" checkbox. No canvas capability — just a `render` function returning JSX.

### 9.1 Types

```ts
interface SineState {
  frame: number;
}

interface SineConfig {
  frequency: number;
  amplitude: number;
  showGrid: boolean;
}
```

### 9.2 Instrument definition

```ts
import { defineInstrument } from '@labkit/react';

export const SineWaveInstrument = defineInstrument<SineState, SineConfig>({
  name: 'Sine Wave',

  configSchema: () => [
    { key: 'frequency', label: 'Frequency', type: 'slider', min: 0.1, max: 10, step: 0.1, default: 2 },
    { key: 'amplitude', label: 'Amplitude', type: 'slider', min: 0.1, max: 1,  step: 0.05, default: 0.5 },
    { key: 'showGrid',  label: 'Show grid', type: 'checkbox', default: true },
  ],

  defaultConfig: () => ({ frequency: 2, amplitude: 0.5, showGrid: true }),

  initialState: () => ({ frame: 0 }),

  render({ state, config, setState }) {
    const points = computeSinePoints(config.frequency, config.amplitude, state.frame);
    return (
      <div className="lk-sine-wave">
        {config.showGrid && <Grid />}
        <SvgPath points={points} />
        <button
          className="lk-sine-wave-step"
          onClick={() => setState((s) => ({ ...s, frame: s.frame + 1 }))}
        >
          Step
        </button>
      </div>
    );
  },

  onConfigChange(config, _prev, state) {
    // Reset frame when frequency changes so the wave starts clean
    return { ...state, frame: 0 };
  },

  serialize: (state) => ({ frame: state.frame }),
  deserialize: (data) => {
    const d = data as { frame?: number };
    return { frame: typeof d.frame === 'number' ? d.frame : 0 };
  },
});
```

### 9.3 Embedding in a Lab

```tsx
import { Lab } from '@labkit/react';
import { SineWaveInstrument } from './SineWaveInstrument';

export function App() {
  return (
    <Lab
      instruments={[SineWaveInstrument]}
      defaultInstrument="Sine Wave"
      storageKey="sine-demo"
    />
  );
}
```

### 9.4 What `<Workspace>` does with it

1. Calls `instrument.configSchema()` to get the three `ConfigField`s.
2. Calls `validateConfigSchema(fields)` in dev mode.
3. Hydrates initial state: `instrument.initialState(instrument.defaultConfig())`.
4. On each render: constructs a `RenderContext<SineState, SineConfig>` and calls `instrument.render(ctx)`.
5. Renders the return value of `render` in the workspace body.
6. Renders `<ControlPanel fields={fields} config={config} setConfig={setConfig} />` in the workspace sidebar.
7. When `setConfig('frequency', 3)` fires (from the slider): calls `onConfigChange` to derive new state.
8. On save: calls `serialize(state)` and writes to the storage adapter.
9. On load: reads from storage, calls `deserialize(data)` to recover `SineState`.

---

## 10. Testing Strategy

### 10.1 Pure functions

| Unit | What to test |
|---|---|
| `validateConfigSchema` | All error rules individually; a valid schema returns `{ valid: true, errors: [] }`; duplicate keys; unknown type |
| `defineInstrument` | Returns the same object reference; TypeScript types inferred (compile-time check via `tsd` or `expect-type`) |

### 10.2 `<ControlPanel>` component

Test with `@testing-library/react`. One test file per field type (or a parameterized suite):

- Slider: renders `<input type="range">`; firing `onChange` calls `setConfig(key, Number(value))`; value label updates.
- Checkbox: renders `<input type="checkbox">`; firing `onChange` calls `setConfig(key, checked)`.
- Select: renders `<select>`; `onChange` calls `setConfig(key, value)`.
- Number: renders `<input type="number">`; clamping on blur.
- Text: renders `<input type="text">`; live `onChange` calls `setConfig`.
- Color: renders `<input type="color">`; `onChange` calls `setConfig`.
- All fields: `label` text appears in the DOM.
- Unknown/future field type: component renders nothing for the row (defensive), does not throw.

### 10.3 Integration (Plan 3 scope, referenced here)

A test that wires a full `SineWaveInstrument` inside a `<Workspace>` with the memory storage adapter:

- Adjusting the frequency slider calls `onConfigChange` and resets `frame` to 0.
- Saving and loading round-trips state through `serialize`/`deserialize`.

### 10.4 Coverage target

70%+ for `src/instrument/` and `src/controls/`, consistent with the project-wide target.

---

## 11. Open Decisions (CLAUDE'S DEFAULT — review before implementation)

1. **Slider value display** — Current value is shown as a plain text label to the right of the range input. Should it be an editable `<input type="number">` instead?
2. **Select optgroups** — Flat options only. Any real instrument needing optgroups should file a requirement.
3. **Color field** — Native `<input type="color">` (no alpha, limited browser UI). Upgrade to a custom picker?
4. **ControlPanel sections/grouping** — No groups in v0. Should `ConfigFieldBase` reserve a `group?: string` property now to avoid a future breaking change?
5. ~~**`setConfig` unknown key**~~ — **RESOLVED:** dev-mode `console.warn` when key is not in the workspace config. Implemented in Plan 4 at the instrument boundary (see §5.4).
6. **`defineInstrument` runtime validation** — Currently a no-op at runtime. Should it call `validateConfigSchema` and `console.warn` in dev mode? Cost: prevents tree-shaking of `validateConfigSchema` from code paths that never register.
7. **`serialize` default** — Falls back to identity (`(s) => s`). Would `JSON.parse(JSON.stringify(s))` (a deep clone) be safer as the default to surface non-serializable state early?
8. **`deserialize` error fallback** — Falls back to `initialState(currentConfig)`. Should the Workspace surface a visible error state to the user rather than silently resetting?
9. **`onConfigChange` error handling** — Currently unguarded. Should `<Workspace>` catch and log errors, keeping the previous state?
10. **`number` field clamping** — Clamped on blur. Should out-of-range values show a visual error state while typing?
11. ~~**`text` field debounce**~~ — **RESOLVED:** `TextField` gets a `debounceMs?: number` prop, default 150 ms (see §4.2 `text`).

---

## 12. Out of Scope

- **Canvas, layers, drag/drop, undo capability runtime** — Plan 5. The types are declared here (`CanvasCapability`, etc.) but no runtime code executes them.
- **Workspace toolbar** — Plan 3. The toolbar renders undo/redo/save/load buttons; this plan supplies only the hooks those buttons call into.
- **Per-instrument `AGENTS.md`** — will be authored once the first real instruments exist.
- **`deriveDefaultConfig(fields)` helper** — convenience function that auto-builds a `defaultConfig` object from `configSchema()`. Deferred.
- **Animated / canvas-backed controls** — all `<ControlPanel>` controls are plain HTML inputs.
- **Immer integration** — instruments may use Immer internally; the library does not provide or require it.
- **Plugin/extension registry for field types** — custom `ConfigField` types are not supported in v0.

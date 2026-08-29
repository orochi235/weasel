# labkit: generate instrument controls from a schema

For whoever implements this. It answers: what an instrument declares instead of
`defaultConfig` + `configSchema`, what renders it, and where a consumer gets in.

## The problem

An instrument declares its config twice. `defaultConfig(): TC` gives the values
and, through `TC`, their types. `configSchema(): ConfigField[]` hand-repeats
every key as a `slider` / `select` / `color` field with a label, bounds and a
second default. Nothing holds the two to one answer: rename a key in `TC` and
the panel keeps editing a field the instrument no longer reads.
`validateConfigSchema` cannot catch it, because it only ever sees the schema.

## Decision: reuse the `Pref*` vocabulary, don't extend `ConfigField`

The kit already has two vocabularies for "an editable value and how to present
it", and labkit's `ConfigField` is a third dialect of the same thing:

| Type | File | Kinds | Consumed by |
|---|---|---|---|
| `ConfigField` | `labkit/src/controls/types.ts` | `slider · checkbox · select · number · text · color` | labkit `ControlPanel` |
| `ToolPrefLeaf` | `core/src/tools/prefs.ts` | `number · boolean · string · enum · color · paint` + `ToolPrefCustom` | `usePenTool`, `NodeProperties`, `defaultNodeProperties`, ui's `SelectionPanel` |
| `PrefLeaf` | `ui/src/components/Prefs/schema.ts` | `number · boolean · string · enum · color` + `PrefCustom` | `PrefsForm`, `PrefsDialog` |

`ConfigField` is the outlier: it keys on *controls* where the other two separate
value kind from presentation (`kind: 'number'` + `control: 'slider'`). That is
why it cannot express a number whose control the app has not yet chosen, and
why the adapter below is lossless in one direction only.

`PrefLeaf` carries everything this feature needs — `default`, `min`/`max`/`step`,
`options`, labels, help text, groups, a `hidden` pass, and an open leaf kind
rendered through a `renderers[kind]` map. `PrefNumber.control?: 'input' |
'slider'` is precisely the "a bounded number wants a slider" annotation a
TypeScript type cannot express.

Build on `PrefLeaf`, and the mapping from `ConfigField` is 1:1 — evidence they
were always the same thing:

| `ConfigField` | `PrefLeaf` |
|---|---|
| `slider` | `{ kind: 'number', control: 'slider' }` |
| `number` | `{ kind: 'number', control: 'input' }` |
| `checkbox` | `{ kind: 'boolean', control: 'checkbox' }` |
| `select` | `{ kind: 'enum' }` |
| `text` | `{ kind: 'string' }` |
| `color` | `{ kind: 'color' }` |

So: one vocabulary, two renderers. `PrefsForm` (columns, dialog chrome,
react-aria) and labkit's `ControlPanel` (dense `lk-` property rows) stay
visually distinct renderers over the same schema and the same `renderers`
contract. Everything new lands in labkit; `@weasel-js/ui` is not modified.

## The builder

```ts
const config = f.schema({
  showGrid: f.boolean(true),
  cellSize: f.number(20).range(5, 80).step(5).label('Grid spacing'),
  mode:     f.enum('fast', ['fast', 'accurate']),
  tint:     f.color('#3b82f6'),
  seed:     f.value(0).section('Advanced'),
})
```

Each leaf is a `ConfigNode<T>`: a kind, a default of type `T`, an annotation
bag, and the optional `.render` / `.showIf` / `.section`. `f.schema` returns
`ConfigSchema<TC>` with `TC` inferred from the shape. `const` type parameters
(TS 6) make `f.enum('fast', ['fast', 'accurate'])` infer `'fast' | 'accurate'`
with no `as const` at the call site.

`f.value(x)` is the un-kinded leaf: it carries a default but no kind, leaving
the kind to the rule chain.

## Resolution, and where it runs

Two derivations come off a schema:

- `defaults(schema): TC` — pure, no lab context needed.
- `resolve(schema, rules): ResolvedConfig` — needs the lab's rules.

```ts
interface ResolvedConfig {
  group: PrefGroup                      // flat: every leaf a direct child
  sections: readonly SectionSpec[]       // labkit-side presentational buckets
  showIf: Map<string, (config: unknown) => boolean>
  renderers: Record<string, ControlRenderer>  // from node-level `.render`
}
```

`defineInstrument` stops being identity at runtime: given `config`, it
synthesizes `defaultConfig` so nothing downstream has to branch on which path
an instrument used. It cannot resolve fields, because rules are lab-scoped and
`defineInstrument` runs at module load.

Resolution therefore happens at render, in `TrialChrome`:

```ts
const configSchema = useConfigSchema(instrument)   // one branch, one place
```

which reads `configRules` from lab context, resolves, and prunes by `showIf`
against the current config — the same shape as `visiblePrefSubtree`.

`TrialChromeContext` gains `configSchema: ResolvedConfig`, always populated: a
legacy `configSchema(): ConfigField[]` is adapted up into a `PrefGroup` by the
table above. The existing `configFields` field stays for compatibility, marked
deprecated. The built-in sidebar contribution reads only `configSchema`, so
there is one renderer and one path.

### Flat in v1

`PrefGroup` nests. labkit's config, `setConfig(key, value)` and
`updateTrialConfig` are flat. Nested value trees would pull in path writes,
`onConfigChange` diffing and a storage migration, so v1 emits a **flat**
`PrefGroup`: every leaf is a direct child of the root, and a leaf's path equals
its config key. Both renderers then compute paths identically.

`.section('Advanced')` is a presentational bucket held in `ResolvedConfig`, not
a `PrefGroup` child and not a field on `PrefBase` — same idea as the existing
`PrefBase.pair` hint, one level up, and it keeps `@weasel-js/ui` untouched.
`ControlPanel` renders each bucket through the existing `PropertyGroup`.

Nested config is a follow-up TODO entry, not a gap to paper over here.

## The seams

Four asks, three mechanisms — custom control kinds and per-field overrides
turn out to be the same one.

**Custom control kinds and per-field overrides are one mechanism.**
`ControlPanel` gains `renderers?: Record<string, ControlRenderer>`, matching
`PrefsForm.renderers` and `SelectionPanel.renderers`. Lookup is path first,
then kind — `renderers[path] ?? renderers[kind]`, as `SelectionPanel.tsx:212`
already does. A key that is a config key overrides one field; a key that is a
kind supplies a control labkit does not ship. Returning `null` collapses the
row, and consumer entries override built-ins silently on collision — both the
established meanings for a renderer record. An unregistered kind renders a
labeled placeholder rather than blanking the panel, preserving today's
"one bad field must not blank the panel" behavior.

`.render(fn)` on a builder node is the colocated form of the same thing: it
receives the identical context and lands in `ResolvedConfig.renderers` keyed by
path. Precedence, most specific first, and within a tier the lab wins:

```
controls[path]  →  node .render  →  controls[kind]  →  built-in row
```

**Derivation rules** are the genuinely new seam.

```ts
type ConfigRule = (ctx: ConfigRuleContext) => Partial<PrefLeaf> | null
```

Rules run in order over each leaf, each returning a patch or `null` to abstain.
Merging is **gap-filling only**: a property already set is never overwritten.
The builder's explicit annotations seed the accumulator, so `.label('Grid
spacing')` always wins; consumer rules come next; labkit's built-ins run last
and fill what remains. Rules may not change a `default`.

The constraint that keeps this seam honest: **labkit's own inference ships as
rules in this same vocabulary** — `kind` from `typeof` for an `f.value` leaf,
`name` from `titleCase(key)`, `control: 'slider'` when a number has both
bounds, `description: ''`. If labkit's own inference needed something a
`ConfigRule` cannot express, the seam is too weak and it fails immediately
rather than at the first consumer.

**`showIf`** is a predicate over the current config, held in `ResolvedConfig`
and applied by a prune pass per render. `hidden` on a leaf stays what it is —
a static flag.

Both new lab-wide props sit beside the existing `chrome` / `suppress` / `tools`
on `LabProps`:

```ts
configRules?: readonly ConfigRule[]
controls?: Record<string, ControlRenderer>
```

## Validation

`validateConfigSchema` today rejects any type outside a closed `KNOWN_TYPES`
list. With an open vocabulary it validates what it can see structurally — empty
and duplicate keys, empty labels, `min < max`, a default inside its bounds, a
default among its options — and treats an unknown kind as valid rather than an
error, since a renderer for it may be supplied at the lab. A custom kind's own
constraints are checked by a `validate` passed to `f.custom(kind, default, {
validate })`, on the schema side where the constraint is declared.

Its current signature keeps working: `ConfigField[]` in, `ValidationResult` out.

## Public surface

- `f`, `ConfigSchema`, `ConfigNode`, `ConfigRule`, `ConfigRuleContext`,
  `ControlRenderer`, `ResolvedConfig` from the labkit barrel.
- The `Pref*` types re-exported through `passthrough/weasel-ui.ts`, which is
  how labkit consumers reach ui primitives without depending on the package
  directly. They are absent from it today.

## Testing

- Type-level tests (`expectTypeOf`) for builder inference: `f.enum` producing a
  literal union, `f.schema` producing `TC`, `defaults()` matching `TC`.
- Unit tests for `resolve`: rule ordering, gap-fill semantics, an explicit
  annotation beating a rule, a consumer rule claiming an `f.value` leaf's kind
  before the built-in `typeof` rule.
- `ControlPanel` tests: `renderers[path]` beating `renderers[kind]`, a `null`
  return collapsing the row, an unregistered kind rendering a placeholder,
  sections rendering through `PropertyGroup`, `showIf` pruning.
- Adapter test: each of the six `ConfigField` types mapping to its `PrefLeaf`.
- `SceneInstrument` migrated to the builder as the end-to-end proof — it has
  both a checkbox and a slider. `GardenInstrument` and `StubInstrument` stay on
  the legacy path deliberately, so both paths have live coverage.

## Traps

**A hidden field still holds a value.** `showIf` hides a row; it does not
remove the key from config, and the instrument still reads it. Anything that
depends on a field being absent is wrong.

**`description` is required on `PrefBase`.** A leaf built without one fails to
assign. The built-in rule chain supplies `''`; a hand-built leaf must not
forget it.

**The `Pref*` contract with core is structural, not an import, and it has
already broken.** `ui`'s `schema.ts` avoids importing `@weasel-js/core` on
purpose so a `ToolPrefGroup` assigns into `PrefGroup` with no cast, and its
header says "Keep the two in sync field-for-field." They are not: core has
`paint` (`ToolPrefPaint`) and ui has no equivalent, so `defaultNodeProperties`
emits `kind: 'paint'` and `kind: 'font-family'` leaves that `PrefsForm` can only
render as placeholders. Core carries a compile-time exhaustiveness tie
(`_BuiltinKindsExact`, `prefs.ts:118`); there is no cross-package counterpart
and there cannot be one, so the invariant is a comment.

This spec does not fix that drift — building on `PrefLeaf` keeps labkit from
becoming a *third* dialect, which is a smaller claim. Reconciling core and ui is
its own entry, and the `paint` gap is the concrete evidence for it.

import type { ToolEntry, ToolOptionValues } from '@weasel-js/routing';
import type { Tool, ToolsApi } from '../../tools/overlayBinding';
import type { BuiltinToolId } from './builtinToolSets';
import type { BuiltinToolOptions } from './useBuiltinShapeTools';

/**
 * `<SceneCanvas toolOptions>`: options per offered tool, keyed by the tool, handed to every preset's `build`. A
 * package offering tools adds its keys by declaration merging, as `@weasel-js/editing` adds `lasso` and `insert`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by declaration merging
export interface SceneCanvasToolOptions extends BuiltinToolOptions {}

/** The `<SceneCanvas>` props that pick a canvas's tools and hold their options. */
export interface SceneCanvasToolProps {
  /** Extra tools or overrides keyed by id, or a full `ToolsApi` takeover.
   *
   *  **Patch form** (`Record<string, Tool | true | false>`): merged
   *  into the built-in registry on top of whatever `defaultTools` and
   *  `features` already selected.
   *    - `true` pulls in the built-in for this id (`'pen'`, `'lasso'`,
   *      `'hand'`, …), the same as listing it in `defaultTools`. Unknown
   *      built-in ids warn in dev and are ignored.
   *    - `Tool` adds a new id or replaces an existing one in place
   *      (dev-only warning if `defaultTools` also names that id).
   *    - `false` omits a bundled tool entirely.
   *  Auto-wiring (keybindings, dispatcher, action registry) still runs.
   *
   *  **Takeover form** (`ToolsApi`): the internal registry is bypassed and
   *  this `tools` value is forwarded to Canvas as-is — the consumer owns
   *  active-slot management, and `pick`'s select tool is theirs to supply.
   *  Every other preset still applies. Keybindings are still auto-wired
   *  against the supplied registry; pass `enableKeybindings={false}` to opt
   *  out. */
  tools?: ToolsApi | Record<string, Tool | true | false>;

  /** Called with the `ToolsApi` SceneCanvas constructs or receives, whenever its identity
   *  changes. For introspection. */
  onToolsCreated?: (tools: ToolsApi) => void;

  /**
   * Built-in tools SceneCanvas registers in its internal `useTools`, on top
   * of the ones presets bring (`select` from `pick`, `hand` from `view`):
   * ids, or sets of them such as `SHAPE_TOOLS`, or `withoutTools(...)` of one.
   * Default: none. Each tool also registers the kit actions it binds, so
   * `['rect']` brings `insert`. Ignored under a full `ToolsApi` takeover in
   * `tools`; the patch form of `tools` lays over it.
   */
  defaultTools?: readonly ToolEntry<BuiltinToolId | (string & {})>[];

  /** Options for the offered tools, by tool: `lasso.mode`, `insert.behaviors`. */
  toolOptions?: SceneCanvasToolOptions;
  /** Where the tools' option values (`ToolDef.options`) are kept, published as the `toolOptionValues` dep: what
   *  an options row such as ui's `<ActiveToolOptionsBar>` reads and writes, and what each tool's actions are
   *  tuned from. Default: a store the canvas holds in memory. */
  toolOptionValues?: ToolOptionValues;

  /** Initial active-slot tool id. Default: `'select'` when it is
   *  registered, otherwise none — a canvas can run on ambient bindings
   *  alone. Must be one of the registered tools. Ignored when the consumer
   *  supplies their own `tools` prop. */
  defaultActiveTool?: string;
}

/**
 * The edits a theme makes to a scene, each one undo entry: applying a theme,
 * naming a shape's or connector's role, and setting a color by hand.
 */
import type { Scene } from '@weasel-js/core';
import type { MeasureRowText } from '../body';
import { relayoutBodies, type RelayoutScene } from '../bodyRelayout';
import { redrawSequences } from '../sequence/commit';
import { diagramThemeOf, themeDocValue } from './resolve';
import { themeWrites, type ThemedScene } from './themeWrites';
import { DIAGRAM_THEME_KEY, type DiagramTheme, type FontField, type StyleField } from './types';

type AnyScene = Scene<unknown, string, unknown>;
type Paint = { paint?: Record<string, unknown> } & Record<string, unknown>;
type Data = Record<string, unknown> & { diagram?: Record<string, unknown>; fill?: Paint; stroke?: Paint };

/** What a styleable node says about its style: a shape or a connector, the role it names, and the
 *  colors its author set by hand. */
export interface DiagramStyleState {
  kind: 'shape' | 'connector';
  role?: string;
  own: readonly StyleField[];
  /** The parts of its text face the author set: a theme's size change leaves those. */
  ownFont: readonly FontField[];
}

/** The style state of a shape (a body) or a connector, or `null` for anything else — a text row,
 *  a label, a group, a container. */
export function diagramStyleOf(node: { data: unknown }): DiagramStyleState | null {
  const trait = (node.data as Data | null)?.diagram;
  if (trait === null || typeof trait !== 'object') return null;
  const kind = 'from' in trait && 'to' in trait ? 'connector' : 'outline' in trait && !('group' in trait) && !('container' in trait) ? 'shape' : null;
  if (kind === null) return null;
  const role = trait.style as string | undefined;
  return {
    kind, ...(role !== undefined ? { role } : {}),
    own: (trait.ownStyle as readonly StyleField[] | undefined) ?? [],
    ownFont: (trait.ownFont as readonly FontField[] | undefined) ?? [],
  };
}

type Sized = { style?: { fontSize?: unknown } } | undefined;

/** Writes each node's new data, then lays out again every body whose text changed size. */
function writeAll(scene: AnyScene, writes: ReadonlyMap<string, unknown>, measure?: MeasureRowText): void {
  const bodies: string[] = [];
  for (const [id, data] of writes) {
    const node = scene.get(id as never)!;
    if ((node.data as Sized)?.style?.fontSize !== (data as Sized)?.style?.fontSize && node.parent !== null) bodies.push(node.parent);
    scene.update(id as never, { data });
  }
  relayoutBodies(scene as unknown as RelayoutScene, bodies, measure);
}

/** Options for {@link applyDiagramTheme}. */
export interface ApplyDiagramThemeOptions {
  /** Fold this apply into the undo entry before it when that one was made under the same key, so a
   *  run of applies, such as a theme color dragged, undoes as one. See `scene.batch`. */
  coalesceKey?: string;
  /** The theme the scene is in now, whose font size text moves from. Default the scene's own
   *  `diagram:theme`; a host that draws a scene naming none in another theme passes that. */
  from?: DiagramTheme;
  /** Measures text, for laying out again a body whose text changed size. Default an estimate. */
  measure?: MeasureRowText;
}

/** Recolors the whole scene in `theme` and saves it as the `diagram:theme` document value, as one
 *  undo entry. Colors the author set by hand stay. */
export function applyDiagramTheme(
  scene: AnyScene, theme: DiagramTheme, label = `Theme: ${theme.name}`, opts: ApplyDiagramThemeOptions = {},
): void {
  const from = opts.from ?? diagramThemeOf(scene);
  scene.batch(label, () => {
    writeAll(scene, themeWrites(scene as unknown as ThemedScene, theme, undefined, from), opts.measure);
    scene.doc.set(DIAGRAM_THEME_KEY, themeDocValue(theme));
    redrawSequences(scene, { theme, ...(opts.measure ? { measure: opts.measure } : {}) });
  }, opts.coalesceKey !== undefined ? { coalesceKey: opts.coalesceKey } : {});
}

/** Options for {@link setDiagramStyle} and {@link setDiagramColor}. */
export interface DiagramStyleEditOptions {
  /** The theme to color by. Default the scene's own `diagram:theme`. */
  theme?: DiagramTheme;
  label?: string;
}

const withTrait = (data: Data, trait: Record<string, unknown>): Data => ({ ...data, diagram: trait });

/**
 * Names `role` on every shape and connector among `ids` and recolors them in
 * it, as one undo entry. Choosing a role hands back any color the author had
 * set, so the role shows.
 */
export function setDiagramStyle(scene: AnyScene, ids: readonly string[], role: string, opts: DiagramStyleEditOptions = {}): void {
  const theme = opts.theme ?? diagramThemeOf(scene);
  const styled = ids.filter((id) => { const n = scene.get(id as never); return n !== undefined && diagramStyleOf(n) !== null; });
  if (styled.length === 0) return;
  scene.batch(opts.label ?? 'Set style', () => {
    for (const id of styled) {
      const data = scene.get(id as never)!.data as Data;
      const { ownStyle: _, ...trait } = data.diagram!;
      scene.update(id as never, { data: withTrait(data, { ...trait, style: role }) });
    }
    writeAll(scene, themeWrites(scene as unknown as ThemedScene, theme, new Set(styled)));
  });
}

const painted = (paint: Paint | undefined, color: string): Paint => ({ ...paint, paint: { ...paint?.paint, color } });

/** The text nodes a shape's or connector's `text` color reaches: a shape's rows, a connector's labels. */
function textNodesOf(scene: AnyScene, id: string, kind: DiagramStyleState['kind']): string[] {
  if (kind === 'shape') return scene.childrenOf(id as never).filter((c) => typeof (scene.get(c)?.data as Data)?.text === 'string');
  return scene.renderOrderNodes().filter((n) => {
    const deps = n.dependsOn;
    return Array.isArray(deps) && deps.length === 1 && deps[0] === id && 'label' in ((n.data as Data).diagram ?? {});
  }).map((n) => n.id);
}

/**
 * Sets `field` to `color` on every shape and connector among `ids` — `text`
 * reaching a shape's rows and a connector's label — and records it in their
 * `ownStyle`, so a theme change leaves it. One undo entry. A connector has no
 * fill, and ignores one.
 */
export function setDiagramColor(scene: AnyScene, ids: readonly string[], field: StyleField, color: string, opts: Pick<DiagramStyleEditOptions, 'label'> = {}): void {
  scene.batch(opts.label ?? `Set ${field} color`, () => {
    for (const id of ids) {
      const node = scene.get(id as never);
      const state = node === undefined ? null : diagramStyleOf(node);
      if (state === null || (state.kind === 'connector' && field === 'fill')) continue;
      const data = node!.data as Data;
      const own = state.own.includes(field) ? state.own : [...state.own, field];
      const next = withTrait(data, { ...data.diagram, ownStyle: own });
      if (field !== 'text') next[field] = painted(data[field], color);
      scene.update(id as never, { data: next });
      if (field !== 'text') continue;
      for (const t of textNodesOf(scene, id, state.kind)) {
        const text = scene.get(t as never)!.data as Data;
        scene.update(t as never, { data: { ...text, fill: painted(text.fill, color) } });
      }
    }
  });
}

/**
 * Sets the text of every shape and connector among `ids` — a shape's rows, a
 * connector's label — to `size`, and records it in their `ownFont`, so a
 * theme's size change leaves it. One undo entry.
 */
export function setDiagramFontSize(
  scene: AnyScene, ids: readonly string[], size: number, opts: Pick<DiagramStyleEditOptions, 'label'> & { measure?: MeasureRowText } = {},
): void {
  scene.batch(opts.label ?? 'Set text size', () => {
    const writes = new Map<string, unknown>();
    for (const id of ids) {
      const node = scene.get(id as never);
      const state = node === undefined ? null : diagramStyleOf(node);
      if (state === null) continue;
      const data = node!.data as Data;
      if (!state.ownFont.includes('size')) scene.update(id as never, { data: withTrait(data, { ...data.diagram, ownFont: [...state.ownFont, 'size'] }) });
      for (const t of textNodesOf(scene, id, state.kind)) {
        const text = scene.get(t as never)!.data as Data & { style?: Record<string, unknown> };
        writes.set(t, { ...text, style: { ...text.style, fontSize: size } });
      }
    }
    writeAll(scene, writes, opts.measure);
  });
}

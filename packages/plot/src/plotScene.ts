/**
 * A plot in a scene: one root node holding the spec, its marks derived
 * children rebuilt from it. An edit replaces the spec and rebuilds the marks
 * as one undo entry.
 */
import type { AddNodeSpec, NodeId, RectPose, Scene } from '@weasel-js/core';
import type { PlotMark, PlotMarkData, PlotMarkTrait } from './marks/types';
import { textMeasure, type PlotMeasure } from './measure';
import { compilePlot, type PlotData } from './plotData';
import { PLOT_THEME, type PlotTheme } from './theme';

/** What a plot's root node keeps: the spec, and the theme its marks were drawn in. */
export interface PlotRootTrait {
  data: PlotData;
  theme: PlotTheme;
}

/** A plot root's scene data. */
export interface PlotRootData {
  plot: PlotRootTrait;
}

/** The data of any node a plot puts in a scene. */
export type PlotSceneData = PlotRootData | PlotMarkData;

/** A scene node spec, as {@link plotSpecs} returns them. */
export type PlotSpec<TLayer extends string = 'main'> = AddNodeSpec<PlotSceneData, TLayer, RectPose>;

/** Options for {@link plotSpecs}. */
export interface PlotSpecsOptions<TLayer extends string = 'main'> {
  /** The root's id. Default `'plot'`. */
  id?: string;
  /** The box the plot fills. */
  box: { x: number; y: number; width: number; height: number };
  /** Default `'main'`. */
  layer?: TLayer;
  /** Default {@link PLOT_THEME}. */
  theme?: PlotTheme;
  /** Default {@link textMeasure}. */
  measure?: PlotMeasure;
}

/** The trait a plot root's data carries, or `null` for any other node. */
export function plotRootOf(node: { data: unknown } | undefined): PlotRootTrait | null {
  const plot = (node?.data as { plot?: PlotRootTrait } | null | undefined)?.plot;
  return plot !== undefined && plot !== null && typeof plot === 'object' && typeof plot.data?.kind === 'string' ? plot : null;
}

/** The trait a plot mark's data carries, or `null` for any other node. */
export function plotMarkOf(node: { data: unknown } | undefined): PlotMarkTrait | null {
  const mark = (node?.data as { plotMark?: PlotMarkTrait } | null | undefined)?.plotMark;
  return mark !== undefined && mark !== null && typeof mark.kind === 'string' ? mark : null;
}

/** The id of the mark keyed `key` under the root `rootId`. */
export const plotMarkId = (rootId: string, key: string): string => `${rootId}/${key}`;

/** `marks` as children of the root `rootId`, in its frame. */
export function markSpecs<TLayer extends string>(rootId: string, layer: TLayer, marks: readonly PlotMark[]): PlotSpec<TLayer>[] {
  return marks.map((m) => ({
    kind: 'mark', id: plotMarkId(rootId, m.key) as NodeId, parent: rootId as NodeId, layer,
    pose: { x: m.pose.x, y: m.pose.y, width: m.pose.width, height: m.pose.height, ...(m.pose.rotation ? { rotation: m.pose.rotation } : {}) },
    data: m.data,
  }));
}

/** The nodes a plot of `data` is: its root, a group filling `box`, then each mark under it, in drawing order. */
export function plotSpecs<TLayer extends string = 'main'>(data: PlotData, opts: PlotSpecsOptions<TLayer>): PlotSpec<TLayer>[] {
  const id = opts.id ?? 'plot';
  const layer = (opts.layer ?? 'main') as TLayer;
  const theme = opts.theme ?? PLOT_THEME;
  const { x, y, width, height } = opts.box;
  const marks = compilePlot(data, { width, height }, theme, opts.measure ?? textMeasure);
  const root: PlotSpec<TLayer> = { kind: 'group', id: id as NodeId, layer, pose: { x, y, width, height }, data: { plot: { data, theme } } };
  return [root, ...markSpecs(id, layer, marks)];
}

/** Options for {@link replacePlotData}. */
export interface ReplacePlotOptions {
  /** The undo entry's label. Default `'Edit chart'`. */
  label?: string;
  /** Draw in this theme from now on. Default the one the root keeps. */
  theme?: PlotTheme;
  /** Default {@link textMeasure}. */
  measure?: PlotMeasure;
}

type AnyScene = Scene<unknown, string, unknown>;

/** The plot root `rootId`'s trait. Throws when `rootId` is not one. */
function rootTrait(scene: AnyScene, rootId: string): { node: NonNullable<ReturnType<AnyScene['get']>>; trait: PlotRootTrait } {
  const node = scene.get(rootId as NodeId);
  const trait = plotRootOf(node);
  if (node === undefined || trait === null) throw new Error(`replacePlotData: "${rootId}" is not a plot root`);
  return { node, trait };
}

/** Replaces the spec of the plot rooted at `rootId` with `data` and rebuilds its marks, as one undo entry. */
export function replacePlotData<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>, rootId: string, data: PlotData, opts: ReplacePlotOptions = {},
): void {
  const s = scene as unknown as AnyScene;
  const { node, trait } = rootTrait(s, rootId);
  const theme = opts.theme ?? trait.theme;
  const pose = node.pose as RectPose;
  const marks = compilePlot(data, { width: pose.width, height: pose.height }, theme, opts.measure ?? textMeasure);
  s.batch(opts.label ?? 'Edit chart', () => {
    s.update(node.id, { data: { ...(node.data as object), plot: { data, theme } } });
    const children = s.childrenOf(node.id);
    if (children.length > 0) s.removeMany(children);
    for (const spec of markSpecs(rootId, node.layer, marks)) s.add(spec as never);
  });
}

/** The id of the plot root `id` is, or is a mark of; `null` for a node outside every plot. */
export function plotRootContaining(scene: Scene<unknown, string, unknown>, id: string): NodeId | null {
  const node = scene.get(id as NodeId);
  if (node === undefined) return null;
  if (plotRootOf(node) !== null) return node.id;
  const parent = plotMarkOf(node) !== null ? node.parent : null;
  return parent !== null && parent !== undefined && plotRootOf(scene.get(parent)) !== null ? parent : null;
}

/** Every plot root in `scene`, in render order. */
export function plotRootsIn(scene: Scene<unknown, string, unknown>): NodeId[] {
  return scene.renderOrderNodes().filter((n) => plotRootOf(n) !== null).map((n) => n.id);
}

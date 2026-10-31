/**
 * Dragging a plot's handle to edit the value behind it. The handle layer
 * claims the press; this action previews every mark the proposed spec
 * redraws, and commits the spec as one edit of the plot's root.
 */
import type { Action, InvocationCtx, NodeId, OngoingHandle, RectPose, Scene } from '@weasel-js/core';
import type { PlotPoint } from '../marks/types';
import { textMeasure, type PlotMeasure } from '../measure';
import { compilePlot, type PlotData } from '../plotData';
import { markSpecs, plotMarkOf, plotRootOf, replacePlotData, type PlotSpec } from '../plotScene';
import { plotEditorOf } from './editors';
import { plotHandleScratchOf, plotOrigin } from './handleLayer';

/** The action that drags a plot's handle. */
export const PLOT_DRAG_ACTION_ID = 'plot.dragValue';

/** A plot edited: the root, and the spec it now holds. */
export interface PlotEdit {
  rootId: string;
  data: PlotData;
}

/** Options for {@link createPlotDragAction}. */
export interface PlotDragOptions {
  id?: string;
  /** Default {@link textMeasure}. */
  measure?: PlotMeasure;
  /** Defaults to {@link replacePlotData} against `deps.scene`, labeled "Edit value". */
  commit?: (edit: PlotEdit, ctx: InvocationCtx) => void;
}

type AnyScene = Scene<unknown, string, unknown>;

/** What a drag captured at its press, read-only after. */
interface PlotPress {
  rootId: string;
  /** The spec the pointer at a point in the plot's coordinates proposes. */
  propose: (at: PlotPoint) => PlotData;
  /** From the world to the plot's coordinates, the grab offset included. */
  toPlot: (world: PlotPoint) => PlotPoint;
  redraw: (data: PlotData) => PlotSpec<string>[];
  deps: InvocationCtx['deps'];
}

function pressOf(ctx: InvocationCtx, measure: PlotMeasure): PlotPress | null {
  const pressed = plotHandleScratchOf(ctx.drag?.affordance);
  const scene = ctx.deps.scene as AnyScene | undefined;
  const root = pressed === null ? undefined : scene?.get(pressed.rootId as NodeId);
  const trait = plotRootOf(root);
  const mark = plotMarkOf(pressed === null ? undefined : scene?.get(pressed.markId as NodeId));
  const editor = trait && plotEditorOf(trait.data);
  if (pressed === null || scene === undefined || root === undefined || trait === null || mark === null || editor === null) return null;
  const size = { width: (root.pose as RectPose).width, height: (root.pose as RectPose).height };
  const propose = editor.drag(trait.data, mark, size, trait.theme, measure);
  if (propose === null) return null;
  const origin = plotOrigin(scene, pressed.rootId);
  const start = ctx.drag?.start ?? ctx.world;
  const grab = { x: pressed.at.x - start.x, y: pressed.at.y - start.y };
  return {
    rootId: pressed.rootId,
    propose,
    toPlot: (w) => ({ x: w.x + grab.x - origin.x, y: w.y + grab.y - origin.y }),
    redraw: (data) => markSpecs(pressed.rootId, root.layer, compilePlot(data, size, trait.theme, measure)),
    deps: ctx.deps,
  };
}

/** The default commit: the spec into the root, its marks rebuilt, as one history entry, "Edit value". */
export function commitPlotToScene(edit: PlotEdit, ctx: InvocationCtx, measure: PlotMeasure = textMeasure): void {
  const scene = ctx.deps.scene as AnyScene | undefined;
  if (scene === undefined || plotRootOf(scene.get(edit.rootId as NodeId)) === null) return;
  replacePlotData(scene, edit.rootId, edit.data, { label: 'Edit value', measure });
}

/** The `plot.dragValue` action: an ongoing drag that moves one value of a plot, previewing the marks it redraws. */
export function createPlotDragAction(opts: PlotDragOptions = {}): Action {
  const measure = opts.measure ?? textMeasure;
  const commit = opts.commit ?? ((edit: PlotEdit, ctx: InvocationCtx) => commitPlotToScene(edit, ctx, measure));
  return {
    id: opts.id ?? PLOT_DRAG_ACTION_ID,
    label: 'Edit value',
    group: 'plot',
    requires: ['scene'],
    eligible: { mode: 'normal' },
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const p = pressOf(ctx, measure);
        if (p === null) return {};
        // Null until the pointer moves, so a still click commits nothing.
        let next: PlotData | null = null;
        let shown = new Map<string, PlotSpec<string>>();
        let open = true;
        const scene = ctx.deps.scene as AnyScene;
        const previewing = () => (open && next !== null ? shown : null);
        return {
          kind: 'plot-drag-value',
          onMove(moveCtx: InvocationCtx): void {
            next = p.propose(p.toPlot(moveCtx.world));
            shown = new Map(p.redraw(next).map((spec) => [spec.id as string, spec]));
          },
          previewIds: () => {
            const specs = previewing();
            return specs === null ? null : [...specs.keys()].filter((id) => scene.get(id as NodeId) !== undefined);
          },
          previewPose: (id) => previewing()?.get(id)?.pose ?? null,
          previewData: (id) => previewing()?.get(id)?.data ?? null,
          onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
            open = false;
            if (reason !== 'commit' || next === null) return;
            commit({ rootId: p.rootId, data: p.propose(p.toPlot(endCtx.world)) }, { ...endCtx, deps: p.deps });
          },
        };
      },
    },
    enabled: () => true as const,
  };
}

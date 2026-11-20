/** How {@link PlotView} keeps its scene's chart in step with its props, and reports the edits made in it. */
import { useLatest, type NodeId, type RectPose, type Scene } from '@weasel-js/core';
import { useEffect, useMemo, useRef } from 'react';
import type { PlotMeasure } from './measure';
import type { PlotData } from './plotData';
import { plotRootOf, replacePlotData, type PlotSceneData } from './plotScene';
import { PLOT_THEME, type PlotTheme } from './theme';

/** What a plot's marks are drawn from besides its spec. */
export interface PlotDrawing {
  width: number;
  height: number;
  theme?: PlotTheme | undefined;
  measure?: PlotMeasure | undefined;
}

/**
 * Redraws the plot rooted at `rootId` from `data` and `drawing` without an undo entry, and reports each spec an edit,
 * an undo, or a redo leaves to `onChange`. An undo or redo that puts back marks drawn for an older size, theme, or
 * measure redraws them for the current ones.
 */
export function usePlotPropsSync(
  scene: Scene<PlotSceneData, 'main', RectPose>, rootId: string, data: PlotData, drawing: PlotDrawing,
  onChange: ((data: PlotData) => void) | undefined,
): void {
  const { width, height, theme, measure } = drawing;
  const changed = useLatest(onChange);
  const current = useLatest(drawing);
  // The spec last reported or drawn from props, which a redraw from props must not report back.
  const last = useRef(plotRootOf(scene.get(rootId as NodeId))?.data);
  const redrawing = useRef(false);
  const drawnWith = useRef({ theme, measure });
  // The root traits drawn under the current size, theme, and measure, and every one drawn under any.
  const fresh = useRef(new WeakSet<object>());
  const seen = useRef(new WeakSet<object>());

  const { traitOf, redraw } = useMemo(() => {
    const traitOf = () => plotRootOf(scene.get(rootId as NodeId));
    const redraw = (spec: PlotData, at: PlotDrawing, sized: boolean) => {
      redrawing.current = true;
      try {
        scene.untracked(() => {
          if (!sized) scene.setPose(rootId as NodeId, { x: 0, y: 0, width: at.width, height: at.height });
          replacePlotData(scene, rootId, spec, { theme: at.theme ?? PLOT_THEME, ...(at.measure ? { measure: at.measure } : {}) });
        });
      } finally {
        redrawing.current = false;
      }
      const trait = traitOf();
      last.current = trait?.data;
      fresh.current = new WeakSet(trait ? [trait] : []);
      if (trait) seen.current.add(trait);
    };
    return { traitOf, redraw };
  }, [scene, rootId]);

  // A spec from outside redraws without an undo entry; one the view reported back is already drawn. So do a new
  // theme or measure, and a theme taken away redraws in the default one.
  useEffect(() => {
    const root = scene.get(rootId as NodeId);
    const pose = root?.pose;
    const trait = plotRootOf(root);
    const sized = pose !== undefined && pose.width === width && pose.height === height;
    const drawn = drawnWith.current;
    if (trait === null) return;
    if (trait.data === data && sized && drawn.theme === theme && drawn.measure === measure) {
      if (!seen.current.has(trait)) {
        fresh.current.add(trait);
        seen.current.add(trait);
      }
      return;
    }
    drawnWith.current = { theme, measure };
    redraw(data, { width, height, theme, measure }, sized);
  }, [scene, rootId, data, width, height, theme, measure, redraw]);

  useEffect(() => scene.subscribe(() => {
    const trait = traitOf();
    const now = trait?.data;
    if (redrawing.current) last.current = now;
    if (trait === null || now === undefined || redrawing.current) return;
    if (now !== last.current) {
      last.current = now;
      changed.current?.(now);
    }
    if (fresh.current.has(trait)) return;
    if (!seen.current.has(trait)) {
      fresh.current.add(trait);
      seen.current.add(trait);
      return;
    }
    const at = current.current;
    const pose = scene.get(rootId as NodeId)!.pose;
    redraw(now, at, pose.width === at.width && pose.height === at.height);
  }), [scene, rootId, changed, current, traitOf, redraw]);
}

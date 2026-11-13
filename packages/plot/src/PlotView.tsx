import {
  SceneCanvas, WeaselProvider, useLatest, useScene, type NodeId, type Paint, type RectPose,
} from '@weasel-js/core';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { plotEditing } from './editing/plotEditing';
import { usePlotTextEdit } from './editing/textEdit';
import type { PlotMeasure } from './measure';
import type { PlotData } from './plotData';
import { plotRootOf, plotSpecs, replacePlotData, type PlotSceneData, type PlotSpec } from './plotScene';
import { PLOT_THEME, type PlotTheme } from './theme';

/** Props for {@link PlotView}. */
export interface PlotViewProps {
  /** The chart. A new value redraws it, with no undo entry. */
  data: PlotData;
  /** Hears each edit a drag or a text edit commits, with the spec it leaves. Undo and redo in the view report too. */
  onChange?: (data: PlotData) => void;
  width: number;
  height: number;
  /** Default the weasel theme's dark mode. */
  theme?: PlotTheme;
  measure?: PlotMeasure;
  background?: Paint;
  className?: string;
  'aria-label'?: string;
}

const ROOT = 'plot';
const FEATURES = ['pick', 'edit'] as const;

/**
 * A chart on its own canvas, edited by dragging its marks (a bar's end, a
 * line's point, a task's span) and by double-clicking its text to edit it in
 * place. Each edit is one undo entry. Text paints only
 * in a registered font family, so register the theme's (`registerCanvasFont`).
 */
export function PlotView(props: PlotViewProps): ReactElement {
  return (
    <WeaselProvider>
      <Inner {...props} />
    </WeaselProvider>
  );
}

function Inner({ data, onChange, width, height, theme, measure, background, className, 'aria-label': label }: PlotViewProps): ReactElement {
  const [initial] = useState(() => plotSpecs(data, {
    id: ROOT, box: { x: 0, y: 0, width, height }, ...(theme ? { theme } : {}), ...(measure ? { measure } : {}),
  }));
  const scene = useScene<PlotSceneData, 'main', RectPose>({ systemLayers: [{ id: 'main' }], initial: initial as PlotSpec[] });
  const changed = useLatest(onChange);
  // The spec last reported or drawn from props, which a redraw from props must not report back.
  const last = useRef(plotRootOf(scene.get(ROOT as NodeId))?.data);
  const redrawing = useRef(false);
  const drawnWith = useRef({ theme, measure });

  // A spec from outside redraws without an undo entry; one the view reported back is already drawn. So do a new
  // theme or measure, and a theme taken away redraws in the default one.
  useEffect(() => {
    const root = scene.get(ROOT as NodeId);
    const pose = root?.pose;
    const trait = plotRootOf(root);
    const sized = pose !== undefined && pose.width === width && pose.height === height;
    const drawn = drawnWith.current;
    if (trait === null || (trait.data === data && sized && drawn.theme === theme && drawn.measure === measure)) return;
    drawnWith.current = { theme, measure };
    redrawing.current = true;
    try {
      scene.untracked(() => {
        if (!sized) scene.setPose(ROOT as NodeId, { x: 0, y: 0, width, height });
        replacePlotData(scene, ROOT, data, { theme: theme ?? PLOT_THEME, ...(measure ? { measure } : {}) });
      });
    } finally {
      redrawing.current = false;
    }
    last.current = plotRootOf(scene.get(ROOT as NodeId))?.data;
  }, [scene, data, width, height, theme, measure]);

  useEffect(() => scene.subscribe(() => {
    const now = plotRootOf(scene.get(ROOT as NodeId))?.data;
    if (redrawing.current) last.current = now;
    if (now === undefined || now === last.current) return;
    last.current = now;
    changed.current?.(now);
  }), [scene, changed]);

  const editing = useMemo(() => plotEditing({ scene: scene as never, ...(measure ? { measure } : {}) }), [scene, measure]);
  const ambient = useMemo(() => [editing], [editing]);
  const textEditor = usePlotTextEdit(scene as never, (edit) => replacePlotData(scene, edit.rootId, edit.data, {
    label: edit.label, ...(measure ? { measure } : {}),
  }));

  return (
    <div className={className} data-wzl-plot="">
      <SceneCanvas
        scene={scene}
        features={FEATURES}
        enableKeybindings
        ambient={ambient}
        textEditor={textEditor as never}
        width={width}
        height={height}
        {...(background ? { backgroundFill: background } : {})}
        {...(label ? { 'aria-label': label } : {})}
      />
    </div>
  );
}

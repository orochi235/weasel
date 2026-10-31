import {
  SceneCanvas, WeaselProvider, useLatest, useScene, type NodeId, type Paint, type RectPose, type SceneCanvasApi,
} from '@weasel-js/core';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { plotEditing } from './editing/plotEditing';
import type { PlotMeasure } from './measure';
import type { PlotData } from './plotData';
import { plotRootOf, plotSpecs, replacePlotData, type PlotSceneData, type PlotSpec } from './plotScene';
import type { PlotTheme } from './theme';

/** Props for {@link PlotView}. */
export interface PlotViewProps {
  /** The chart. A new value redraws it, with no undo entry. */
  data: PlotData;
  /** Hears each edit a drag commits, with the spec it leaves. Undo and redo in the view report too. */
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
const FEATURES = ['pick'] as const;

/**
 * A chart on its own canvas, edited by dragging its marks: a bar's end or a
 * line's point moves its value. Each drag is one undo entry. Text paints only
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

  // A spec from outside redraws without an undo entry; one the view reported back is already drawn.
  useEffect(() => {
    const root = scene.get(ROOT as NodeId);
    const pose = root?.pose;
    const trait = plotRootOf(root);
    const sized = pose !== undefined && pose.width === width && pose.height === height;
    if (trait === null || (trait.data === data && sized && (theme === undefined || trait.theme === theme))) return;
    scene.untracked(() => {
      if (!sized) scene.setPose(ROOT as NodeId, { x: 0, y: 0, width, height });
      replacePlotData(scene, ROOT, data, { ...(theme ? { theme } : {}), ...(measure ? { measure } : {}) });
    });
  }, [scene, data, width, height, theme, measure]);

  useEffect(() => {
    let last = plotRootOf(scene.get(ROOT as NodeId))?.data;
    return scene.subscribe(() => {
      const now = plotRootOf(scene.get(ROOT as NodeId))?.data;
      if (now === undefined || now === last) return;
      last = now;
      changed.current?.(now);
    });
  }, [scene, changed]);

  const editing = useMemo(() => plotEditing({ scene: scene as never, ...(measure ? { measure } : {}) }), [scene, measure]);
  const ambient = useMemo(() => [editing.contribution], [editing]);
  const [canvas, setCanvas] = useState<SceneCanvasApi | null>(null);
  useEffect(() => (canvas === null ? undefined : canvas.registerLayer(editing.layer)), [canvas, editing]);

  return (
    <div className={className} data-wzl-plot="">
      <SceneCanvas
        ref={setCanvas}
        scene={scene}
        features={FEATURES}
        enableKeybindings
        ambient={ambient}
        width={width}
        height={height}
        {...(background ? { backgroundFill: background } : {})}
        {...(label ? { 'aria-label': label } : {})}
      />
    </div>
  );
}

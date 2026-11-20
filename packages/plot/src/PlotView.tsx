import { SceneCanvas, WeaselProvider, useScene, type Paint, type RectPose } from '@weasel-js/core';
import { useMemo, useState, type ReactElement } from 'react';
import { createTextPreset } from '@weasel-js/text-tools';
import { createPlotEditingContribution } from './editing/createPlotEditingContribution';
import { usePlotTextEdit } from './editing/textEdit';
import type { PlotMeasure } from './measure';
import type { PlotData } from './plotData';
import { plotSpecs, replacePlotData, type PlotSceneData, type PlotSpec } from './plotScene';
import { usePlotPropsSync } from './plotViewSync';
import type { PlotTheme } from './theme';
import * as presets from '@weasel-js/editing/presets';

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
const FEATURES = [presets.pick, presets.edit] as const;

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
  usePlotPropsSync(scene, ROOT, data, { width, height, theme, measure }, onChange);

  const editing = useMemo(() => createPlotEditingContribution({ scene: scene as never, ...(measure ? { measure } : {}) }), [scene, measure]);
  const ambient = useMemo(() => [editing], [editing]);
  const textEditor = usePlotTextEdit(scene as never, (edit) => replacePlotData(scene, edit.rootId, edit.data, {
    label: edit.label, ...(measure ? { measure } : {}),
  }));

  const features = useMemo(() => [...FEATURES, createTextPreset({ editor: textEditor })], [textEditor]);

  return (
    <div className={className} data-wzl-plot="">
      <SceneCanvas
        scene={scene}
        features={features}
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

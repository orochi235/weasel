/**
 * Simplify and Offset Path as sliders. Dragging a slider previews its command on the selection and releasing it
 * commits one undo entry. The Simplify tolerance is also the Simplify brush's tolerance option, so the slider
 * reads and writes that pref (`useSimplifyTolerance`), and the brush's options row moves with it.
 */
import { useState, type ReactElement } from 'react';
import {
  DEFAULT_SIMPLIFY_TOLERANCE, OFFSET_PATH_PARAMS, setToolOption, SIMPLIFY_PATH_PARAMS, useOngoingAction, useToolOptionParams,
} from '@weasel-js/core';
import { SIMPLIFY_BRUSH_TOOL_OPTIONS } from '@weasel-js/path-tools';
import { drawToolOptionValues } from '../../toolOptions';
import { Slider } from '@weasel-js/ui/components/Slider';
import s from './PathCommands.module.css';

const readout = (t: { value: number }): string => t.value.toFixed(1);
const TOLERANCE = SIMPLIFY_PATH_PARAMS.children.tolerance;
const DISTANCE = OFFSET_PATH_PARAMS.children.distance;

/** The Simplify tolerance and its setter: the Simplify brush's `tolerance` option. */
const SIMPLIFY_BRUSH = { id: 'simplifyBrush', options: SIMPLIFY_BRUSH_TOOL_OPTIONS };

export function useSimplifyTolerance(): [number, (tolerance: number) => void] {
  const values = drawToolOptionValues();
  const tolerance = useToolOptionParams(SIMPLIFY_BRUSH, values)?.tolerance;
  const set = (t: number) => setToolOption(SIMPLIFY_BRUSH.id, SIMPLIFY_BRUSH.options, values, 'tolerance', t);
  return [typeof tolerance === 'number' ? tolerance : DEFAULT_SIMPLIFY_TOLERANCE, set];
}

/** Sizes a slider; without it, it is a popover's width. */
export interface PathSliderProps {
  className?: string;
}

export interface SimplifySliderProps extends PathSliderProps {
  tolerance: number;
  onTolerance: (tolerance: number) => void;
}

export function SimplifySlider({ tolerance, onTolerance, className = s.slider }: SimplifySliderProps): ReactElement {
  const simplify = useOngoingAction('simplifyPath');
  return (
    <Slider
      className={className}
      aria-label="Simplify tolerance"
      min={TOLERANCE.min}
      max={TOLERANCE.max}
      step={TOLERANCE.step}
      thumbs={[{ value: tolerance }]}
      onInput={([t]) => {
        onTolerance(t.value);
        simplify.input({ tolerance: t.value });
      }}
      onChange={([t]) => simplify.commit({ tolerance: t.value })}
      readoutPlacement="inline-after"
      renderReadout={readout}
    />
  );
}

export function OffsetSlider({ className = s.slider }: PathSliderProps): ReactElement {
  const offset = useOngoingAction('offsetPath');
  const [distance, setDistance] = useState(DISTANCE.default);
  return (
    <Slider
      className={className}
      aria-label="Offset distance"
      min={DISTANCE.min}
      max={DISTANCE.max}
      step={DISTANCE.step}
      thumbs={[{ value: distance }]}
      onInput={([t]) => {
        setDistance(t.value);
        offset.input({ distance: t.value });
      }}
      onChange={([t]) => {
        offset.commit({ distance: t.value });
        // The new outline is selected now; the next offset starts from it.
        setDistance(DISTANCE.default);
      }}
      readoutPlacement="inline-after"
      renderReadout={readout}
    />
  );
}

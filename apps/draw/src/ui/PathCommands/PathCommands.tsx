/**
 * Simplify and Offset Path as sliders. Dragging a slider previews its command on the selection and releasing it
 * commits one undo entry. The Simplify tolerance is also the Simplify brush's tolerance option, so the slider
 * reads and writes that pref (`useSimplifyTolerance`), and the brush's options row moves with it.
 */
import { useState, type ReactElement } from 'react';
import { useOngoingAction } from '@weasel-js/core';
import { usePref } from '../../prefs';
import { Slider } from '@weasel-js/ui/components/Slider';
import s from './PathCommands.module.css';

const readout = (t: { value: number }): string => t.value.toFixed(1);

/** The Simplify tolerance and its setter: the Simplify brush's `tolerance` option. */
export function useSimplifyTolerance(): [number, (tolerance: number) => void] {
  const [tolerance, setTolerance] = usePref('tools.simplifyBrush.tolerance');
  return [tolerance ?? 1, setTolerance];
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
      ariaLabel="Simplify tolerance"
      min={0.1}
      max={20}
      step={0.1}
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
  const [distance, setDistance] = useState(0);
  return (
    <Slider
      className={className}
      ariaLabel="Offset distance"
      min={-50}
      max={50}
      step={0.5}
      thumbs={[{ value: distance }]}
      onInput={([t]) => {
        setDistance(t.value);
        offset.input({ distance: t.value });
      }}
      onChange={([t]) => {
        offset.commit({ distance: t.value });
        // The new outline is selected now; the next offset starts from it.
        setDistance(0);
      }}
      readoutPlacement="inline-after"
      renderReadout={readout}
    />
  );
}

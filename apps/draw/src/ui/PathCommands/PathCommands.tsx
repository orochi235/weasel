/**
 * Simplify, Offset Path, and Bridge tension as sliders. Dragging a slider previews its command on the selection and releasing it
 * commits one undo entry. The Simplify tolerance is also what the Simplify brush path edit refits at, so it lives
 * above whichever surface draws the slider (`useSimplifyTolerance`), as does Bridge's tension, which the next
 * Bridge or Bridge anchors uses (`useBridgeTension`).
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useActionsRegistry, useLatest, useOngoingAction } from '@weasel-js/core';
import { DEFAULT_BRIDGE_TENSION } from '@weasel-js/path-tools';
import { Slider } from '@weasel-js/ui/components/Slider';
import s from './PathCommands.module.css';

const readout = (t: { value: number }): string => t.value.toFixed(1);

/** The Simplify tolerance and its setter, tuning the `simplifyBrush` path edit to it. */
export function useSimplifyTolerance(): [number, (tolerance: number) => void] {
  const [tolerance, setTolerance] = useState(1);
  const registry = useActionsRegistry();
  const brushTolerance = useLatest(tolerance);
  useEffect(
    () => registry?.tune('simplifyBrush', { params: () => ({ tolerance: brushTolerance.current }) }),
    [registry, brushTolerance],
  );
  return [tolerance, setTolerance];
}

/** Bridge's tension and its setter, tuning `bridgePaths` and `bridgeAnchors` to it. */
export function useBridgeTension(): [number, (tension: number) => void] {
  const [tension, setTension] = useState(DEFAULT_BRIDGE_TENSION);
  const registry = useActionsRegistry();
  const latest = useLatest(tension);
  useEffect(() => {
    const params = () => ({ tension: latest.current });
    const untune = ['bridgePaths', 'bridgeAnchors'].map((id) => registry?.tune(id, { params }));
    return () => untune.forEach((u) => u?.());
  }, [registry, latest]);
  return [tension, setTension];
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

export interface BridgeSliderProps extends PathSliderProps {
  tension: number;
  onTension: (tension: number) => void;
}

export function BridgeSlider({ tension, onTension, className = s.slider }: BridgeSliderProps): ReactElement {
  return (
    <Slider
      className={className}
      ariaLabel="Bridge tension"
      min={0}
      max={1.5}
      step={0.05}
      thumbs={[{ value: tension }]}
      onInput={([t]) => onTension(t.value)}
      onChange={([t]) => onTension(t.value)}
      readoutPlacement="inline-after"
      renderReadout={(t) => t.value.toFixed(2)}
    />
  );
}

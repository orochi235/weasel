import type { Constraints } from '@weasel-js/theme/engine';
import { PropertyGroup, SliderRow, ToggleRow } from '@weasel-js/ui';
import type { ReactNode } from 'react';

export type SetConstraint = <K extends keyof Constraints>(key: K, value: Constraints[K]) => void;

export interface ConstraintsPanelProps {
  readonly c: Constraints;
  readonly onSet: SetConstraint;
  /** A categorical ramp's count is its step list, so the ramp editor hides the slider. */
  readonly fixedCount?: boolean;
  /** Rows appended to the Set group. */
  readonly setRows?: ReactNode;
}

/** The palette generator's constraints as property groups, for a `PropertyPanel`. */
export function ConstraintsPanel({ c, onSet, fixedCount = false, setRows }: ConstraintsPanelProps) {
  return (
    <>
      <PropertyGroup title="Set">
        {!fixedCount && (
          <SliderRow
            label="Colors"
            value={c.count}
            min={5}
            max={32}
            step={1}
            onChange={(v) => onSet('count', v)}
          />
        )}
        <ToggleRow
          label="Order"
          value={c.order}
          options={[
            { value: 'farthest', label: 'Farthest' },
            { value: 'hue', label: 'By hue' },
          ]}
          onChange={(v) => onSet('order', v)}
          description="Farthest keeps any prefix separated — the first three of ten stay far apart."
        />
        {setRows}
      </PropertyGroup>

      <PropertyGroup title="Gates">
        <SliderRow
          label="Min hue gap"
          value={c.hueFloor}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => onSet('hueFloor', v)}
          format={(v) => ((v * 360) / Math.max(1, c.count)).toFixed(0)}
          unit={<sup>°</sup>}
          description={`A share of the even ${(360 / Math.max(1, c.count)).toFixed(1)}° this many colors would get. Held as a share so the floor means the same thing at any count. 0 turns it off.`}
        />
        <SliderRow
          label="Min contrast"
          value={c.minContrast}
          min={0}
          max={7}
          step={0.1}
          onChange={(v) => onSet('minContrast', v)}
          description="WCAG, which reads lightness only. 3:1 is its floor for graphical objects. 0 turns it off."
        />
        <SliderRow
          label="From surface"
          value={c.minSurfaceDistance}
          min={0}
          max={0.6}
          step={0.01}
          onChange={(v) => onSet('minSurfaceDistance', v)}
          description="Perceptual distance from the surface — the gate contrast cannot express, because it counts chroma. This is what lets a yellow stay yellow on paper. 0 turns it off."
        />
        <SliderRow
          label="Between colors"
          value={c.minDistance}
          min={0}
          max={0.4}
          step={0.01}
          onChange={(v) => onSet('minDistance', v)}
          description="Perceptual distance between any two swatches. Catches the pair that shares a hue gap but still reads alike. 0 turns it off."
        />
      </PropertyGroup>

      <PropertyGroup title="Lightness law">
        <SliderRow
          label="Target"
          value={c.lightnessTarget}
          min={0.4}
          max={0.92}
          step={0.01}
          onChange={(v) => onSet('lightnessTarget', v)}
        />
        <SliderRow
          label="Pull"
          value={c.lightnessPull}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onSet('lightnessPull', v)}
          description="0 leaves every hue at its own chroma peak; 1 flattens them all onto the target."
        />
      </PropertyGroup>

      <PropertyGroup title="Chroma">
        <SliderRow
          label="Fraction of cap"
          value={c.chromaFraction}
          min={0.4}
          max={1}
          step={0.01}
          onChange={(v) => onSet('chromaFraction', v)}
        />
        <SliderRow
          label="Equalize"
          value={c.equalize}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onSet('equalize', v)}
          description="Pulls chroma toward the set mean. The weak hues are already at the gamut ceiling, so this buys their chroma by moving lightness."
        />
      </PropertyGroup>
    </>
  );
}

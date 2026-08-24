import type { CSSProperties, ReactElement } from 'react';
import type { RenderLayer, SceneCanvasApi } from '@weasel-js/core';
import { useActionsRegistry } from '@weasel-js/core';
import { useHud } from '@weasel-js/hud/react';
import type { LoupeMode } from '@weasel-js/hud';
import { Button, NumberField, Radio, RadioGroup, Switch } from '@weasel-js/ui';
import { useColorContext } from './tools/colorContext';
import { useLoupe } from './useLoupe';

/** Dynamic color reaches the stylesheet as a custom property, matching
 *  `ActiveSwatches` — the app's one sanctioned inline-style shape. */
function swatchStyle(color: string | null): CSSProperties {
  return { ['--wd-loupe-swatch-color' as string]: color ?? 'transparent' } as CSSProperties;
}

export interface LoupeControlsProps {
  canvasRef: { current: SceneCanvasApi | null };
  /** Layers the loupe re-renders through its magnified inner view. */
  source: RenderLayer<unknown>[];
}

/**
 * Loupe toggle plus its mode / magnification / color readout, for the
 * tool-options strip. A click inside the lens picks the color there into the
 * focused swatch. Mounted only once the canvas ref is populated: both
 * `useHud` and `createLoupe` read it in a mount effect and neither retries.
 */
export function LoupeControls({ canvasRef, source }: LoupeControlsProps): ReactElement {
  const hud = useHud(canvasRef);
  const colors = useColorContext();
  const actions = useActionsRegistry();

  // A pick is the swatch edit arriving from a different control: it sets the
  // focused paint and, through the same action the swatch dispatches, paints
  // the selection with it.
  const onPick = (hex: string): void => {
    colors.setFocusedColor(hex);
    const ctrl = actions?.begin(colors.focused === 'fill' ? 'setFill' : 'setStroke', { color: hex });
    ctrl?.end('commit');
  };

  const loupe = useLoupe(canvasRef, hud, source, { onPick });

  return (
    <div className="wd-loupe-controls">
      <Switch isSelected={loupe.visible} onChange={() => loupe.toggle()}>
        Loupe
      </Switch>
      {loupe.visible && (
        <>
          <RadioGroup
            aria-label="Loupe mode"
            orientation="horizontal"
            value={loupe.mode}
            onChange={(v) => loupe.setMode(v as LoupeMode)}
          >
            <Radio value="vector">Vector</Radio>
            <Radio value="pixel">Pixel</Radio>
          </RadioGroup>
          <NumberField
            aria-label="Magnification"
            className="wd-loupe-factor"
            value={loupe.factor}
            minValue={2}
            maxValue={16}
            step={1}
            onChange={loupe.setFactor}
          />
          <span className="wd-loupe-readout">
            <span className="wd-loupe-swatch" style={swatchStyle(loupe.color)} />
            <code>{loupe.color ?? '—'}</code>
            <Button
              size="sm"
              variant="ghost"
              disabled={!loupe.color}
              onClick={() => { if (loupe.color) void navigator.clipboard.writeText(loupe.color); }}
            >
              Copy
            </Button>
          </span>
        </>
      )}
    </div>
  );
}

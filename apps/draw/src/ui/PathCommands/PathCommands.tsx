/**
 * Simplify and Offset Path in the command bar, as sliders in popovers. Dragging a slider previews its command on the selection and
 * releasing it commits one undo entry. The Simplify slider is also the
 * tolerance path edit's Simplify brush refits at.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useActionsRegistry, useLatest, useOngoingAction } from '@weasel-js/core';
import { BarPopover } from '@weasel-js/ui/components/Bar';
import { Slider } from '@weasel-js/ui/components/Slider';
import s from './PathCommands.module.css';

const readout = (t: { value: number }): string => t.value.toFixed(1);

export function PathCommands(): ReactElement {
  const simplify = useOngoingAction('simplifyPath');
  const offset = useOngoingAction('offsetPath');
  const [tolerance, setTolerance] = useState(1);
  const registry = useActionsRegistry();
  const brushTolerance = useLatest(tolerance);
  useEffect(
    () => registry?.tune('simplifyBrush', { params: () => ({ tolerance: brushTolerance.current }) }),
    [registry, brushTolerance],
  );
  const [distance, setDistance] = useState(0);

  return (
    <div className="wd-commandbar-group">
      <BarPopover label="Simplify">
        <Slider
          className={s.slider}
          ariaLabel="Simplify tolerance"
          min={0.1}
          max={20}
          step={0.1}
          thumbs={[{ value: tolerance }]}
          onInput={([t]) => {
            setTolerance(t.value);
            simplify.input({ tolerance: t.value });
          }}
          onChange={([t]) => simplify.commit({ tolerance: t.value })}
          readoutPlacement="inline-after"
          renderReadout={readout}
        />
      </BarPopover>
      <BarPopover label="Offset">
        <Slider
          className={s.slider}
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
      </BarPopover>
    </div>
  );
}

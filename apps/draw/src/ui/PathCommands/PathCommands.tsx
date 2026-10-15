/**
 * The path commands in the command bar: the kit's `path` group (Cut at
 * Crossings, Join) as buttons, and Simplify and Offset Path as sliders in
 * popovers. Dragging a slider previews its command on the selection and
 * releasing it commits one undo entry.
 */
import { useState, type ReactElement } from 'react';
import { useOngoingAction } from '@weasel-js/core';
import { ActionBar, BarPopover, Slider } from '@weasel-js/ui';
import s from './PathCommands.module.css';

const readout = (t: { value: number }): string => t.value.toFixed(1);

export function PathCommands(): ReactElement {
  const simplify = useOngoingAction('simplifyPath');
  const offset = useOngoingAction('offsetPath');
  const [tolerance, setTolerance] = useState(1);
  const [distance, setDistance] = useState(0);

  return (
    <div className="wd-commandbar-group">
      <ActionBar group="path" />
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

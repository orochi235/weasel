/**
 * Corner shape in the command bar: the kit's corner controls, in a popover,
 * over the selected corners of the path open in path edit.
 */
import type { ReactElement } from 'react';
import {
  CORNER_CONTROLS,
  useCornerControls,
  type CornerControlsScene,
  type CornerControlsSelection,
} from '@weasel-js/core';
import { BarPopover, PrefsForm } from '@weasel-js/ui';
import s from './CornerShape.module.css';

export interface CornerShapeProps {
  scene: CornerControlsScene;
  selection: CornerControlsSelection;
}

export function CornerShape({ scene, selection }: CornerShapeProps): ReactElement {
  const { values, mixed, onChange } = useCornerControls(scene, selection);
  return (
    <div className="wd-commandbar-group">
      <BarPopover label="Corner shape">
        <div className={s.panel}>
          {values.count === 0 && (
            <p className={s.prompt}>Click a corner anchor (Shift-click for more) to edit it</p>
          )}
          <PrefsForm schema={CORNER_CONTROLS} layout="list" values={values} mixed={mixed} onChange={onChange} />
        </div>
      </BarPopover>
    </div>
  );
}

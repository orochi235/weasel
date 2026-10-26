/**
 * Corner shape in the command bar: path-tools' corner controls, in a popover,
 * over the selected corners of the path open in path edit.
 */
import type { ReactElement } from 'react';
import {
  useCornerControls,
  type CornerControlsScene,
  type CornerControlsSelection,
} from '@weasel-js/path-tools';
import { BarPopover } from '@weasel-js/ui/components/Bar';
import { Toolbar } from '@weasel-js/ui/components/Toolbar';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import s from './CornerShape.module.css';

export interface CornerShapeProps {
  scene: CornerControlsScene;
  selection: CornerControlsSelection;
}

export function CornerShape({ scene, selection }: CornerShapeProps): ReactElement {
  const { schema, prompt, values, mixed, onChange } = useCornerControls(scene, selection);
  return (
    <Toolbar.Group className="wd-commandbar-group">
      <BarPopover label={schema.name}>
        <div className={s.panel}>
          {prompt && <p className={s.prompt}>{prompt}</p>}
          <PrefsForm schema={schema} layout="list" values={values} mixed={mixed} onChange={onChange} />
        </div>
      </BarPopover>
    </Toolbar.Group>
  );
}

/**
 * The corner panel of the corner-shape lab: path-tools' corner controls over the
 * selected corners of the open path, mixed where they differ.
 */
import {
  CORNER_CONTROLS,
  useCornerControls,
  type CornerControlsScene,
  type CornerControlsSelection,
} from '@weasel-js/path-tools';
import { PrefsForm } from '@weasel-js/ui';
import s from './CornerShapeLabDemo.module.css';

export function CornerPanel({ scene, selection }: { scene: CornerControlsScene; selection: CornerControlsSelection }) {
  const { values, mixed, onChange } = useCornerControls(scene, selection);
  return (
    <div className={s.panel}>
      {values.count === 0 && (
        <p className={s.prompt}>Click a corner anchor (Shift-click for more) to edit it</p>
      )}
      <PrefsForm schema={CORNER_CONTROLS} layout="list" values={values} mixed={mixed} onChange={onChange} />
    </div>
  );
}

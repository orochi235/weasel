/**
 * The corner panel of the corner-shape lab: path-tools' corner controls over the
 * selected corners of the open path, mixed where they differ.
 */
import {
  useCornerControls,
  type CornerControlsScene,
  type CornerControlsSelection,
} from '@weasel-js/path-tools';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import s from './CornerShapeLabDemo.module.css';

export function CornerPanel({ scene, selection }: { scene: CornerControlsScene; selection: CornerControlsSelection }) {
  const { schema, prompt, values, mixed, onChange } = useCornerControls(scene, selection);
  return (
    <div className={s.panel}>
      {prompt && <p className={s.prompt}>{prompt}</p>}
      <PrefsForm schema={schema} layout="list" values={values} mixed={mixed} onChange={onChange} />
    </div>
  );
}

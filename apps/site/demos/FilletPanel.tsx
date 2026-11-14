/**
 * The panel of the Fillet lab: path-tools' fillet controls over the
 * selected corners of the open path, mixed where they differ.
 */
import {
  useFilletControls,
  type FilletControlsScene,
  type FilletControlsSelection,
} from '@weasel-js/path-tools';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import s from './FilletLabDemo.module.css';

export function FilletPanel({ scene, selection }: { scene: FilletControlsScene; selection: FilletControlsSelection }) {
  const { schema, prompt, values, mixed, onChange } = useFilletControls(scene, selection);
  return (
    <div className={s.panel}>
      {prompt && <p className={s.prompt}>{prompt}</p>}
      <PrefsForm schema={schema} layout="list" values={values} mixed={mixed} onChange={onChange} />
    </div>
  );
}

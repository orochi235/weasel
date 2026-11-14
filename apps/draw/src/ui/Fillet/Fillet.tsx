/**
 * Fillet: path-tools' fillet controls over the selected corners of the path open in path edit, with the prompt
 * they show while no corner is selected.
 */
import type { ReactElement } from 'react';
import {
  useFilletControls,
  type FilletControlsScene,
  type FilletControlsSelection,
} from '@weasel-js/path-tools';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import s from './Fillet.module.css';

export interface FilletProps {
  scene: FilletControlsScene;
  selection: FilletControlsSelection;
  className?: string;
}

export function Fillet({ scene, selection, className }: FilletProps): ReactElement {
  const { schema, prompt, values, mixed, onChange } = useFilletControls(scene, selection);
  return (
    <div className={className}>
      {prompt && <p className={s.prompt}>{prompt}</p>}
      <PrefsForm schema={schema} layout="list" values={values} mixed={mixed} onChange={onChange} />
    </div>
  );
}

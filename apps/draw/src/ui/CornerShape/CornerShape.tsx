/**
 * Corner shape: path-tools' corner controls over the selected corners of the path open in path edit, with the prompt
 * they show while no corner is selected.
 */
import type { ReactElement } from 'react';
import {
  useCornerControls,
  type CornerControlsScene,
  type CornerControlsSelection,
} from '@weasel-js/path-tools';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import s from './CornerShape.module.css';

export interface CornerShapeProps {
  scene: CornerControlsScene;
  selection: CornerControlsSelection;
  className?: string;
}

export function CornerShape({ scene, selection, className }: CornerShapeProps): ReactElement {
  const { schema, prompt, values, mixed, onChange } = useCornerControls(scene, selection);
  return (
    <div className={className}>
      {prompt && <p className={s.prompt}>{prompt}</p>}
      <PrefsForm schema={schema} layout="list" values={values} mixed={mixed} onChange={onChange} />
    </div>
  );
}

import { Button } from '../Button';
import s from './PrefMixed.module.css';

/**
 * What every params surface draws in place of a `list` or `map` leaf's editor where the values it stands for
 * differ. With `onReplace` it offers to start them all over from nothing, after which the editor is drawn.
 */
export function PrefMixed({ onReplace }: { onReplace?(): void }) {
  return (
    <span className={s.mixed}>
      <span className={s.word} data-wzl-subordinate="">Mixed</span>
      {onReplace && <Button variant="ghost" size="sm" onClick={onReplace}>Replace all</Button>}
    </span>
  );
}

import type { PrefLeaf } from '@weasel-js/prefs';
import s from './PrefWords.module.css';

/** Whether a leaf is a `label` or a `separator`: drawn across the rows with no label column, and holding no value. */
export function prefDrawsNoControl(leaf: PrefLeaf): boolean {
  return leaf.kind === 'label' || leaf.kind === 'separator';
}

/** A `label` leaf as every params surface draws it: its name as a line of text, and its description as the note under it. */
export function PrefLabelLine({ pref }: { pref: PrefLeaf }) {
  return (
    <div className={s.label}>
      <span className={s.labelText}>{pref.name}</span>
      {pref.description !== '' && <span className={s.labelNote}>{pref.description}</span>}
    </div>
  );
}

/** A `separator` leaf as every params surface draws it among its rows: a rule across them. */
export function PrefRule() {
  return <hr className={s.rule} />;
}

/** The drawing of a leaf that {@link prefDrawsNoControl}. */
export function PrefWords({ pref }: { pref: PrefLeaf }) {
  return pref.kind === 'separator' ? <PrefRule /> : <PrefLabelLine pref={pref} />;
}

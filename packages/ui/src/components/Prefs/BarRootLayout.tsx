import { useMemo, type ReactNode } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import type { BarOrientation } from '../Bar/BarLayout';
import { withDrop, type PrefDrop } from './drop';
import { useDropMotion } from './dropMotion';
import { formAttrs, useDropFrame } from './dropTarget';
import { PaneBar } from './PrefsPane';
import type { WalkCtx } from './PrefsRow';
import type { SelectionRoot } from './selection';
import s from './Prefs.module.css';

/** A root drawn as a bar: the form is that one bar. A drop anywhere on the form but beside a cell lands at its end. */
export function BarRootLayout(props: {
  root: PrefGroup;
  /** Everything the cells read but the drop, which the layout settles. */
  ctx: WalkCtx;
  drop?: PrefDrop | null;
  selection: SelectionRoot;
  orientation?: BarOrientation;
  filterField: ReactNode;
  className?: string;
}) {
  const { root, selection } = props;
  const drop = useDropFrame(selection.ref, props.drop, root, '');
  useDropMotion(selection.ref, props.drop !== undefined, drop, root, '');
  const drawn = useMemo(() => (drop ? withDrop(root, drop) : root), [root, drop]);
  return (
    <div className={[s.barRoot, props.className].filter(Boolean).join(' ')} data-pref-into="" {...formAttrs(drop)} {...selection}>
      {props.filterField}
      <PaneBar ctx={{ ...props.ctx, drop }} group={drawn} path="" depth={0} orientation={props.orientation} />
    </div>
  );
}

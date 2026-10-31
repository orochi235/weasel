import type { ReactNode } from 'react';
import { Caret } from '../Caret';
import s from './Bar.module.css';

/** What a bar's popover or menu button reads: its glyph, its name and a caret. */
export function PopFace({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <>
      {icon}
      <span className={s.popLabel}>{label}</span>
      <Caret className={s.caret} />
    </>
  );
}

/** The attribute marking a bar's popover or menu button that has a glyph, which a vertical bar shows it by alone. */
export const popIconAttr = (icon: ReactNode) => ({ 'data-icon': icon == null ? undefined : '' });

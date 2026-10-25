import type { ReactNode } from 'react';
import s from './offTitle.module.css';

/** The name of a group or a section in a heading that is no frame, dimmed while `off`, as `MotifFrame disabled` dims a frame's title. */
export function offTitle(name: ReactNode, off: boolean): ReactNode {
  return off ? <span className={s.off}>{name}</span> : name;
}

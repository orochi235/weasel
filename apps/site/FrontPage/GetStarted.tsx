import blocks from 'virtual:get-started';
import { Prose } from '../Prose';
import s from './GetStarted.module.css';

/** Install and overview, from core's README. */
export function GetStarted() {
  return (
    <article className={s.page}>
      <header>
        <div className="ckd-eyebrow">Guide</div>
        <h2 className={s.heading}>Get started</h2>
      </header>
      <Prose blocks={blocks} />
    </article>
  );
}

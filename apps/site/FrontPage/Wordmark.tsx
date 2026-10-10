import s from './Wordmark.module.css';

/** The "weasel" logotype. Sized by the font size of whatever holds it. */
export function Wordmark() {
  return (
    <span className={s.wordmark}>
      w<span className={s.tail}>easel</span>
    </span>
  );
}

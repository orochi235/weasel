import s from './OpacityHud.module.css';

export interface OpacityHudProps {
  /** Whole-number percent 0..100, or null to hide. */
  percent: number | null;
}

/**
 * Transient chip rendered inside `.wd-canvas-host` while the opacity-scrub
 * session is active. Fades out (200ms) when `percent` returns to null.
 */
export function OpacityHud({ percent }: OpacityHudProps) {
  const display = percent ?? 0;
  return (
    <div
      className={`${s.hud} ${percent === null ? s.hudHidden : s.hudVisible}`}
      aria-hidden={percent === null}
    >
      Opacity {display}%
    </div>
  );
}

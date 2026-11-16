import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { clientScaleOf } from '@weasel-js/core';
import { PrefsForm, type PrefsFormProps } from '@weasel-js/ui';
import s from './PrefSchemaEditor.module.css';
import { watchResize } from '@weasel-js/react';

/** The rows the glyph stands beside, by the path a form marks each with. */
const BESIDE = ['name', 'description'];

/**
 * An attributes form whose node has a glyph, drawn beside its name and description rows and as tall as the two.
 * One form, so every row's label and control line up with the rest.
 */
export function IdentityForm({ icon, ...form }: PrefsFormProps & { icon: ReactNode }) {
  const host = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ tall: number; end: number } | null>(null);
  useLayoutEffect(() => {
    const el = host.current;
    if (icon == null || el === null) return;
    const rows = BESIDE.map((p) => el.querySelector(`[data-pref-path="${p}"]`)).filter((r): r is Element => r !== null);
    const measure = (): void => {
      if (rows.length === 0) return setBox(null);
      const at = el.getBoundingClientRect();
      const scale = clientScaleOf(el, at);
      const bottom = Math.max(...rows.map((r) => (r.firstElementChild ?? r).getBoundingClientRect().bottom));
      // Where a slot's content ends, inside the inset the form gives it: the edge every other row's control ends at.
      const slot = rows[0]!;
      const right = slot.getBoundingClientRect().right - parseFloat(getComputedStyle(slot).paddingInlineEnd) * scale.x;
      setBox({ tall: (bottom - at.top) / scale.y, end: (at.right - right) / scale.x });
    };
    measure();
    return watchResize(rows, measure);
  }, [icon, form.schema]);
  if (icon == null) return <PrefsForm {...form} />;
  return (
    <div ref={host} className={s.identity}>
      <PrefsForm {...form} />
      {/* A measured length has no class to name it, so it rides in a custom property. */}
      <span className={s.identityIcon} aria-hidden="true"
        ref={(el) => {
          el?.style.setProperty('--identity-tall', box === null ? '' : `${box.tall}px`);
          el?.style.setProperty('--identity-end', box === null ? '' : `${box.end}px`);
        }}>{icon}</span>
    </div>
  );
}

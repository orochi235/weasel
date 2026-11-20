import type { HeatScale } from './areaData';
import s from './HeatLegend.module.css';

const valueText = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/** A tick's place along the bar is the one thing about it no class can name. */
const placeAt = (el: HTMLElement | null, f: number) => { el?.style.setProperty('--at', f.toFixed(4)); };

/** The heat ramp as one bar, each tick at the place the scale puts its value: round values spaced evenly, then the top. */
export function HeatLegend({ heat }: { heat: HeatScale }) {
  return (
    <span className={s.legend}>
      <i className={s.bar} />
      <span className={s.ticks}>
        {heat.ticks.map((t) => (
          <span key={t.label} ref={(el) => placeAt(el, heat.at(t.value))} className={s.tick} title={`${t.label}: ${valueText(t.value)}`}>
            {t.label === 'top' ? `${valueText(t.value)}+` : valueText(t.value)}
          </span>
        ))}
      </span>
    </span>
  );
}

import type { Stat } from './areaData';
import s from './Stats.module.css';

/** The headline numbers, one tile each. */
export function Stats({ stats }: { stats: readonly Stat[] }) {
  return (
    <section className={s.stats} aria-label="Headline stats">
      {stats.map((stat) => (
        <div key={stat.label} className={s.stat}>
          <b className={s.value}>{stat.value}</b>
          <span className={s.label}>{stat.label}</span>
        </div>
      ))}
    </section>
  );
}

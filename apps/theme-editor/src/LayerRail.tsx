import styles from './ThemeEditor.module.css';
import { LAYERS, type Counts, type LayerId } from './theme/model';

export interface LayerRailProps {
  readonly counts: Counts['layers'];
  readonly selected: LayerId;
  readonly onSelect: (layer: LayerId) => void;
}

export function LayerRail({ counts, selected, onSelect }: LayerRailProps) {
  return (
    <nav className={styles.rail} aria-label="Layers">
      <ul className={styles.railList}>
        {LAYERS.map(({ id, label }) => (
          <li key={id}>
            <button type="button" className={styles.railItem} aria-current={id === selected ? 'true' : undefined} onClick={() => onSelect(id)}>
              <span className={styles.railLabel}>{label}</span>
              <span className={styles.railCount}>{counts[id].count}</span>
              {counts[id].pinned > 0 && <span className={styles.railPinned}>{counts[id].pinned} pinned</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

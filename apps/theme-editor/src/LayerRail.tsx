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
        {LAYERS.map(({ id, label }) => {
          const { count, pinned } = counts[id];
          return (
            <li key={id}>
              <button
                type="button"
                className={styles.railItem}
                aria-label={pinned > 0 ? `${label}, ${count} tokens, ${pinned} pinned` : `${label}, ${count} tokens`}
                aria-current={id === selected ? 'true' : undefined}
                onClick={() => onSelect(id)}
              >
                <span className={styles.railLabel}>{label}</span>
                <span className={styles.railCount}>{count}</span>
                {pinned > 0 && <span className={styles.railPinned}>{pinned} pinned</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

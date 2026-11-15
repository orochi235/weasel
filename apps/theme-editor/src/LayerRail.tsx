import { RailItem, RailList } from '@weasel-js/ui/components/RailList';
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
      <RailList className={styles.railList}>
        {LAYERS.map(({ id, label }) => {
          const { count, pinned } = counts[id];
          return (
            <RailItem
              key={id}
              aria-label={pinned > 0 ? `${label}, ${count} tokens, ${pinned} pinned` : `${label}, ${count} tokens`}
              current={id === selected}
              onClick={() => onSelect(id)}
            >
              <span className={styles.railLabel}>{label}</span>
              <span className={styles.railCount}>{count}</span>
              {pinned > 0 && <span className={styles.railPinned}>{pinned} pinned</span>}
            </RailItem>
          );
        })}
      </RailList>
    </nav>
  );
}

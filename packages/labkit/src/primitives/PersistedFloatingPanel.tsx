import {
  FloatingPanel,
  type FloatingPanelProps,
  type FloatingPlacement,
} from '@weasel-js/ui/components/FloatingPanel';
import { DEFAULT_ANCHOR } from 'windease';
import { usePersistedState } from '../state/usePersistedState';

/** Props for `<PersistedFloatingPanel>`. */
export interface PersistedFloatingPanelProps
  extends Omit<FloatingPanelProps, 'value' | 'onChange'> {
  /** Name to remember its placement under, through `usePersistedState` — so it
   *  is remembered only inside a lab or a `<Persistence>`. Omit to forget on
   *  reload. */
  persist?: string;
}

/** A ui `FloatingPanel` whose placement is remembered across reloads. */
export function PersistedFloatingPanel({
  persist,
  anchor = DEFAULT_ANCHOR,
  ...rest
}: PersistedFloatingPanelProps) {
  const [place, setPlace] = usePersistedState<FloatingPlacement>(persist, () => ({
    x: 0,
    y: 0,
    anchor,
  }));
  return <FloatingPanel {...rest} anchor={anchor} value={place} onChange={setPlace} />;
}

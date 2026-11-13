import { Lab } from '@weasel-js/labkit';
import { StubInstrument } from './StubInstrument';

export function MinimalLab() {
  return (
    <Lab
      instruments={[StubInstrument]}
      storageKey="minimal-lab"
      mode="dark"
      title="Minimal Lab"
    />
  );
}

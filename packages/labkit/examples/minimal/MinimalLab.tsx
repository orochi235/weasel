import { Lab, localStorageAdapter } from '@weasel-js/labkit';
import { StubInstrument } from './StubInstrument';

export function MinimalLab() {
  return (
    <Lab
      instruments={[StubInstrument]}
      defaultInstrument="Stub"
      storage={localStorageAdapter}
      storageKey="minimal-lab"
      mode="dark"
      title="Minimal Lab"
    />
  );
}

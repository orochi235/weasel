import { Lab, localStorageAdapter } from '@lab-kit/react';
import { StubInstrument } from './StubInstrument';

export function MinimalLab() {
  return (
    <Lab
      instruments={[StubInstrument]}
      defaultInstrument="Stub"
      storage={localStorageAdapter}
      storageKey="minimal-lab"
      theme="interstellar"
      title="Minimal Lab"
    />
  );
}

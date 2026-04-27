import { Lab } from '@labkit/react';
import { StubInstrument } from './StubInstrument';

export function MinimalLab() {
  return (
    <Lab
      instruments={[StubInstrument as never]}
      defaultInstrument="Stub"
      storageKey="minimal-lab"
      title="Minimal Lab"
    />
  );
}

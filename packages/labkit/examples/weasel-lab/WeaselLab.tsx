import { Lab } from '@labkit/react';
import { SceneInstrument } from './SceneInstrument';

export function WeaselLab() {
  return (
    <Lab
      instruments={[SceneInstrument]}
      defaultInstrument="WeaselScene"
      storageKey="weasel-lab"
      title="Weasel Lab"
    />
  );
}

import { Lab, localStorageAdapter } from '@lab-kit/react';
import { SceneInstrument } from './SceneInstrument';

export function WeaselLab() {
  return (
    <Lab
      instruments={[SceneInstrument]}
      defaultInstrument="WeaselScene"
      storage={localStorageAdapter}
      storageKey="weasel-lab"
      theme="interstellar"
      title="Weasel Lab"
    />
  );
}

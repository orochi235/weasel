import { Lab, localStorageAdapter } from '@weasel-js/labkit';
import { SceneInstrument } from './SceneInstrument';

export function WeaselLab() {
  return (
    <Lab
      instruments={[SceneInstrument]}
      defaultInstrument="WeaselScene"
      storage={localStorageAdapter}
      storageKey="weasel-lab"
      mode="dark"
      title="Weasel Lab"
    />
  );
}

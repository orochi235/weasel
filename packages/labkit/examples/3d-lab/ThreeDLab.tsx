import { Lab, localStorageAdapter } from '@weasel-js/labkit';
import { SolidInstrument } from './SolidInstrument';

export function ThreeDLab() {
  return (
    <Lab
      instruments={[SolidInstrument]}
      defaultInstrument="Solids"
      storage={localStorageAdapter}
      storageKey="3d-lab"
      mode="dark"
      title="3D Lab"
    />
  );
}

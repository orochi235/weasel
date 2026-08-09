import { Lab, localStorageAdapter } from '@weasel-js/labkit';
import { GardenInstrument } from './GardenInstrument';

export function DragLab() {
  return (
    <Lab
      instruments={[GardenInstrument]}
      defaultInstrument="Garden"
      storage={localStorageAdapter}
      storageKey="drag-lab"
      mode="dark"
      title="Drag Lab"
    />
  );
}

import { Lab, localStorageAdapter } from '@lab-kit/react';
import { GardenInstrument } from './GardenInstrument';

export function DragLab() {
  return (
    <Lab
      instruments={[GardenInstrument]}
      defaultInstrument="Garden"
      storage={localStorageAdapter}
      storageKey="drag-lab"
      theme="interstellar"
      title="Drag Lab"
    />
  );
}

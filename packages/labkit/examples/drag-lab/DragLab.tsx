import { Lab, localStorageAdapter } from '@orochi235/labkit';
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

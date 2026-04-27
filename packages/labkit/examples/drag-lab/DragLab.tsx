import { Lab } from '@labkit/react';
import { GardenInstrument } from './GardenInstrument';

export function DragLab() {
  return (
    <Lab
      instruments={[GardenInstrument]}
      defaultInstrument="Garden"
      storageKey="drag-lab"
      title="Drag Lab"
    />
  );
}

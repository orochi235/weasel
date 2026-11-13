import { Lab } from '@weasel-js/labkit';
import { GardenInstrument } from './GardenInstrument';

export function DragLab() {
  return (
    <Lab
      instruments={[GardenInstrument]}
      storageKey="drag-lab"
      mode="dark"
      title="Drag Lab"
    />
  );
}

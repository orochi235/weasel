import { Lab } from '@weasel-js/labkit';
import { SolidInstrument } from './SolidInstrument';

export function ThreeDLab() {
  return (
    <Lab
      instruments={[SolidInstrument]}
      storageKey="3d-lab"
      mode="dark"
      title="3D Lab"
    />
  );
}

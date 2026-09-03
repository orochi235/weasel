import { Lab, localStorageAdapter } from '@weasel-js/labkit';
import { PartInspector } from './PartInspector';

export function AnnotateLab() {
  return (
    <Lab
      instruments={[PartInspector]}
      defaultInstrument="PartInspector"
      storage={localStorageAdapter}
      storageKey="annotate-lab"
      mode="dark"
      title="Annotate Lab"
    />
  );
}

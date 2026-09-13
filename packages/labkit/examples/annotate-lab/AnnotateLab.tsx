import { Lab } from '@weasel-js/labkit';
import { PartInspector } from './PartInspector';

export function AnnotateLab() {
  return (
    <Lab
      instruments={[PartInspector]}
      defaultInstrument="PartInspector"
      storageKey="annotate-lab"
      mode="dark"
      title="Annotate Lab"
    />
  );
}

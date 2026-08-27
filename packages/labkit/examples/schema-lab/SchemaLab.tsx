import { Lab, useLabContext } from '@weasel-js/labkit';
import { useEffect, useRef } from 'react';
import { ShapeInstrument } from './ShapeInstrument';
import { StrokeInstrument } from './StrokeInstrument';
import './styles.less';

/** Seed the second trial so both instruments are on screen at once. */
function SeedStrokeTrial() {
  const lab = useLabContext();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (lab.trials.length < 2) lab.addTrial('Stroke');
  }, [lab]);
  return null;
}

export function SchemaLab() {
  return (
    <Lab
      instruments={[ShapeInstrument, StrokeInstrument]}
      defaultInstrument="ShapeProperties"
      storage={null}
      mode="dark"
      title="Schema-driven controls"
    >
      <SeedStrokeTrial />
    </Lab>
  );
}

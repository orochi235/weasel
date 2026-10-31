import { useMemo, useState } from 'react';
import { DiagramView, sequenceSpecs, type SequenceData, type SequenceEdit } from '@weasel-js/diagram';
import { DemoStage } from './DemoStage';

const DATA: SequenceData = {
  participants: [
    { id: 'shopper', label: 'Shopper', outline: 'actor' },
    { id: 'web', label: 'Web app' },
    { id: 'api', label: 'Orders API', outline: 'boundary' },
    { id: 'db', label: 'Orders', outline: 'cylinder' },
  ],
  steps: [
    { kind: 'message', id: 'place', from: 'shopper', to: 'web', text: 'Place order', line: 'solid', head: 'arrow', activate: 'to' },
    { kind: 'message', id: 'post', from: 'web', to: 'api', text: 'POST /orders', line: 'solid', head: 'arrow' },
    {
      kind: 'fragment', id: 'card', type: 'alt', sections: [
        { label: 'card accepted', steps: [
          { kind: 'message', id: 'insert', from: 'api', to: 'db', text: 'insert', line: 'solid', head: 'arrow' },
          { kind: 'message', id: 'ok', from: 'db', to: 'api', text: 'ok', line: 'dashed', head: 'arrow' },
        ] },
        { label: 'declined', steps: [{ kind: 'message', id: 'declined', from: 'api', to: 'web', text: '402', line: 'dashed', head: 'cross' }] },
      ],
    },
    { kind: 'note', id: 'retry', over: ['web', 'api'], text: 'retries twice' },
    { kind: 'message', id: 'done', from: 'web', to: 'shopper', text: 'Confirmation', line: 'dashed', head: 'arrow', deactivate: 'from' },
  ],
  autonumber: 1,
};

export function SequenceDiagramDemo() {
  const [data, setData] = useState(DATA);
  const specs = useMemo(() => sequenceSpecs(data, { id: 'checkout' }), [data]);
  const onEditSequence = (edit: SequenceEdit) => setData(edit.data);
  return (
    <DemoStage width={760} height={520}>
      <DiagramView specs={specs} onEditSequence={onEditSequence} className="ckd-canvas" />
    </DemoStage>
  );
}

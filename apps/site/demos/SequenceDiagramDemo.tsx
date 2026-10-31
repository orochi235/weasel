import { useMemo, useState } from 'react';
import type { ToolsApi } from '@weasel-js/core';
import { DiagramView, sequenceSpecs, useSequenceTools, type SequenceData, type SequenceEdit } from '@weasel-js/diagram';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
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
  const [palette, setPalette] = useState<ToolsApi | null>(null);
  const specs = useMemo(() => sequenceSpecs(data, { id: 'checkout' }), [data]);
  const onEditSequence = (edit: SequenceEdit) => setData(edit.data);
  // The data is the demo's, so the tools report their edits here too; with one sequence, a click off it starts nothing.
  const tools = useSequenceTools({ commit: onEditSequence, start: null });
  return (
    <div>
      {palette && <ToolPalette tools={palette} orientation="horizontal" />}
      <DemoStage width={760} height={420}>
        <DiagramView specs={specs} onEditSequence={onEditSequence} tools={tools} onToolsCreated={setPalette} className="ckd-canvas" />
      </DemoStage>
    </div>
  );
}

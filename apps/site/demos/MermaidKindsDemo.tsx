import { useEffect, useState } from 'react';
import { DiagramView, type DiagramSpec } from '@weasel-js/diagram';
import { DIAGRAM_MERMAID, documentSpecs } from '@weasel-js/diagram-formats';
import architectureText from './mermaidKinds/architecture.mmd?raw';
import blockText from './mermaidKinds/block.mmd?raw';
import c4Text from './mermaidKinds/c4.mmd?raw';
import classText from './mermaidKinds/class.mmd?raw';
import erText from './mermaidKinds/er.mmd?raw';
import kanbanText from './mermaidKinds/kanban.mmd?raw';
import mindmapText from './mermaidKinds/mindmap.mmd?raw';
import requirementText from './mermaidKinds/requirement.mmd?raw';
import stateText from './mermaidKinds/state.mmd?raw';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { DemoStage } from './DemoStage';

const SAMPLES = {
  class: classText, state: stateText, er: erText, mindmap: mindmapText, requirement: requirementText,
  block: blockText, architecture: architectureText, c4: c4Text, kanban: kanbanText,
};
type Kind = keyof typeof SAMPLES;
const KINDS = (Object.keys(SAMPLES) as Kind[]).map((value) => ({ value, label: value }));

export function MermaidKindsDemo() {
  const [kind, setKind] = useState<Kind>('class');
  const [specs, setSpecs] = useState<DiagramSpec[]>([]);
  useEffect(() => {
    let live = true;
    void Promise.resolve(DIAGRAM_MERMAID.read!(SAMPLES[kind])).then(({ document }) => {
      if (live) setSpecs(documentSpecs(document).specs);
    });
    return () => { live = false; };
  }, [kind]);
  return (
    <div className="ckd-stack">
      <SegmentedBar items={KINDS} value={kind} onChange={(k) => k && setKind(k)} aria-label="Diagram kind" size="sm" />
      <DemoStage width={640} height={380}>
        <DiagramView specs={specs} refit="always" className="ckd-canvas" />
      </DemoStage>
    </div>
  );
}

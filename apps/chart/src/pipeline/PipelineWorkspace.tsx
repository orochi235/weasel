import { EffectEditor, type EditorLook, type EffectEditorApi, type EffectStageType } from '@weasel-js/diagram/effect';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { ParamPanel } from './ParamPanel';
import { usePipelineCommands } from './pipelineCommands';
import { useClusterCommands } from './pipelineClusters';
import { useLookCommands } from './pipelineLook';
import { usePipelinePageCommands } from './pipelinePages';
import { usePipelineRun } from './pipelineRun';
import { StagePalette } from './StagePalette';
import type { PipelineDoc } from './usePipelineDoc';
import '../workspace.css';

/** Pipeline mode: the document is an effect pipeline, edited as data through `EffectEditor`, drawn in `look`. */
export function PipelineWorkspace({ pipeline, look, setLook }: {
  pipeline: PipelineDoc;
  look: EditorLook;
  setLook: (look: EditorLook) => void;
}): ReactElement {
  const direction = useLookCommands(look, setLook);
  usePipelinePageCommands(pipeline);
  const { doc, change } = pipeline;
  const { run, rows } = usePipelineRun(doc.pipeline);
  const options = useMemo(() => ({ ...rows, direction }), [rows, direction]);
  const editor = useRef<EffectEditorApi | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [pickedCluster, setPickedCluster] = useState<string | null>(null);
  // An undo can take the picked stage or cluster away.
  const selected = picked !== null && doc.pipeline.stages.some((s) => s.id === picked) ? picked : null;
  const cluster = pickedCluster !== null && doc.pipeline.clusters?.some((g) => g.id === pickedCluster) ? pickedCluster : null;
  const [many, setMany] = useState<readonly string[]>([]);
  const dropPicks = useCallback(() => {
    setPicked(null);
    setPickedCluster(null);
    setMany([]);
  }, []);
  usePipelineCommands(pipeline, dropPicks);
  const pickCluster = useCallback((id: string | null) => {
    setPickedCluster(id);
    if (id !== null) setPicked(null);
  }, []);
  const pick = useCallback((id: string | null, ids: readonly string[]) => {
    setPicked(id);
    setMany(ids);
  }, []);
  const live = (id: string) => doc.pipeline.stages.some((s) => s.id === id) || doc.pipeline.clusters?.some((g) => g.id === id) === true;
  const pickMade = useCallback((id: string | null) => {
    pickCluster(id);
    setMany(id === null ? [] : [id]);
  }, [pickCluster]);
  useClusterCommands(editor, { stage: selected, cluster, picked: many.filter(live), pickCluster: pickMade });

  const add = useCallback((type: EffectStageType) => {
    const id = editor.current?.addStage(type);
    if (id === undefined) return;
    pick(id, [id]);
    setPickedCluster(null);
  }, [pick]);

  return (
    <div className="wc-body">
      <Sidebar side="left" className="wc-sidebar" aria-label="Stages">
        <StagePalette onAdd={add} />
      </Sidebar>
      <div className="wc-host">
        <EffectEditor
          // The editor opens fitted, so a new direction gets a new editor, as a new look does.
          key={look === 'rack' ? direction : look}
          ref={editor} doc={doc} onChange={change} look={look} options={options} run={run} selected={selected} onSelect={pick}
          selectedCluster={cluster} onSelectCluster={pickCluster}
        />
      </div>
      <Sidebar side="right" className="wc-sidebar" aria-label="Params">
        <ParamPanel doc={doc} selected={selected} cluster={cluster} change={change} preview={pipeline.preview} cancel={pipeline.cancel} />
      </Sidebar>
    </div>
  );
}

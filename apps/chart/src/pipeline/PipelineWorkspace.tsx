import { EffectEditor, type EditorLook, type EffectEditorApi, type EffectStageType } from '@weasel-js/diagram/effect';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { ParamPanel } from './ParamPanel';
import { usePipelineCommands } from './pipelineCommands';
import { useGroupCommands } from './pipelineGroups';
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
  usePipelineCommands(pipeline);
  const direction = useLookCommands(look, setLook);
  usePipelinePageCommands(pipeline);
  const { doc, change } = pipeline;
  const { run, rows } = usePipelineRun(doc.pipeline);
  const options = useMemo(() => ({ ...rows, direction }), [rows, direction]);
  const editor = useRef<EffectEditorApi | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [pickedGroup, setPickedGroup] = useState<string | null>(null);
  // An undo can take the picked stage or group away.
  const selected = picked !== null && doc.pipeline.stages.some((s) => s.id === picked) ? picked : null;
  const group = pickedGroup !== null && doc.pipeline.groups?.some((g) => g.id === pickedGroup) ? pickedGroup : null;
  const [many, setMany] = useState<readonly string[]>([]);
  const pickGroup = useCallback((id: string | null) => {
    setPickedGroup(id);
    if (id !== null) setPicked(null);
  }, []);
  const pick = useCallback((id: string | null, ids: readonly string[]) => {
    setPicked(id);
    setMany(ids);
  }, []);
  const live = (id: string) => doc.pipeline.stages.some((s) => s.id === id) || doc.pipeline.groups?.some((g) => g.id === id) === true;
  const pickMade = useCallback((id: string | null) => {
    pickGroup(id);
    setMany(id === null ? [] : [id]);
  }, [pickGroup]);
  useGroupCommands(editor, { stage: selected, group, picked: many.filter(live), pickGroup: pickMade });

  const add = useCallback((type: EffectStageType) => {
    const id = editor.current?.addStage(type);
    if (id !== undefined) pick(id, [id]);
  }, [pick]);

  return (
    <div className="wc-body">
      <Sidebar side="left" className="wc-sidebar" ariaLabel="Stages">
        <StagePalette onAdd={add} />
      </Sidebar>
      <div className="wc-host">
        <EffectEditor
          // The editor opens fitted, so a new direction gets a new editor, as a new look does.
          key={look === 'rack' ? direction : look}
          ref={editor} doc={doc} onChange={change} look={look} options={options} run={run} selected={selected} onSelect={pick}
          selectedGroup={group} onSelectGroup={pickGroup}
        />
      </div>
      <Sidebar side="right" className="wc-sidebar" ariaLabel="Params">
        <ParamPanel doc={doc} selected={selected} group={group} change={change} />
      </Sidebar>
    </div>
  );
}

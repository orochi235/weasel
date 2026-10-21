import { EffectEditor, type EditorLook, type EffectEditorApi, type EffectStageType } from '@weasel-js/diagram/effect';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { useCallback, useRef, useState, type ReactElement } from 'react';
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
  useLookCommands(look, setLook);
  usePipelinePageCommands(pipeline);
  const { doc, change } = pipeline;
  const { run, rows } = usePipelineRun(doc.pipeline);
  const editor = useRef<EffectEditorApi | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [pickedGroup, setPickedGroup] = useState<string | null>(null);
  // An undo can take the picked stage or group away.
  const selected = picked !== null && doc.pipeline.stages.some((s) => s.id === picked) ? picked : null;
  const group = pickedGroup !== null && doc.pipeline.groups?.some((g) => g.id === pickedGroup) ? pickedGroup : null;
  const pickGroup = useCallback((id: string | null) => {
    setPickedGroup(id);
    if (id !== null) setPicked(null);
  }, []);
  useGroupCommands(editor, { stage: selected, group, pickGroup });

  const add = useCallback((type: EffectStageType) => {
    const id = editor.current?.addStage(type);
    if (id !== undefined) setPicked(id);
  }, []);

  return (
    <div className="wc-body">
      <Sidebar side="left" className="wc-sidebar" ariaLabel="Stages">
        <StagePalette onAdd={add} />
      </Sidebar>
      <div className="wc-host">
        <EffectEditor
          ref={editor} doc={doc} onChange={change} look={look} options={rows} run={run} selected={selected} onSelect={setPicked}
          selectedGroup={group} onSelectGroup={pickGroup}
        />
      </div>
      <Sidebar side="right" className="wc-sidebar" ariaLabel="Params">
        <ParamPanel doc={doc} selected={selected} group={group} change={change} />
      </Sidebar>
    </div>
  );
}

import { toolSetHas, useLatest, type Tool, type ToolsApi } from '@weasel-js/core';
import {
  SEQUENCE_TOOLS, findStep, sequenceRootOf, sequenceSelectionOf, setFragmentType, setMessageArrow, setParticipantOutline,
  type SeqArrowName, type SeqFragment, type SeqMark, type SeqParticipantKind, type SequenceToolsOptions,
} from '@weasel-js/diagram';
import { Select } from '@weasel-js/ui/components/Select';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { useMemo, useState, type ReactElement } from 'react';
import type { ChartScene } from './chartDocument';
import { arrowNameOf, commitSelected, foldEach, SequenceEdits } from './SequenceEdits';

/** A sequence tool, which the Sequence panel holds rather than the main palette. */
export const isSequenceTool = (tool: Tool): boolean => toolSetHas(SEQUENCE_TOOLS, tool.id);

/** What the sequence tools add, as the Sequence panel's pickers set it. */
export interface SequenceChoices {
  participant: SeqParticipantKind;
  arrow: SeqArrowName;
  fragment: SeqFragment['type'];
  mark: SeqMark['kind'];
}

const DEFAULT_CHOICES: SequenceChoices = { participant: 'participant', arrow: 'sync', fragment: 'loop', mark: 'activate' };

const PARTICIPANTS: readonly { value: SeqParticipantKind; label: string }[] = [
  { value: 'participant', label: 'Participant' }, { value: 'actor', label: 'Actor' },
];
const ARROWS: readonly { value: SeqArrowName; label: string }[] = [
  { value: 'sync', label: 'Call' }, { value: 'reply', label: 'Reply' }, { value: 'async', label: 'Async' },
  { value: 'lost', label: 'Lost' }, { value: 'both', label: 'Both ways' }, { value: 'line', label: 'Line' },
  { value: 'dashed', label: 'Dashed line' },
];
const FRAGMENTS: readonly { value: SeqFragment['type']; label: string }[] = [
  { value: 'loop', label: 'Loop' }, { value: 'alt', label: 'Alt' }, { value: 'opt', label: 'Opt' }, { value: 'par', label: 'Par' },
  { value: 'critical', label: 'Critical' }, { value: 'break', label: 'Break' }, { value: 'region', label: 'Colored region' },
];
const MARKS: readonly { value: SeqMark['kind']; label: string }[] = [
  { value: 'activate', label: 'Activate' }, { value: 'deactivate', label: 'Deactivate' }, { value: 'create', label: 'Create' },
  { value: 'destroy', label: 'Destroy' },
];

/** The Sequence panel's choices, and the readers the sequence tools take them through. */
export function useSequenceChoices(): {
  choices: SequenceChoices;
  set: (patch: Partial<SequenceChoices>) => void;
  readers: Pick<SequenceToolsOptions, 'participant' | 'arrow' | 'fragment' | 'mark'>;
} {
  const [choices, setChoices] = useState(DEFAULT_CHOICES);
  const latest = useLatest(choices);
  const readers = useMemo(() => ({
    participant: () => latest.current.participant, arrow: () => latest.current.arrow, fragment: () => latest.current.fragment,
    mark: () => latest.current.mark,
  }), [latest]);
  const set = useMemo(() => (patch: Partial<SequenceChoices>) => setChoices((c) => ({ ...c, ...patch })), []);
  return { choices, set, readers };
}

/**
 * The Sequence panel: the tools that add lifelines, messages, notes, fragments, and lifeline marks, and what each adds.
 * A picker also changes what is selected of its kind: the arrow picker a selected message's arrow, the fragment picker a
 * selected fragment's type, the participant picker a selected head's figure. Below them, the edits for the selection
 * (`SequenceEdits`). Open from the start when the chart already holds a sequence.
 */
export function SequencePanel({ tools, scene, selected, choices, onChoose }: {
  tools: ToolsApi;
  scene: ChartScene;
  selected: readonly string[];
  choices: SequenceChoices;
  onChoose: (patch: Partial<SequenceChoices>) => void;
}): ReactElement {
  const [collapsed, setCollapsed] = useState(() => !scene.renderOrderNodes().some((n) => sequenceRootOf(n) !== null));
  const sel = sequenceSelectionOf(scene as never, selected);
  const apply = (fn: (data: NonNullable<typeof sel>['data']) => NonNullable<typeof sel>['data'], label: string) => {
    if (sel !== null) commitSelected(scene, sel, fn(sel.data), label);
  };
  const head = sel?.participants[0] === undefined ? undefined : sel.data.participants.find((p) => p.id === sel.participants[0]);
  const frag = sel?.fragments[0] === undefined ? null : findStep(sel.data.steps, sel.fragments[0]);
  const arrow = sel?.messages[0] === undefined ? null : arrowNameOf(sel.data, sel.messages[0]);
  return (
    <SidebarPanel title="Sequence" collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)}>
      <ToolPalette tools={tools} include={isSequenceTool} columns={5} ariaLabel="Sequence tools" />
      <Select
        label="Adds" orientation="row" width="fit" options={PARTICIPANTS}
        selectedKey={head === undefined ? choices.participant : head.outline === 'actor' ? 'actor' : 'participant'}
        onSelectionChange={(participant) => {
          onChoose({ participant });
          apply((d) => foldEach(d, sel!.participants, (e, id) => setParticipantOutline(e, id, participant === 'actor' ? 'actor' : undefined)), 'Change participant');
        }}
      />
      <Select
        label="Arrow" orientation="row" width="fit" options={ARROWS} selectedKey={arrow ?? choices.arrow}
        onSelectionChange={(name) => {
          onChoose({ arrow: name });
          apply((d) => foldEach(d, sel!.messages, (e, id) => setMessageArrow(e, id, name)), 'Change arrow');
        }}
      />
      <Select
        label="Fragment" orientation="row" width="fit" options={FRAGMENTS}
        selectedKey={frag?.kind === 'fragment' ? frag.type : choices.fragment}
        onSelectionChange={(type) => {
          onChoose({ fragment: type });
          apply((d) => foldEach(d, sel!.fragments, (e, id) => setFragmentType(e, id, type)), 'Change fragment type');
        }}
      />
      <Select
        label="Mark" orientation="row" width="fit" options={MARKS}
        selectedKey={choices.mark} onSelectionChange={(mark) => onChoose({ mark })}
      />
      {sel !== null && <SequenceEdits scene={scene} sel={sel} />}
    </SidebarPanel>
  );
}

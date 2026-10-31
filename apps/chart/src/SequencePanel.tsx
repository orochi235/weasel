import { toolSetHas, useLatest, type Tool, type ToolsApi } from '@weasel-js/core';
import {
  SEQUENCE_TOOLS, sequenceRootOf, type SeqArrowName, type SeqFragment, type SeqParticipantKind, type SequenceToolsOptions,
} from '@weasel-js/diagram';
import { Select } from '@weasel-js/ui/components/Select';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { useMemo, useState, type ReactElement } from 'react';
import type { ChartScene } from './chartDocument';

/** A sequence tool, which the Sequence panel holds rather than the main palette. */
export const isSequenceTool = (tool: Tool): boolean => toolSetHas(SEQUENCE_TOOLS, tool.id);

/** What the sequence tools add, as the Sequence panel's pickers set it. */
export interface SequenceChoices {
  participant: SeqParticipantKind;
  arrow: SeqArrowName;
  fragment: SeqFragment['type'];
}

const DEFAULT_CHOICES: SequenceChoices = { participant: 'participant', arrow: 'sync', fragment: 'loop' };

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

/** The Sequence panel's choices, and the readers the sequence tools take them through. */
export function useSequenceChoices(): {
  choices: SequenceChoices;
  set: (patch: Partial<SequenceChoices>) => void;
  readers: Pick<SequenceToolsOptions, 'participant' | 'arrow' | 'fragment'>;
} {
  const [choices, setChoices] = useState(DEFAULT_CHOICES);
  const latest = useLatest(choices);
  const readers = useMemo(() => ({
    participant: () => latest.current.participant, arrow: () => latest.current.arrow, fragment: () => latest.current.fragment,
  }), [latest]);
  const set = useMemo(() => (patch: Partial<SequenceChoices>) => setChoices((c) => ({ ...c, ...patch })), []);
  return { choices, set, readers };
}

/** The Sequence panel: the tools that add lifelines, messages, notes, and fragments, and what each adds. Open from the
 *  start when the chart already holds a sequence. */
export function SequencePanel({ tools, scene, choices, onChoose }: {
  tools: ToolsApi;
  scene: ChartScene;
  choices: SequenceChoices;
  onChoose: (patch: Partial<SequenceChoices>) => void;
}): ReactElement {
  const [collapsed, setCollapsed] = useState(() => !scene.renderOrderNodes().some((n) => sequenceRootOf(n) !== null));
  return (
    <SidebarPanel title="Sequence" collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)}>
      <ToolPalette tools={tools} include={isSequenceTool} columns={4} ariaLabel="Sequence tools" />
      <Select
        label="Adds" orientation="row" width="fit" options={PARTICIPANTS}
        selectedKey={choices.participant} onSelectionChange={(participant) => onChoose({ participant })}
      />
      <Select
        label="Arrow" orientation="row" width="fit" options={ARROWS}
        selectedKey={choices.arrow} onSelectionChange={(arrow) => onChoose({ arrow })}
      />
      <Select
        label="Fragment" orientation="row" width="fit" options={FRAGMENTS}
        selectedKey={choices.fragment} onSelectionChange={(fragment) => onChoose({ fragment })}
      />
    </SidebarPanel>
  );
}

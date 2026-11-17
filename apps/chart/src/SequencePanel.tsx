import { useToolOptionParams } from '@weasel-js/routing/react';
import { setToolOption, toolSetHas, type Tool, type ToolOptionsSpec, type ToolOptionValues, type ToolsApi } from '@weasel-js/core';
import {
  SEQUENCE_FRAGMENT_OPTIONS, SEQUENCE_MARK_OPTIONS, SEQUENCE_MESSAGE_OPTIONS, SEQUENCE_PARTICIPANT_OPTIONS, SEQUENCE_TOOLS,
  findStep, sequenceRootOf, sequenceSelectionOf, setFragmentType, setMessageArrow, setParticipantOutline,
  type SeqArrowName, type SeqFragment, type SeqMark, type SeqParticipantKind,
} from '@weasel-js/diagram';
import type { PrefEnumOption } from '@weasel-js/prefs';
import { Select } from '@weasel-js/ui/components/Select';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { useState, type ReactElement } from 'react';
import type { ChartScene } from './chartDocument';
import { arrowNameOf, commitSelected, foldEach, SequenceEdits, shownOf } from './SequenceEdits';
import { getOwn } from '@weasel-js/registry';

/** A sequence tool, which the Sequence panel holds rather than the main palette. */
export const isSequenceTool = (tool: Tool): boolean => toolSetHas(SEQUENCE_TOOLS, tool.id);

/** One sequence tool's option: the tool, its options, and the one the panel's picker sets. */
interface Choice {
  tool: string;
  options: ToolOptionsSpec;
  option: string;
}

const PARTICIPANT: Choice = { tool: 'diagram.sequence.participant', options: SEQUENCE_PARTICIPANT_OPTIONS, option: 'kind' };
const MESSAGE: Choice = { tool: 'diagram.sequence.message', options: SEQUENCE_MESSAGE_OPTIONS, option: 'arrow' };
const FRAGMENT: Choice = { tool: 'diagram.sequence.fragment', options: SEQUENCE_FRAGMENT_OPTIONS, option: 'type' };
const MARK: Choice = { tool: 'diagram.sequence.mark', options: SEQUENCE_MARK_OPTIONS, option: 'mark' };

/** The picker's choices, as the option's schema lists them. */
function choicesOf<T extends string>(c: Choice): readonly { value: T; label: string }[] {
  const leaf = getOwn(c.options.prefs.children, c.option);
  const options = leaf && 'options' in leaf ? (leaf.options as readonly PrefEnumOption<T>[]) : [];
  return options.map(({ value, label }) => ({ value, label }));
}

/** What `c`'s tool adds now, from `values`, and the setter its picker calls. */
function useChoice<T extends string>(c: Choice, values: ToolOptionValues): [T, (value: T) => void] {
  const params = useToolOptionParams({ id: c.tool, options: c.options }, values);
  return [(params && getOwn(params, c.option)) as T, (value) => setToolOption(c.tool, c.options, values, c.option, value)];
}

/**
 * The Sequence panel: the tools that add lifelines, messages, notes, fragments, and lifeline marks, and what each adds.
 * A picker also changes what is selected of its kind: the arrow picker a selected message's arrow, the fragment picker a
 * selected fragment's type, the participant picker a selected head's figure. Below them, the edits for the selection
 * (`SequenceEdits`). Open from the start when the chart already holds a sequence.
 */
export function SequencePanel({ tools, scene, selected, values }: {
  tools: ToolsApi;
  scene: ChartScene;
  selected: readonly string[];
  /** Where the sequence tools' options are kept: the canvas's `toolOptionValues` dep. */
  values: ToolOptionValues;
}): ReactElement {
  const [participant, setParticipant] = useChoice<SeqParticipantKind>(PARTICIPANT, values);
  const [arrowChoice, setArrow] = useChoice<SeqArrowName>(MESSAGE, values);
  const [fragment, setFragment] = useChoice<SeqFragment['type']>(FRAGMENT, values);
  const [mark, setMark] = useChoice<SeqMark['kind']>(MARK, values);
  const [collapsed, setCollapsed] = useState(() => !scene.renderOrderNodes().some((n) => sequenceRootOf(n) !== null));
  const sel = sequenceSelectionOf(scene as never, selected);
  const apply = (fn: (data: NonNullable<typeof sel>['data']) => NonNullable<typeof sel>['data'], label: string) => {
    if (sel !== null) commitSelected(scene, sel, fn(sel.data), label);
  };
  // Each picker shows what the selected items of its kind share, nothing for a figure or arrow it doesn't name, and Mixed
  // when they differ, so any choice applies to all of them; with none selected, what its tool adds.
  const shown = <T,>(ids: readonly string[] | undefined, own: T, of: (id: string) => T | null) =>
    ids === undefined || ids.length === 0 ? { selectedKey: own, mixed: false } : shownOf(ids.map(of));
  const headKind = (id: string): SeqParticipantKind | null => {
    const outline = sel!.data.participants.find((p) => p.id === id)?.outline;
    return outline === 'actor' ? 'actor' : outline === undefined || outline === 'rect' ? 'participant' : null;
  };
  const fragType = (id: string): SeqFragment['type'] | null => {
    const f = findStep(sel!.data.steps, id);
    return f?.kind === 'fragment' ? f.type : null;
  };
  return (
    <SidebarPanel title="Sequence" collapsed={collapsed} onCollapsedChange={setCollapsed}>
      <ToolPalette tools={tools} include={isSequenceTool} columns={5} aria-label="Sequence tools" />
      <Select
        label="Adds" orientation="row" width="fit" options={choicesOf<SeqParticipantKind>(PARTICIPANT)}
        {...shown(sel?.participants, participant, headKind)}
        onSelectionChange={(kind) => {
          setParticipant(kind);
          apply((d) => foldEach(d, sel!.participants, (e, id) => setParticipantOutline(e, id, kind === 'actor' ? 'actor' : undefined)), 'Change participant');
        }}
      />
      <Select
        label="Arrow" orientation="row" width="fit" options={choicesOf<SeqArrowName>(MESSAGE)}
        {...shown(sel?.messages, arrowChoice, (id) => arrowNameOf(sel!.data, id))}
        onSelectionChange={(name) => {
          setArrow(name);
          apply((d) => foldEach(d, sel!.messages, (e, id) => setMessageArrow(e, id, name)), 'Change arrow');
        }}
      />
      <Select
        label="Fragment" orientation="row" width="fit" options={choicesOf<SeqFragment['type']>(FRAGMENT)}
        {...shown(sel?.fragments, fragment, fragType)}
        onSelectionChange={(type) => {
          setFragment(type);
          apply((d) => foldEach(d, sel!.fragments, (e, id) => setFragmentType(e, id, type)), 'Change fragment type');
        }}
      />
      <Select
        label="Mark" orientation="row" width="fit" options={choicesOf<SeqMark['kind']>(MARK)}
        selectedKey={mark} onSelectionChange={setMark}
      />
      {sel !== null && <SequenceEdits scene={scene} sel={sel} />}
    </SidebarPanel>
  );
}

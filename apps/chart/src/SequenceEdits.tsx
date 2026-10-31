import {
  SEQ_ARROWS, SEQ_MULTI_SECTION, addBox, addSection, commitSequence, findStep, freshSeqId, removeBox, removeSection, rendererMeasure,
  setAutonumber, setMessageActivation, type SeqArrowName, type SequenceData, type SequenceSelection,
} from '@weasel-js/diagram';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Select } from '@weasel-js/ui/components/Select';
import type { ReactElement } from 'react';
import type { ChartScene } from './chartDocument';

/** Writes `data` as `sel`'s sequence, one undo entry under `label`, when it changed. */
export function commitSelected(scene: ChartScene, sel: SequenceSelection, data: SequenceData, label: string): void {
  if (data !== sel.data) commitSequence(scene as never, sel.root, data, label, { measure: rendererMeasure });
}

/** Each of `ids` folded into `data` by `fn`, in turn. */
export const foldEach = (data: SequenceData, ids: readonly string[], fn: (d: SequenceData, id: string) => SequenceData): SequenceData =>
  ids.reduce(fn, data);

/** The name in `SEQ_ARROWS` message `id` is drawn with, or `null` for an arrow none names. */
export function arrowNameOf(data: SequenceData, id: string): SeqArrowName | null {
  const m = findStep(data.steps, id);
  if (m?.kind !== 'message') return null;
  const hit = Object.entries(SEQ_ARROWS).find(([, a]) => a.line === m.line && a.head === m.head
    && (('both' in a && a.both) === (m.both === true)) && (('async' in a && a.async) === (m.async === true)));
  return (hit?.[0] as SeqArrowName | undefined) ?? null;
}

type End = 'none' | 'from' | 'to';
const ENDS: readonly { value: End; label: string }[] = [
  { value: 'none', label: 'Neither' }, { value: 'from', label: 'Sender' }, { value: 'to', label: 'Receiver' },
];

/** The edits that act on what is selected in a sequence: numbering its messages, a message's activations, a fragment's
 *  sections, and boxing participants. */
export function SequenceEdits({ scene, sel }: { scene: ChartScene; sel: SequenceSelection }): ReactElement {
  const { data } = sel;
  const commit = (next: SequenceData, label: string) => commitSelected(scene, sel, next, label);
  const message = sel.messages[0] === undefined ? null : findStep(data.steps, sel.messages[0]);
  const fragment = sel.fragments[0] === undefined ? null : findStep(data.steps, sel.fragments[0]);
  const boxed = (data.boxes ?? []).filter((b) => sel.boxes.includes(b.id) || b.members.some((m) => sel.participants.includes(m)));
  const activation = (key: 'activate' | 'deactivate', end: End) => commit(
    foldEach(data, sel.messages, (d, id) => setMessageActivation(d, id, { [key]: end === 'none' ? undefined : end })),
    key === 'activate' ? 'Start activation' : 'End activation',
  );
  return (
    <>
      <Checkbox isSelected={data.autonumber !== undefined} onChange={(on) => commit(setAutonumber(data, on ? 1 : undefined), 'Number messages')}>
        Number messages
      </Checkbox>
      {message?.kind === 'message' && (
        <>
          <Select
            label="Activates" orientation="row" width="fit" options={ENDS}
            selectedKey={message.activate ?? 'none'} onSelectionChange={(end) => activation('activate', end)}
          />
          <Select
            label="Deactivates" orientation="row" width="fit" options={ENDS}
            selectedKey={message.deactivate ?? 'none'} onSelectionChange={(end) => activation('deactivate', end)}
          />
        </>
      )}
      {fragment?.kind === 'fragment' && (
        <>
          <Button disabled={!SEQ_MULTI_SECTION.has(fragment.type)} onClick={() => commit(addSection(data, fragment.id), 'Add section')}>
            Add section
          </Button>
          <Button
            disabled={fragment.sections.length < 2}
            onClick={() => commit(removeSection(data, fragment.id, fragment.sections.length - 1), 'Remove section')}
          >
            Remove section
          </Button>
        </>
      )}
      {sel.participants.length > 0 && (
        <Button onClick={() => commit(addBox(data, { id: freshSeqId(data, 'b'), members: sel.participants }), 'Box participants')}>
          Box participants
        </Button>
      )}
      {boxed.length > 0 && (
        <Button onClick={() => commit(foldEach(data, boxed.map((b) => b.id), removeBox), 'Remove box')}>Remove box</Button>
      )}
    </>
  );
}

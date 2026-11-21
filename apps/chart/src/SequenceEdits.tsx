import {
  SEQ_ARROWS, SEQ_MULTI_SECTION, addBox, addSection, commitSequence, findStep, freshSeqId, removeBox, removeMarksOf, removeSection,
  rendererMeasure,
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

/** What a picker over several selected items shows: the value they share, or Mixed when they differ. A shared `null` is
 *  a value the picker doesn't name, and shows nothing. Either way, choosing any value applies it to every item. */
export function shownOf<T>(values: readonly (T | null)[]): { selectedKey: T | null; mixed: boolean } {
  const first = values[0] ?? null;
  return values.every((v) => v === first) ? { selectedKey: first, mixed: false } : { selectedKey: null, mixed: true };
}

type End = 'none' | 'from' | 'to';
const ENDS: readonly { value: End; label: string }[] = [
  { value: 'none', label: 'Neither' }, { value: 'from', label: 'Sender' }, { value: 'to', label: 'Receiver' },
];

/** The edits that act on what is selected in a sequence: numbering its messages, a message's activations, a fragment's
 *  sections, boxing participants, and drawing a created head at the top again. An activation bar or a destruction is
 *  selected and deleted on the canvas. */
export function SequenceEdits({ scene, sel }: { scene: ChartScene; sel: SequenceSelection }): ReactElement {
  const { data } = sel;
  const commit = (next: SequenceData, label: string) => commitSelected(scene, sel, next, label);
  const fragments = sel.fragments.map((id) => findStep(data.steps, id)).filter((f) => f?.kind === 'fragment');
  const uncreated = foldEach(data, sel.participants, (d, id) => removeMarksOf(d, 'create', id));
  const boxed = (data.boxes ?? []).filter((b) => sel.boxes.includes(b.id) || b.members.some((m) => sel.participants.includes(m)));
  const messages = sel.messages.map((id) => findStep(data.steps, id)).filter((m) => m?.kind === 'message');
  const activation = (key: 'activate' | 'deactivate', end: End) => commit(
    foldEach(data, sel.messages, (d, id) => setMessageActivation(d, id, { [key]: end === 'none' ? undefined : end })),
    key === 'activate' ? 'Start activation' : 'End activation',
  );
  return (
    <>
      <Checkbox isSelected={data.autonumber !== undefined} onChange={(on) => commit(setAutonumber(data, on ? 1 : undefined), 'Number messages')}>
        Number messages
      </Checkbox>
      {messages.length > 0 && (
        <>
          <Select
            label="Activates" orientation="row" width="fit" options={ENDS}
            {...shownOf(messages.map((m) => m.activate ?? 'none'))} onSelectionChange={(end) => activation('activate', end)}
          />
          <Select
            label="Deactivates" orientation="row" width="fit" options={ENDS}
            {...shownOf(messages.map((m) => m.deactivate ?? 'none'))} onSelectionChange={(end) => activation('deactivate', end)}
          />
        </>
      )}
      {fragments.length > 0 && (
        <>
          <Button
            disabled={!fragments.some((f) => SEQ_MULTI_SECTION.has(f.type))}
            onClick={() => commit(foldEach(data, fragments.map((f) => f.id), (d, id) => addSection(d, id)), 'Add section')}
          >
            Add section
          </Button>
          <Button
            disabled={!fragments.some((f) => f.sections.length > 1)}
            onClick={() => commit(fragments.reduce((d, f) => removeSection(d, f.id, f.sections.length - 1), data), 'Remove section')}
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
      {uncreated !== data && <Button onClick={() => commit(uncreated, 'Draw head at top')}>Draw head at top</Button>}
      {boxed.length > 0 && (
        <Button onClick={() => commit(foldEach(data, boxed.map((b) => b.id), removeBox), 'Remove box')}>Remove box</Button>
      )}
    </>
  );
}

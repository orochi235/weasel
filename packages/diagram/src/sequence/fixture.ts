/** A small sequence the sequence tests share: three participants, a fragment with two sections, and a note. */
import type { SequenceData } from './types';

export const SEQ_FIXTURE: SequenceData = {
  participants: [
    { id: 'a', label: 'Alice', outline: 'actor' },
    { id: 'b', label: 'Bob' },
    { id: 'c', label: 'Carol', outline: 'cylinder' },
  ],
  steps: [
    { kind: 'message', id: 'm1', from: 'a', to: 'b', text: 'Hello Bob, how are you today?', line: 'solid', head: 'arrow', activate: 'to' },
    {
      kind: 'fragment', id: 'f1', type: 'alt', sections: [
        { label: 'is well', steps: [{ kind: 'message', id: 'm2', from: 'b', to: 'a', text: 'Fine', line: 'dashed', head: 'arrow' }] },
        { label: 'is sick', steps: [{ kind: 'message', id: 'm3', from: 'b', to: 'a', text: 'Not so good', line: 'dashed', head: 'open' }] },
      ],
    },
    { kind: 'note', id: 'n1', over: ['a', 'b'], text: 'A typical exchange' },
    { kind: 'message', id: 'm4', from: 'b', to: 'b', text: 'think', line: 'solid', head: 'arrow', deactivate: 'from' },
    { kind: 'message', id: 'm5', from: 'b', to: 'c', line: 'solid', head: 'cross' },
  ],
};

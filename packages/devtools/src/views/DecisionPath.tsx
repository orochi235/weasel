/** The path one input took, as a powerline: the input, the binding's owner, the action that fired, and whether it was handled. */
import type { ReactElement } from 'react';
import type { DispatchRecord } from '@weasel-js/core/routing';
import { Powerline, type PowerlineSegment } from '@weasel-js/ui/components/Powerline';

function inputText(record: DispatchRecord): string {
  const { eventKind, key } = record.input;
  return key === undefined ? eventKind : `${eventKind} ${key === ' ' ? 'Space' : key}`;
}

export function DecisionPath({ record }: { record: DispatchRecord }): ReactElement {
  const winner = record.ranked.find((r) => r.walk.kind === 'fired' || r.walk.kind === 'would-fire');
  const segments: PowerlineSegment[] = [{ text: inputText(record), grade: 'info', endCap: 'chevron' }];
  if (winner) {
    segments.push(
      { text: winner.candidate.ownerId ?? 'action', emphasis: 'low', endCap: 'chevron' },
      { text: winner.candidate.actionId, emphasis: 'high', endCap: 'chevron' },
    );
  } else {
    segments.push({ text: `${record.ranked.length} ranked, none fired`, emphasis: 'low', endCap: 'chevron' });
  }
  segments.push(record.outcome === 'handled'
    ? { text: record.predicted ? 'would handle' : 'handled', grade: 'success' }
    : { text: 'unhandled', grade: 'danger' });
  return <Powerline segments={segments} size="sm" variant="subtle" aria-label="Decision path" />;
}

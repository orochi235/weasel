/** The path one input took, as a powerline: the input, the binding's owner, the action that fired, and whether it was handled. */
import type { ReactElement } from 'react';
import type { DispatchRecord } from '@weasel-js/core/routing';
import { Badge } from '@weasel-js/ui/components/Badge';
import { Powerline } from '@weasel-js/ui/components/Powerline';
import { keyName } from './keyName';

function inputText(record: DispatchRecord): string {
  const { eventKind, key } = record.input;
  return key === undefined ? eventKind : `${eventKind} ${keyName(key)}`;
}

export function DecisionPath({ record }: { record: DispatchRecord }): ReactElement {
  const winner = record.ranked.find((r) => r.walk.kind === 'fired' || r.walk.kind === 'would-fire');
  return (
    <Powerline size="sm" variant="subtle" aria-label="Decision path">
      <Badge grade="info" endCap="chevron">{inputText(record)}</Badge>
      {winner ? (
        <>
          <Badge emphasis="low" endCap="chevron">{winner.candidate.ownerId ?? 'action'}</Badge>
          <Badge emphasis="high" endCap="chevron">{winner.candidate.actionId}</Badge>
        </>
      ) : (
        <Badge emphasis="low" endCap="chevron">{`${record.ranked.length} ranked, none fired`}</Badge>
      )}
      {record.outcome === 'handled'
        ? <Badge grade="success">{record.predicted ? 'would handle' : 'handled'}</Badge>
        : <Badge grade="danger">unhandled</Badge>}
    </Powerline>
  );
}

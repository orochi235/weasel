/** One node as `get-node` describes it, re-read whenever the scene changes. */
import type { ReactElement } from 'react';
import { Button } from '@weasel-js/ui/components/Button';
import { Code } from '@weasel-js/ui/components/Code';
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
import type { DevtoolsClient } from '../client';
import { useRootQuery } from '../hooks';
import { ValueView } from './ValueView';
import s from './SceneView.module.css';

export interface NodeDetailProps {
  client: DevtoolsClient;
  rootId: string;
  nodeId: string;
  /** Show another node: the parent, when its id is pressed. */
  onPick(nodeId: string): void;
}

const yesNo = (v: boolean): string => (v ? 'yes' : 'no');

export function NodeDetail({ client, rootId, nodeId, onPick }: NodeDetailProps): ReactElement {
  const node = useRootQuery(client, rootId, ['scene'], () => client.request(rootId, { type: 'get-node', nodeId }));
  if (node.error) return <p className={s.note}>{node.error}</p>;
  const d = node.data;
  if (!d) return <p className={s.note}>Loading…</p>;
  return (
    <div className={s.detail}>
      <div className={s.detailHead}>
        <Code size="sm">{d.id}</Code>
        <Button
          size="sm"
          onClick={() => { client.request(rootId, { type: 'select', ids: [d.id] }).catch(() => {}); }}
        >
          Select on canvas
        </Button>
      </div>
      <DetailList layout="inline">
        <DetailRow label="Kind">{d.kind}</DetailRow>
        <DetailRow label="Layer">{d.layer}</DetailRow>
        <DetailRow label="Parent">
          {d.parent && (
            <Button size="sm" variant="link" onClick={() => onPick(d.parent!)} ariaLabel={`Show parent ${d.parent}`}>
              {d.parent}
            </Button>
          )}
        </DetailRow>
        <DetailRow label="Children">{d.childCount}</DetailRow>
        <DetailRow label="Hidden">{yesNo(d.hidden)}</DetailRow>
        <DetailRow label="Locked">{yesNo(d.locked)}</DetailRow>
        <DetailRow label="Pickable">{yesNo(d.pickable)}</DetailRow>
      </DetailList>
      <h3 className={s.heading}>Pose</h3>
      <ValueView value={d.pose} label="Pose" />
      <h3 className={s.heading}>Data</h3>
      <ValueView value={d.data} label="Data" />
    </div>
  );
}

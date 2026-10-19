/**
 * The Frame tab: what the last paint cost, overall and per render layer. The
 * canvas measures only while its `fps` overlay is on and announces nothing, so
 * this polls, and only while the tab is open and the overlay on.
 */
import { useState, type ReactElement } from 'react';
import type { FrameStats } from '@weasel-js/core';
import type { SerializedValue } from '@weasel-js/core/devtools-protocol';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
import { Switch } from '@weasel-js/ui/components/Switch';
import { usePoll, useRootQuery } from '../hooks';
import type { DevtoolsViewProps } from '../tabs';
import { ValueView } from './ValueView';
import s from './FrameView.module.css';

const POLL_MS = 500;

const isFrameStats = (v: SerializedValue): v is SerializedValue & FrameStats =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && typeof v.paintMs === 'number' && Array.isArray(v.layers);

const ms = (n: number): string => n.toFixed(2).padStart(7, ' ');

type LayerRow = FrameStats['layers'][number];

const COLUMNS: readonly DataGridColumn<LayerRow>[] = [
  { id: 'id', header: 'Layer', sortable: false, render: (r) => r.id },
  { id: 'calls', header: 'Draw calls', sortable: false, className: s.figure, render: (r) => r.drawCalls },
  { id: 'ms', header: 'CPU ms', sortable: false, className: s.figure, render: (r) => ms(r.ms) },
];

export function FrameView({ client, rootId }: DevtoolsViewProps): ReactElement {
  const state = useRootQuery(client, rootId, [], () => client.request(rootId, { type: 'get-state' }));
  const fps = state.data?.overlays.fps === true;
  const [frame, setFrame] = useState<SerializedValue>(null);
  usePoll(() => {
    client.request(rootId, { type: 'get-frame' }).then(setFrame, () => {});
  }, POLL_MS, fps);

  const setFps = (on: boolean): void => {
    client.request(rootId, { type: 'set-overlays', overlays: { fps: on } }).then(state.refresh, state.refresh);
  };

  return (
    <div className={s.frame}>
      <Switch isSelected={fps} onChange={setFps} isDisabled={!state.data}>fps overlay</Switch>
      {!fps ? (
        <p className={s.note}>The canvas measures its paints only while the fps overlay is on.</p>
      ) : isFrameStats(frame) ? (
        <>
          <DetailList layout="inline" values="figures">
            <DetailRow label="CPU ms">{ms(frame.paintMs)}</DetailRow>
            <DetailRow label="Draw calls">{frame.drawCalls}</DetailRow>
          </DetailList>
          <DataGrid className={s.layers} rows={frame.layers.map((l) => ({ ...l }))} columns={COLUMNS} empty="No layers painted." />
        </>
      ) : frame === null ? (
        <p className={s.note}>No paint measured yet.</p>
      ) : (
        <ValueView value={frame} label="Frame" />
      )}
    </div>
  );
}

/**
 * The Frame tab: what the last paint cost, overall and per render layer. The
 * canvas measures only while its `fps` overlay is on and announces nothing, so
 * this polls while the tab is open: the overlay always, the frame while it is on.
 */
import { useState, type ReactElement } from 'react';
import type { FrameStats } from '@weasel-js/core';
import type { SerializedValue } from '../protocol';
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

/** A `get-frame` answer, and the stretch of the fps overlay being on that it was read in. */
interface FrameRead { span: number; value: SerializedValue; error: string | null }

export function FrameView({ client, rootId }: DevtoolsViewProps): ReactElement {
  const state = useRootQuery(client, rootId, [], () => client.request(rootId, { type: 'get-state' }));
  const fps = state.data?.overlays.fps === true;
  // A new span each time the overlay turns on or off, so a frame read before is never shown as the current one.
  const [span, setSpan] = useState({ fps, id: 0 });
  if (span.fps !== fps) setSpan({ fps, id: span.id + 1 });
  const [read, setRead] = useState<FrameRead | null>(null);
  usePoll(state.refresh, POLL_MS, true);
  usePoll(() => {
    const at = span.id;
    client.request(rootId, { type: 'get-frame' }).then(
      (value) => setRead({ span: at, value, error: null }),
      (err: Error) => setRead({ span: at, value: null, error: err.message }),
    );
  }, POLL_MS, fps);
  const current = read?.span === span.id ? read : null;
  const frame = current?.value ?? null;

  const setFps = (on: boolean): void => {
    client.request(rootId, { type: 'set-overlays', overlays: { fps: on } }).then(state.refresh, state.refresh);
  };

  if (state.error) return <p className={s.note}>{state.error}</p>;

  return (
    <div className={s.frame}>
      <Switch isSelected={fps} onChange={setFps} disabled={!state.data}>fps overlay</Switch>
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
      ) : current?.error ? (
        <p className={s.note}>{current.error}</p>
      ) : frame === null ? (
        <p className={s.note}>No paint measured yet.</p>
      ) : (
        <ValueView value={frame} label="Frame" />
      )}
    </div>
  );
}

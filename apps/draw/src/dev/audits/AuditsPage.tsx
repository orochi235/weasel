import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { asNodeId } from '@weasel-js/core';
import { useSelection } from '@weasel-js/editing';
import { ResizeHandle } from '@weasel-js/ui/components/ResizeHandle';
import { DevShell } from '../DevShell';
import { AreaDetail } from './AreaDetail';
import { JobsFeed } from './JobsFeed';
import { LiveRuns } from './LiveRuns';
import { NextUp } from './NextUp';
import { RoundsChart } from './RoundsChart';
import { Stats } from './Stats';
import { Treemap } from './Treemap';
import { nextUpOf, runHolding, statsFor } from './areaData';
import { createAuditScene } from './auditScene';
import { phasesOf } from './phases';
import { useAuditPalette } from './useAuditPalette';
import { useSkulkMap, type UseSkulkMapOptions } from './useSkulkMap';
import type { SkulkMap } from './skulkMap.types';
import palette from './palette.module.css';
import s from './AuditsPage.module.css';

const ASIDE = { min: 240, max: 560, initial: 300 } as const;

function stampOf(map: SkulkMap): string {
  const when = new Date(map.generated).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `main ${map.head} · updated ${when}`;
}

function Chart({ map }: { map: SkulkMap }) {
  const [scene] = useState(createAuditScene);
  const selection = useSelection({ scene, mode: 'single' });
  const [hovered, setHovered] = useState<string | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const { probes, palette: colors } = useAuditPalette();
  const [asideWidth, setAsideWidth] = useState<number>(ASIDE.initial);
  const mainRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    mainRef.current?.style.setProperty('--audit-aside-width', `${asideWidth}px`);
  }, [asideWidth]);

  const picked = selection.current[0] ?? null;
  const shownId = hovered ?? picked;
  const area = map.areas.find((a) => a.id === shownId);
  const stats = useMemo(() => statsFor(map.areas), [map.areas]);
  const next = useMemo(() => nextUpOf(map.areas), [map.areas]);
  const phases = useMemo(() => phasesOf(map.runs), [map.runs]);
  const pick = (id: string) => selection.set([asNodeId(id)]);
  const on = { onPick: pick, onLight: setLit };

  return (
    <>
      {probes}
      <LiveRuns runs={map.runs} now={Date.parse(map.generated)} on={on} />
      <Stats stats={stats} />
      <div ref={mainRef} className={s.main}>
        <Treemap scene={scene} selection={selection} areas={map.areas} palette={colors} phases={phases} onHover={setHovered} lit={lit} />
        <ResizeHandle value={asideWidth} min={ASIDE.min} max={ASIDE.max} invert onInput={setAsideWidth} aria-label="Resize the side panel" />
        <aside className={s.aside} aria-label="Area, queue and rounds">
          <AreaDetail area={area} holder={area && runHolding(map.runs, area.id)} />
          <NextUp areas={next} onPick={pick} onLight={setLit} />
          <RoundsChart rounds={map.rounds} />
        </aside>
      </div>
      <div className={s.jobs}><JobsFeed runs={map.runs} onLight={setLit} /></div>
    </>
  );
}

/** The audit chart: every live skulk run, the partition as a treemap shaded by what audits estimate is left, the
 *  queue, the rounds, and the jobs coming back. Reads `/__skulk/map` from draw's dev server. */
export function AuditsPage({ source }: { source?: UseSkulkMapOptions } = {}) {
  const state = useSkulkMap(source);
  const header = state.status === 'ready' ? <span className={s.stamp}>{stampOf(state.map)}</span> : null;
  return (
    <DevShell title="Audits" header={header}>
      <div className={`${palette.palette} ${s.root}`}>
        {state.status === 'loading' && <p className={s.note}>Reading the audit map…</p>}
        {state.status === 'no-server' && (
          <p className={s.note}>
            This page reads the audit map from WeaselDraw&apos;s dev server, which serves <code>/__skulk/map</code>.
            Start it with <code>emilia up dev:draw</code> and open this page there.
          </p>
        )}
        {state.status === 'failed' && <p className={s.note}>Couldn&apos;t read the audit map: {state.error}</p>}
        {state.status === 'ready' && (
          <>
            {state.error && <p className={s.note}>The last refresh failed ({state.error}); showing the map before it.</p>}
            <Chart map={state.map} />
          </>
        )}
        <p className={s.foot}>
          Each area is a directory of at most 50 source files (<code>docs/audits/partition.json</code>). Two reviewers read it
          blind; the overlap of their lists gives Chapman&apos;s estimate of what it held, and &ldquo;left&rdquo; is that estimate
          less what they found. An area settles after two quiet passes on unchanged files. Data from <code>scripts/skulk/map.mjs</code>.
        </p>
      </div>
    </DevShell>
  );
}

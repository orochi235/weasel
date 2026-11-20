import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { asNodeId } from '@weasel-js/core';
import { useSelection } from '@weasel-js/editing';
import { ResizeHandle } from '@weasel-js/ui/components/ResizeHandle';
import { DevShell } from '../DevShell';
import { AreaDefects } from './AreaDefects';
import { AreaDetail } from './AreaDetail';
import { JobsFeed } from './JobsFeed';
import { LiveRuns } from './LiveRuns';
import { NextUp } from './NextUp';
import { RoundsChart } from './RoundsChart';
import { Stats } from './Stats';
import { Treemap } from './Treemap';
import { nextUpOf, runHolding, statsFor } from './areaData';
import { createAuditScene } from './auditScene';
import { phasesOf, withLivePasses } from './phases';
import { useAuditPalette } from './useAuditPalette';
import { useSkulkMap, type UseSkulkMapOptions } from './useSkulkMap';
import { readSize, useViewerPref } from './viewerPref';
import type { SkulkMap } from './skulkMap.types';
import palette from './palette.module.css';
import s from './AuditsPage.module.css';

const ASIDE = { key: 'aside', min: 240, max: 560, initial: 300 } as const;
const TOP = { key: 'top', min: 80, max: 900, initial: 260 } as const;
const JOBS = { key: 'jobs', min: 80, max: 900, initial: 220 } as const;

/** A pane's size the viewer dragged it to, kept between visits. */
const usePaneSize = ({ key, initial }: { key: string; initial: number }) => useViewerPref(key, initial, readSize);

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
  const [asideWidth, setAsideWidth, keepAside] = usePaneSize(ASIDE);
  const [topHeight, setTopHeight, keepTop] = usePaneSize(TOP);
  const [jobsHeight, setJobsHeight, keepJobs] = usePaneSize(JOBS);
  const mainRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    mainRef.current?.style.setProperty('--audit-aside-width', `${asideWidth}px`);
  }, [asideWidth]);
  // The two heights are read by the page's root, which holds every pane.
  useLayoutEffect(() => {
    const root = mainRef.current?.parentElement;
    root?.style.setProperty('--audit-top-height', `${topHeight}px`);
    root?.style.setProperty('--audit-jobs-height', `${jobsHeight}px`);
  }, [topHeight, jobsHeight]);

  const picked = selection.current[0] ?? null;
  const shownId = hovered ?? picked;
  const areas = useMemo(() => withLivePasses(map.areas, map.runs), [map.areas, map.runs]);
  const area = areas.find((a) => a.id === shownId);
  const stats = useMemo(() => statsFor(areas), [areas]);
  const next = useMemo(() => nextUpOf(areas), [areas]);
  const phases = useMemo(() => phasesOf(map.runs), [map.runs]);
  const pick = (id: string) => selection.set([asNodeId(id)]);
  const on = { onPick: pick, onLight: setLit };

  return (
    <>
      {probes}
      <div className={s.top}><LiveRuns runs={map.runs} now={Date.parse(map.generated)} on={on} /></div>
      <ResizeHandle
        className={s.seam} orientation="horizontal" value={topHeight} min={TOP.min} max={TOP.max}
        onInput={setTopHeight} onChange={keepTop} aria-label="Resize the runs strip"
      />
      <Stats stats={stats} />
      <div ref={mainRef} className={s.main}>
        <Treemap scene={scene} selection={selection} areas={areas} palette={colors} phases={phases} onHover={setHovered} lit={lit} />
        <ResizeHandle value={asideWidth} min={ASIDE.min} max={ASIDE.max} invert onInput={setAsideWidth} onChange={keepAside} aria-label="Resize the side panel" />
        <aside className={s.aside} aria-label="Area, queue and rounds">
          <AreaDetail area={area} holder={area && runHolding(map.runs, area.id)} />
          {picked && <AreaDefects id={picked} version={map.generated} />}
          <NextUp areas={next} onPick={pick} onLight={setLit} />
          <RoundsChart rounds={map.rounds} />
        </aside>
      </div>
      <ResizeHandle
        className={s.seam} orientation="horizontal" invert value={jobsHeight} min={JOBS.min} max={JOBS.max}
        onInput={setJobsHeight} onChange={keepJobs} aria-label="Resize the jobs feed"
      />
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

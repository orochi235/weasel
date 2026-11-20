import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SceneCanvas, asNodeId, registerCanvasFont, type SelectionApi } from '@weasel-js/core';
import { useAnimator } from '@weasel-js/animator/react';
import { usePrefersReducedMotion, watchResize } from '@weasel-js/react';
import * as presets from '@weasel-js/editing/presets';
import { auditNodeSpecs, breathe, syncAuditScene, type AuditPalette, type AuditScene } from './auditScene';
import { layoutMap } from './mapLayout';
import { heatScaleOf } from './areaData';
import { HeatLegend } from './HeatLegend';
import { OFF_PIPELINE, PHASE_LABEL, SWEEP, phaseClass, type AuditPhase } from './phases';
import { Slider } from '@weasel-js/ui/components/Slider';
import { useViewerPref } from './viewerPref';
import type { AuditArea } from './skulkMap.types';
import s from './Treemap.module.css';

const FEATURES = [presets.pick];
const SELECTION_OPTIONS = { mode: 'single' } as const;

export interface TreemapProps {
  readonly scene: AuditScene;
  readonly selection: SelectionApi;
  readonly areas: readonly AuditArea[];
  readonly palette: AuditPalette;
  /** Each area a live run holds, and its phase. */
  readonly phases: ReadonlyMap<string, AuditPhase>;
  readonly onHover: (id: string | null) => void;
  /** The area to glow: one something else on the page names and is hovered. */
  readonly lit?: string | null;
  /** How many areas a round takes, whose halves the queue numbers are counted in. */
  readonly areasPerRound?: number;
}

/** Every audit area as a cell of a treemap drawn on the scene graph: hover and click pick through the canvas's
 *  own hit testing and selection. */
/** The most the map numbers: eight rounds of the queue, in half rounds. */
const MAX_HALVES = 16;
const HALF_STOPS = Array.from({ length: MAX_HALVES + 1 }, (_, i) => i);
const readHalves = (v: string): number | undefined => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= MAX_HALVES ? n : undefined;
};

export function Treemap({ scene, selection, areas, palette, phases, onHover, lit = null, areasPerRound = 16 }: TreemapProps) {
  // How many half-rounds of the queue's head to number on the map, each in its area's corner.
  const [halves, setHalves, keepHalves] = useViewerPref('upcomingHalves', 6, readHalves);
  const places = halves * (areasPerRound / 2);
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setSize((was) => {
      const width = Math.floor(host.clientWidth), height = Math.floor(host.clientHeight);
      return was.width === width && was.height === height ? was : { width, height };
    });
    measure();
    return watchResize(host, measure);
  }, []);

  const heat = useMemo(() => heatScaleOf(areas), [areas]);
  const layout = useMemo(() => layoutMap(areas, size.width, size.height), [areas, size]);
  useLayoutEffect(() => {
    syncAuditScene(scene, auditNodeSpecs(areas, layout, palette, phases, lit, places));
  }, [scene, areas, layout, palette, phases, lit, places]);

  // The map's text is set in the theme's faces, which the canvas draws from the document's fonts once each loads.
  useEffect(() => {
    const families = [palette.font.ui, palette.font.numeric];
    const releases = families.map((family) => registerCanvasFont(family));
    for (const family of families) void document.fonts?.load(`10px "${family}"`, '0123456789 abc').catch(() => {});
    return () => releases.forEach((release) => release());
  }, [palette.font.ui, palette.font.numeric]);

  const liveIds = useMemo(() => areas.filter((a) => a.status === 'tonight').map((a) => asNodeId(a.id)), [areas]);
  const animator = useAnimator();
  const still = usePrefersReducedMotion();
  useEffect(() => {
    if (still || liveIds.length === 0) return;
    const pulse = animator.tweenLoop({
      from: 1, to: 0.35, ms: 1100, direction: 'alternate', easing: 'easeInOutCubic',
      onTick: (v: number) => breathe(scene, liveIds, v),
    });
    return () => {
      pulse.cancel();
      breathe(scene, liveIds, 1);
    };
  }, [animator, still, scene, liveIds]);

  return (
    <div className={s.chart}>
      <div ref={hostRef} className={s.host} role="img" aria-label="Treemap of every audit area, sized by source files">
        <SceneCanvas
          className={s.canvas}
          scene={scene}
          features={FEATURES}
          selection={selection}
          selectionOptions={SELECTION_OPTIONS}
          backgroundFill={{ color: palette.panel }}
          animator={animator}
          onHover={onHover}
        />
      </div>
      <div className={s.legend}>
        <span><i className={`${s.key} ${s.uncharted}`} />never audited</span>
        <span>
          audited, estimated defects left after the last pass:
          <HeatLegend heat={heat} />
        </span>
        <span><i className={`${s.key} ${s.settled}`} />settled</span>
        <span className={s.phases}>
          in a live run:
          <span className={s.phaseRamp}>
            <i className={s.phaseBar} />
            <span className={s.phaseNames}>{SWEEP.map((p) => <span key={p}>{PHASE_LABEL[p]}</span>)}</span>
          </span>
          {OFF_PIPELINE.map((p) => <span key={p} className={phaseClass(p)}><i className={`${s.key} ${s.live}`} />{PHASE_LABEL[p]}</span>)}
        </span>
        <span>· a dot per pass</span>
        <span className={s.upcoming}>
          numbered upcoming:
          <Slider
            className={s.upcomingSlider} aria-label="Upcoming areas to number on the map, in half rounds"
            min={0} max={MAX_HALVES} step={1} stops={HALF_STOPS} showStops snap="strict" thumbShape="dot"
            trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)"
            thumbs={[{ value: halves, valueText: `${places} areas, ${halves / 2} rounds` }]}
            onInput={([t]) => setHalves(t!.value)} onChange={([t]) => keepHalves(t!.value)}
            readoutPlacement="none"
          />
          <span className={s.upcomingCount}>{places}</span>
        </span>
      </div>
    </div>
  );
}

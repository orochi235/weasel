import { clamp, runStationAt, type TrackRun } from '@weasel-js/geom';
import type { ReactElement, Ref } from 'react';
import { bendAt, runStretchD } from '../Along/runBend';
import type { RunSlotHost } from '../Along/runSlots';
import s from './Tabs.module.css';

/** Props for {@link TabRule}. */
export interface TabRuleProps {
  run: TrackRun;
  host: RunSlotHost;
  /** The lit tab's key, or null. */
  selected: string | null;
  /** Px along the run where a dragged tab would land, or null. */
  drop?: number | null;
  ref?: Ref<SVGSVGElement>;
}

/** Which way a run's tabs stand off their rule: toward their up on a run bending that way, else away from it. */
export function ruleSide(run: TrackRun): 1 | -1 {
  return bendAt(run, 0.5) === 1 ? 1 : -1;
}

/**
 * The rule a run of tabs stands on, drawn along the run on the inside of its bend, half the tabs' thickness off it:
 * the line a straight tab list draws as its bottom border. The lit tab's marker lies on it across that tab's stretch,
 * and a drop mark stands across the row where a dragged tab would land.
 */
export function TabRule({ run, host, selected, drop = null, ref }: TabRuleProps): ReactElement {
  const side = ruleSide(run);
  const half = host.thickness / 2;
  const place = selected === null ? undefined : host.placeOf(selected);
  let marker: string | null = null;
  if (place !== undefined && place.clipped !== 'past') {
    const center = place.at * run.length;
    const reach = host.lengthOf(selected!) / 2;
    const from = clamp(center - reach, 0, run.length);
    const to = clamp(center + reach, 0, run.length);
    // Laid half its own width onto the tabs' side, so it covers the rule and reads as part of the lit tab.
    if (to > from) marker = runStretchD(run, from, to, side * (half - 0.5));
  }
  return (
    <svg className={s.rule} aria-hidden="true" ref={ref}>
      <path className={s.ruleLine} data-tab-rule="" d={runStretchD(run, 0, run.length, side * half)} />
      {marker !== null && <path className={s.ruleMarker} data-tab-marker="" d={marker} />}
      {drop !== null && <path className={s.ruleDrop} data-tab-drop="" d={dropD(run, drop, half)} />}
    </svg>
  );
}

/** A mark standing across the row at `at` px along `run`, as thick as the row. */
function dropD(run: TrackRun, at: number, half: number): string {
  const d = clamp(at, 0, run.length);
  const a = runStationAt(run, d, -half).point;
  const b = runStationAt(run, d, half).point;
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

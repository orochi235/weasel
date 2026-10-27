import { useContext, useRef, type ReactElement } from 'react';
import { TabList as RACTabList, TabListStateContext, type TabListProps as RACTabListProps } from 'react-aria-components';
import type { RunAlign, TrackShape } from '@weasel-js/geom';
import { useReadingRun } from '../Along/useReadingRun';
import { AlongContext } from '../Along/alongContext';
import { useRunGap } from '../Along/useItemLengths';
import { RunBand, RunEnds } from '../Along/useRunRow';
import { RUN_HOST, useRunSlotHost, type RunSlots } from '../Along/runSlots';
import type { TabListProps } from './Tabs';
import { TabRule } from './TabRule';
import s from './Tabs.module.css';

/** Props for {@link TabListAlong}: a tab list's, with the shape it lies along settled and the channel its tabs read. */
export type TabListAlongProps = TabListProps<object> & { shape: TrackShape; align: RunAlign; slots: RunSlots };

/**
 * A tab list whose tabs lie along a curved track shape in reading order, on a rule drawn along the inside of the
 * bend. A row too long for the run scrolls along it, as a curved bar's does.
 */
export function TabListAlong({ className, shape, align, slots, ...rest }: TabListAlongProps): ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const run = useReadingRun(root, shape);
  const gap = useRunGap(root);
  const host = useRunSlotHost({ slots, root, run, gap, align });
  const state = useContext(TabListStateContext);
  const selected = state?.selectedKey == null ? null : String(state.selectedKey);
  return (
    <div ref={root} {...{ [RUN_HOST]: '' }} {...host.rootProps} className={s.along} data-shape={shape.kind}>
      <RunBand row={host} shape={shape} />
      <TabRule run={run} host={host} selected={selected} />
      <AlongContext.Provider value={null}>
        <RACTabList {...(rest as RACTabListProps<object>)} className={[s.list, s.joined, className].filter(Boolean).join(' ')} />
      </AlongContext.Provider>
      <RunEnds row={host} run={run} />
    </div>
  );
}

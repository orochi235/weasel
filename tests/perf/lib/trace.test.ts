import { describe, expect, it } from 'vitest';
import { asyncSpans, cpu, markWindow, parseTrace, threadCensus, type TraceEvent } from './trace.ts';

const meta = (pid: number, tid: number, kind: 'thread_name' | 'process_name', name: string): TraceEvent =>
  ({ ph: 'M', name: kind, pid, tid, ts: 0, args: { name } });
const x = (pid: number, tid: number, ts: number, dur: number, tdur?: number, name = 'Task'): TraceEvent =>
  ({ ph: 'X', name, pid, tid, ts, dur, ...(tdur === undefined ? {} : { tdur }) });

const trace = (events: TraceEvent[]) => parseTrace(JSON.stringify({ traceEvents: events }));

describe('threadCensus', () => {
  it('counts threads no fixed list names, in every process, a pool summed by name', () => {
    const t = trace([
      meta(1, 0, 'process_name', 'Renderer'),
      meta(2, 0, 'process_name', 'GPU Process'),
      meta(1, 10, 'thread_name', 'CrRendererMain'),
      meta(1, 11, 'thread_name', 'ThreadPoolForegroundWorker'),
      meta(1, 12, 'thread_name', 'ThreadPoolForegroundWorker'),
      meta(2, 20, 'thread_name', 'CrGpuMain'),
      x(1, 10, 100, 50),
      x(1, 11, 100, 30),
      x(1, 12, 200, 40),
      x(2, 20, 100, 10),
    ]);
    expect(threadCensus(t, 0, 1000).map((r) => [r.process, r.thread, r.count, r.busyUs])).toEqual([
      ['Renderer', 'ThreadPoolForegroundWorker', 2, 70],
      ['Renderer', 'CrRendererMain', 1, 50],
      ['GPU Process', 'CrGpuMain', 1, 10],
    ]);
  });

  it('folds a numbered pool thread into one row', () => {
    const t = trace([
      meta(1, 0, 'process_name', 'Renderer'),
      meta(1, 11, 'thread_name', 'CompositorTileWorker1'),
      meta(1, 12, 'thread_name', 'CompositorTileWorker2'),
      x(1, 11, 0, 5),
      x(1, 12, 0, 5),
    ]);
    expect(threadCensus(t, 0, 100).map((r) => [r.thread, r.count, r.busyUs])).toEqual([['CompositorTileWorker', 2, 10]]);
  });
});

describe('cpu', () => {
  it('sums thread time of the outermost events, so a blocked wait is not counted', () => {
    // A 100 us task that was on a CPU for 20 of them, holding a child.
    const events = [x(1, 1, 0, 100, 20), x(1, 1, 10, 50, 15), x(1, 1, 200, 10, 10)];
    expect(cpu(events, 0, 1000)).toBe(30);
  });

  it('is null where no event carries thread time', () => {
    expect(cpu([x(1, 1, 0, 100)], 0, 1000)).toBeNull();
  });
});

describe('asyncSpans', () => {
  it('pairs begin and end by name and id, keeping spans that end in the window', () => {
    const t = trace([
      { ph: 'b', name: 'Stage', cat: 'cc', pid: 1, tid: 1, ts: 0, id: '0x1' },
      { ph: 'b', name: 'Stage', cat: 'cc', pid: 1, tid: 1, ts: 10, id: '0x2' },
      { ph: 'e', name: 'Stage', cat: 'cc', pid: 1, tid: 1, ts: 40, id: '0x1' },
      { ph: 'e', name: 'Stage', cat: 'cc', pid: 1, tid: 1, ts: 2000, id: '0x2' },
    ]);
    expect(asyncSpans(t, 0, 1000).get('Stage')).toEqual({ count: 1, us: 40 });
  });
});

describe('markWindow', () => {
  it('reads the two marks and the process that made them', () => {
    const t = trace([
      { ph: 'R', name: 'a-start', pid: 7, tid: 1, ts: 5 },
      { ph: 'R', name: 'a-end', pid: 7, tid: 1, ts: 9 },
    ]);
    expect(markWindow(t, 'a-start', 'a-end')).toEqual({ t0: 5, t1: 9, pid: 7 });
  });
});

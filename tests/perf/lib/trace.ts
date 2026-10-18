/**
 * Reading a Chromium trace: which thread was busy, and on what, between two
 * `performance.mark`s the page made.
 */

export interface TraceEvent {
  ph: string; name: string; cat?: string; pid: number; tid: number;
  ts: number; dur?: number;
  /** Thread time: what the thread spent on a CPU inside the event. */
  tdur?: number;
  id?: string; id2?: { local?: string; global?: string };
  args?: Record<string, unknown>;
}

export interface Trace {
  events: TraceEvent[];
  /** By `pid:tid`. */
  threadName: Map<string, string>;
  processName: Map<number, string>;
  /** Complete events by `pid:tid`. */
  byThread: Map<string, TraceEvent[]>;
}

export function parseTrace(buf: Buffer | string): Trace {
  const parsed = JSON.parse(typeof buf === 'string' ? buf : buf.toString('utf8')) as
    { traceEvents?: TraceEvent[] } | TraceEvent[];
  const events = Array.isArray(parsed) ? parsed : (parsed.traceEvents ?? []);
  const threadName = new Map<string, string>();
  const processName = new Map<number, string>();
  const byThread = new Map<string, TraceEvent[]>();
  for (const e of events) {
    if (e.ph === 'M') {
      const name = String((e.args as { name?: string } | undefined)?.name ?? '');
      if (e.name === 'thread_name') threadName.set(`${e.pid}:${e.tid}`, name);
      if (e.name === 'process_name') processName.set(e.pid, name);
    } else if (e.ph === 'X' && e.dur !== undefined) {
      const k = `${e.pid}:${e.tid}`;
      let list = byThread.get(k);
      if (!list) { list = []; byThread.set(k, list); }
      list.push(e);
    }
  }
  return { events, threadName, processName, byThread };
}

/** The first event named `start` and the first named `end`. */
export function markWindow(trace: Trace, start: string, end: string): { t0: number; t1: number; pid: number } {
  const a = trace.events.find((e) => e.name === start);
  const b = trace.events.find((e) => e.name === end);
  if (!a || !b) throw new Error(`trace holds no ${start} / ${end} marks`);
  return { t0: a.ts, t1: b.ts, pid: a.pid };
}

/** Busy time of a thread in [t0, t1]: the union of its complete events, so
 *  nesting is not counted twice. Wall time, so a thread blocked inside an
 *  event counts as busy. */
export function busy(events: TraceEvent[], t0: number, t1: number): number {
  const spans = events
    .map((e) => [Math.max(e.ts, t0), Math.min(e.ts + (e.dur ?? 0), t1)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let sum = 0;
  let curA = -1;
  let curB = -1;
  for (const [a, b] of spans) {
    if (a > curB) {
      if (curB > curA) sum += curB - curA;
      curA = a; curB = b;
    } else if (b > curB) curB = b;
  }
  if (curB > curA) sum += curB - curA;
  return sum;
}

export interface SelfTime { dur: number; tdur: number; count: number }

/** Self time by event name on one thread, for events wholly inside the
 *  window, wall (`dur`) and thread CPU (`tdur`). An event's self time is its
 *  duration less its direct children's. Adds into `into` when given. */
export function selfTimeStats(
  events: TraceEvent[], t0: number, t1: number, into = new Map<string, SelfTime>(),
): Map<string, SelfTime> {
  const inside = events
    .filter((e) => e.ts >= t0 && e.ts + (e.dur ?? 0) <= t1)
    .sort((a, b) => a.ts - b.ts || (b.dur ?? 0) - (a.dur ?? 0));
  const stack: Array<{ e: TraceEvent; end: number; child: number; childT: number }> = [];
  const close = (f: { e: TraceEvent; child: number; childT: number }) => {
    const s = into.get(f.e.name) ?? { dur: 0, tdur: 0, count: 0 };
    s.dur += Math.max(0, (f.e.dur ?? 0) - f.child);
    s.tdur += Math.max(0, (f.e.tdur ?? 0) - f.childT);
    s.count += 1;
    into.set(f.e.name, s);
  };
  for (const e of inside) {
    const end = e.ts + (e.dur ?? 0);
    while (stack.length && stack[stack.length - 1].end <= e.ts) close(stack.pop()!);
    if (stack.length) {
      stack[stack.length - 1].child += e.dur ?? 0;
      stack[stack.length - 1].childT += e.tdur ?? 0;
    }
    stack.push({ e, end, child: 0, childT: 0 });
  }
  while (stack.length) close(stack.pop()!);
  return into;
}

/** `selfTimeStats`' wall self time alone. */
export function selfTimes(events: TraceEvent[], t0: number, t1: number): Map<string, number> {
  return new Map([...selfTimeStats(events, t0, t1)].map(([name, s]) => [name, s.dur]));
}

/** CPU time of a thread in [t0, t1], from the outermost events wholly inside
 *  it: what `busy` counts less the time the thread was blocked. Events carry
 *  `tdur` only on some platforms; null when none here does. */
export function cpu(events: TraceEvent[], t0: number, t1: number): number | null {
  const inside = events
    .filter((e) => e.ts >= t0 && e.ts + (e.dur ?? 0) <= t1)
    .sort((a, b) => a.ts - b.ts || (b.dur ?? 0) - (a.dur ?? 0));
  let sum = 0;
  let seen = false;
  let end = -Infinity;
  for (const e of inside) {
    if (e.ts < end) continue;
    end = e.ts + (e.dur ?? 0);
    if (e.tdur !== undefined) { sum += e.tdur; seen = true; }
  }
  return seen ? sum : null;
}

export interface ThreadBusy {
  process: string;
  thread: string;
  /** Threads that share the name, summed. */
  count: number;
  busyUs: number;
  cpuUs: number | null;
}

/**
 * Every thread with events in [t0, t1], in every process, threads of one name
 * in one process summed: a pool's workers come and go by tid.
 */
export function threadCensus(trace: Trace, t0: number, t1: number): ThreadBusy[] {
  const out = new Map<string, ThreadBusy>();
  for (const [k, list] of trace.byThread) {
    const pid = Number(k.split(':')[0]);
    const b = busy(list, t0, t1);
    if (b <= 0) continue;
    const process = trace.processName.get(pid) ?? String(pid);
    const thread = (trace.threadName.get(k) ?? k).replace(/\d+$/, '');
    const key = `${process}\0${thread}`;
    const c = cpu(list, t0, t1);
    const row = out.get(key) ?? { process, thread, count: 0, busyUs: 0, cpuUs: null };
    row.count += 1;
    row.busyUs += b;
    if (c !== null) row.cpuUs = (row.cpuUs ?? 0) + c;
    out.set(key, row);
  }
  return [...out.values()].sort((a, b) => b.busyUs - a.busyUs);
}

/**
 * Async spans (`b`/`e` pairs) that end inside [t0, t1], by name: how many
 * and their summed wall time. A frame pipeline overlaps itself, so a sum can
 * exceed the window.
 */
export function asyncSpans(trace: Trace, t0: number, t1: number): Map<string, { count: number; us: number }> {
  const open = new Map<string, number>();
  const out = new Map<string, { count: number; us: number }>();
  const idOf = (e: TraceEvent) => e.id ?? e.id2?.local ?? e.id2?.global ?? '';
  const sorted = trace.events.filter((e) => e.ph === 'b' || e.ph === 'e').sort((a, b) => a.ts - b.ts);
  for (const e of sorted) {
    const key = `${e.pid}\0${e.cat ?? ''}\0${e.name}\0${idOf(e)}`;
    if (e.ph === 'b') { open.set(key, e.ts); continue; }
    const start = open.get(key);
    if (start === undefined) continue;
    open.delete(key);
    if (e.ts < t0 || e.ts > t1) continue;
    const row = out.get(e.name) ?? { count: 0, us: 0 };
    row.count += 1;
    row.us += e.ts - start;
    out.set(e.name, row);
  }
  return out;
}

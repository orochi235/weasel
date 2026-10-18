/** Reading a Chromium trace from `browser.stopTracing()`. */

export interface TraceEvent {
  ph: string; name: string; pid: number; tid: number; ts: number; dur?: number;
  /** Thread CPU time, us, where the event recorded it. */
  tdur?: number;
  args?: Record<string, unknown>;
}

export function parseTrace(buf: Buffer): TraceEvent[] {
  const parsed = JSON.parse(buf.toString('utf8')) as { traceEvents?: TraceEvent[] } | TraceEvent[];
  return Array.isArray(parsed) ? parsed : (parsed.traceEvents ?? []);
}

/** `pid:tid` → thread name and pid → process name, from the metadata events. */
export function threadNames(events: TraceEvent[]): { thread: Map<string, string>; process: Map<number, string> } {
  const thread = new Map<string, string>();
  const process = new Map<number, string>();
  for (const e of events) {
    if (e.ph !== 'M') continue;
    const n = String((e.args as { name?: string } | undefined)?.name ?? '');
    if (e.name === 'thread_name') thread.set(`${e.pid}:${e.tid}`, n);
    if (e.name === 'process_name') process.set(e.pid, n);
  }
  return { thread, process };
}

/** Wall time inside [t0, t1] covered by at least one of `events`, us. */
export function busy(events: TraceEvent[], t0: number, t1: number): number {
  const spans = events
    .map((e) => [Math.max(e.ts, t0), Math.min(e.ts + (e.dur ?? 0), t1)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let sum = 0; let a0 = -1; let b0 = -1;
  for (const [a, b] of spans) {
    if (a > b0) { if (b0 > a0) sum += b0 - a0; a0 = a; b0 = b; } else if (b > b0) b0 = b;
  }
  if (b0 > a0) sum += b0 - a0;
  return sum;
}

export interface SelfTime { dur: number; tdur: number; count: number }

/** Each event name's self time — its duration less its children's — over the
 *  events of one thread lying wholly inside [t0, t1], wall and thread CPU, us. */
export function selfTimes(events: TraceEvent[], t0: number, t1: number, into = new Map<string, SelfTime>()): Map<string, SelfTime> {
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

/** Complete events grouped by `pid:tid`. */
export function byThread(events: TraceEvent[]): Map<string, TraceEvent[]> {
  const out = new Map<string, TraceEvent[]>();
  for (const e of events) {
    if (e.ph !== 'X' || e.dur === undefined) continue;
    const k = `${e.pid}:${e.tid}`;
    (out.get(k) ?? out.set(k, []).get(k)!).push(e);
  }
  return out;
}

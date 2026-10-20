import type { EffectPipeline, EffectRun } from '../types';
import { createPass, type EffectPass, type RunPipelineOptions } from './pass';
import { runPipeline } from './runPipeline';

/** What `createEffectRunner` is made with. */
export interface EffectRunnerOptions extends Omit<RunPipelineOptions, 'time' | 'signal'> {
  pipeline: EffectPipeline;
}

/** What a runner shows now. A new object whenever any of it changes. */
export interface EffectRunnerState {
  /** The run to draw: the last whole run, or the step run so far. */
  run: EffectRun | undefined;
  playing: boolean;
  /** Seconds of play time. */
  time: number;
}

/** Runs one pipeline over and over: whole, a stage at a time, or every frame
 *  while playing. It owns the values its runs make and the previews in them. */
export interface EffectRunner {
  readonly state: EffectRunnerState;
  /** One whole run at the current play time. */
  run(): Promise<void>;
  /** Evaluates the next stage the run reaches and makes it the run's `at`;
   *  after the last stage, starts over. */
  step(): Promise<void>;
  play(): void;
  pause(): void;
  /** Pauses, drops the run, and sets the clock back to zero. */
  reset(): void;
  /** Moves the play clock on by `seconds` while playing, and starts a run
   *  unless one is still going. A frame source calls it once a frame. */
  advance(seconds: number): void;
  /** The next run, step, or played frame follows `pipeline`. A step run under
   *  way starts over. */
  setPipeline(pipeline: EffectPipeline): void;
  setSources(sources: Readonly<Record<string, unknown>>): void;
  setOptions(opts: Partial<Omit<EffectRunnerOptions, 'pipeline' | 'sources'>>): void;
  /** Says `run` is on screen: every preview of an older run that `run` does
   *  not show is closed. */
  drawn(run: EffectRun | undefined): void;
  subscribe(listener: () => void): () => void;
  /** Resets and closes every preview it still holds. The runner stays usable. */
  dispose(): void;
}

/** A runner over `opts.pipeline`, with nothing run yet. */
export function createEffectRunner(opts: EffectRunnerOptions): EffectRunner {
  let { pipeline, ...options } = opts;
  let state: EffectRunnerState = { run: undefined, playing: false, time: 0 };
  let stepping: EffectPass | null = null;
  let controller = new AbortController();
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;
  // Runs published and not yet known to be off screen, oldest first.
  let published: EffectRun[] = [];
  const listeners = new Set<() => void>();

  const set = (next: Partial<EffectRunnerState>) => {
    state = { ...state, ...next };
    for (const l of [...listeners]) l();
  };
  const publish = (run: EffectRun) => {
    published.push(run);
    set({ run });
  };
  const passOptions = (time: number): RunPipelineOptions => ({ ...options, time, signal: controller.signal });
  const dropStepping = () => {
    stepping?.dispose();
    stepping = null;
  };
  const enqueue = (task: (signal: AbortSignal) => Promise<void>): Promise<void> => {
    const signal = controller.signal;
    pending++;
    const done = tail.then(() => (signal.aborted ? undefined : task(signal))).catch((err: unknown) => {
      if (!signal.aborted) throw err;
    }).finally(() => { pending--; });
    tail = done.catch(() => {});
    return done;
  };
  // Takes the clock as it reads when asked, not when the run before it lets it start.
  const wholeRun = (time: number) => async (signal: AbortSignal) => {
    dropStepping();
    const run = await runPipeline(pipeline, passOptions(time));
    if (signal.aborted) close(previewsOf(run));
    else publish(run);
  };

  const stepOnce = (time: number) => async () => {
    let pass = stepping ??= createPass(pipeline, passOptions(time));
    let at = await pass.step();
    if (at === undefined) {
      dropStepping();
      pass = stepping = createPass(pipeline, passOptions(time));
      at = await pass.step();
    }
    publish(at === undefined ? pass.run : { ...pass.run, at });
  };

  return {
    get state() { return state; },
    run: () => enqueue(wholeRun(state.time)),
    step() {
      return enqueue(stepOnce(state.time));
    },
    play: () => { if (!state.playing) set({ playing: true }); },
    pause: () => { if (state.playing) set({ playing: false }); },
    reset() {
      controller.abort();
      controller = new AbortController();
      dropStepping();
      set({ run: undefined, playing: false, time: 0 });
    },
    advance(seconds) {
      if (!state.playing) return;
      state = { ...state, time: state.time + seconds };
      if (pending === 0) void enqueue(wholeRun(state.time));
    },
    setPipeline(next) {
      if (next === pipeline) return;
      pipeline = next;
      dropStepping();
    },
    setSources(sources) {
      if (sources === options.sources) return;
      options = { ...options, sources };
      dropStepping();
    },
    setOptions(next) {
      options = { ...options, ...next };
    },
    drawn(run) {
      const at = run === undefined ? published.length : published.indexOf(run);
      if (at <= 0) return;
      const keep = new Set(run === undefined ? [] : previewsOf(run));
      close(published.slice(0, at).flatMap(previewsOf).filter((b) => !keep.has(b)));
      published = published.slice(at);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() {
      this.reset();
      close(published.flatMap(previewsOf));
      published = [];
    },
  };
}

function previewsOf(run: EffectRun): ImageBitmap[] {
  return Object.values(run.stages).flatMap((s) => Object.values(s.previews ?? {}));
}

function close(bitmaps: readonly ImageBitmap[]): void {
  for (const b of new Set(bitmaps)) b.close();
}

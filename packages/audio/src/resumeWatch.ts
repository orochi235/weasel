/** Keeps a context resumable: gesture listeners while it is not running, and
 *  the time it last resumed, which is where a suspension's backlog ends. */
export interface ResumeWatch {
  /** Engine time before which a queued entry is stale — set on resume, so a
   *  suspension does not end in one pass that fires its whole backlog. */
  staleFloor(): number;
  dispose(): void;
}

export function createResumeWatch(
  ctx: BaseAudioContext,
  hooks: {
    /** Engine time in ms. */
    now(): number;
    unlock(): Promise<void>;
    /** The context stopped running. */
    onSuspend(): void;
  },
): ResumeWatch {
  let disposed = false;
  let suspendedSince = false;
  let staleFloor = -Infinity;

  // Resume on a user gesture, and keep listening until one takes. On touch a
  // tap grants activation at pointerup, touchend and click, not at pointerdown
  // or touchstart, so the first events of a first tap resume nothing.
  const gestures = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
  const onGesture = (): void => { void hooks.unlock().catch(() => undefined); };
  const arm = (): void => {
    if (typeof window === 'undefined') return;
    for (const g of gestures) window.addEventListener(g, onGesture, { passive: true });
  };
  const disarm = (): void => {
    if (typeof window === 'undefined') return;
    for (const g of gestures) window.removeEventListener(g, onGesture);
  };
  if (ctx.state !== 'running') arm();

  // A browser suspends the context when the tab goes away, and the gesture
  // listeners are long removed by then. Without this the engine is
  // permanently silent afterwards, with no diagnostic — the drop warning is a
  // once-per-engine latch.
  const onStateChange = (): void => {
    if (disposed) return;
    if (ctx.state === 'running') {
      disarm();
      if (suspendedSince) staleFloor = hooks.now();
      suspendedSince = false;
      return;
    }
    suspendedSince = true;
    hooks.onSuspend();
    arm();
  };
  ctx.addEventListener('statechange', onStateChange);

  return {
    staleFloor: () => staleFloor,
    dispose() {
      disposed = true;
      disarm();
      ctx.removeEventListener('statechange', onStateChange);
    },
  };
}

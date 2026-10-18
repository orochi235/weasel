import { atAudioTime, type Timers } from './audioTime';
import type { SourceLike, Starter } from './liveVoice';
import type { StreamOptions, VoiceHandle } from './types';

/** How `stream` makes its source, and which voice holds each element. */
export interface StreamStarters {
  /** The element a call names, made from a URL when it is one. */
  element(media: HTMLMediaElement | string, opts: StreamOptions): HTMLMediaElement;
  starter(el: HTMLMediaElement, opts: StreamOptions): Starter;
  /** An element has one playhead: the voice streaming it now, to stop before
   *  another starts. */
  streaming: WeakMap<HTMLMediaElement, VoiceHandle>;
}

/** A media element's playback as a voice source: `stop(when)` pauses once
 *  the audio clock reaches `when`, and the element ending ends the voice. */
function mediaSource(
  ctx: BaseAudioContext, timers: Timers, el: HTMLMediaElement, node: AudioNode, into: AudioNode,
): SourceLike {
  let ended = false;
  let cancelWait: (() => void) | null = null;
  const finish = (): void => {
    if (ended) return;
    ended = true;
    cancelWait?.();
    el.pause();
    el.removeEventListener('ended', finish);
    el.removeEventListener('error', finish);
    // Queued, as a source node's `onended` is: the engine may be inside the
    // teardown that called `stop()`.
    queueMicrotask(() => (shim.onended as (() => void) | null)?.());
  };
  const shim: SourceLike = {
    onended: null,
    stop(when?: number) {
      if (ended) return;
      cancelWait?.();
      cancelWait = when !== undefined && when > ctx.currentTime
        ? atAudioTime(ctx, timers, when, finish)
        : null;
      if (!cancelWait) finish();
    },
    disconnect() {
      try { node.disconnect(into); } catch { /* not wired */ }
    },
  };
  el.addEventListener('ended', finish);
  el.addEventListener('error', finish);
  el.play().catch((err: unknown) => {
    if (ended) return;
    console.warn(`@weasel-js/audio: a stream would not start — ${String(err)}`);
    finish();
  });
  return shim;
}

export function createStreamStarters(ctx: AudioContext, timers: Timers): StreamStarters {
  // An element can be routed into a graph once, ever: the node is kept for the
  // element's lifetime and handed from voice to voice.
  const mediaSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  return {
    element(media, opts) {
      if (typeof media !== 'string') return media;
      const el = new Audio();
      if (opts.crossOrigin !== undefined) el.crossOrigin = opts.crossOrigin;
      el.preload = 'auto';
      el.src = media;
      return el;
    },
    starter(el, opts) {
      return {
        ready: () => true,
        start(voice) {
          let node = mediaSources.get(el);
          if (!node) {
            node = ctx.createMediaElementSource(el);
            mediaSources.set(el, node);
          }
          el.loop = opts.loop ?? false;
          if (opts.offset !== undefined) el.currentTime = opts.offset / 1000;
          voice.retune = () => { el.playbackRate = voice.rate; };
          voice.retune();
          const into = voice.chain!.panner;
          node.connect(into);
          return mediaSource(ctx, timers, el, node, into);
        },
      };
    },
    streaming: new WeakMap(),
  };
}

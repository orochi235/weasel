/**
 * One frame in flight at a time: what the page sends when its host asks for a frame, what it
 * holds back while one is out, and what it does when one lands or is lost.
 */
import type { FrameWriter, FrameMessage } from './frameWriter';
import type { AnimationOp, FrameTime, ToWorker } from './protocol';
import type { Requests } from './requests';

export interface FrameSync {
  /** Send the next frame, at `at`, or mark one owed while one is in flight. */
  sync(write: () => FrameMessage, at: FrameTime): void;
  /** An animator call to send with the next frame. */
  queue(op: AnimationOp): void;
  /** The next frame says the page's frames are back after time nobody saw. */
  resume(): void;
}

export function createFrameSync(hooks: {
  frames: FrameWriter;
  acks: Requests<boolean>;
  post: (msg: ToWorker) => void;
  due: () => void;
  warn: (what: string, detail: unknown) => void;
  stopped: () => boolean;
}): FrameSync {
  const { frames, acks, post, due, warn, stopped } = hooks;
  const ops: AnimationOp[] = [];
  let resumed = false;
  let inFlight = false;
  let owed = false;

  /** The frame landed, or will not be answered: either way the next can go, and a lost one may
   *  not have arrived, so the next carries everything. */
  const landed = (ok: boolean) => {
    inFlight = false;
    if (stopped()) return;
    if (!ok) frames.lost();
    if (owed || !ok) { owed = false; due(); }
  };
  const send = (msg: FrameMessage) => {
    try {
      acks.ask((id) => post({ ...msg, id }), landed);
    } catch (e) {
      // Something in the frame cannot be cloned. Nothing of it arrived, so the next frame
      // carries everything, and the animator calls go with it.
      frames.lost();
      if (msg.animations) ops.unshift(...msg.animations);
      if (msg.resumed) resumed = true;
      warn('a frame could not be sent:', e);
      return;
    }
    inFlight = true;
  };

  return {
    sync(write, at) {
      if (inFlight) { owed = true; return; }
      const msg = write();
      msg.at = at;
      if (resumed) msg.resumed = true;
      resumed = false;
      if (ops.length > 0) msg.animations = ops.splice(0);
      send(msg);
    },
    queue: (op) => { ops.push(op); },
    resume: () => { resumed = true; },
  };
}

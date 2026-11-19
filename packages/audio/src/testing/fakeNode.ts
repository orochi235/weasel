export interface FakeParam {
  value: number;
  /** Every `linearRampToValueAtTime` target, in call order. */
  ramps: { value: number; at: number }[];
  /** Every `setValueAtTime`, in call order. */
  holds: { value: number; at: number }[];
  /** Every `exponentialRampToValueAtTime` target, in call order. */
  expRamps: { value: number; at: number }[];
  /** Every `cancelScheduledValues` time, in call order. */
  cancels: number[];
  /** Every `setTargetAtTime`, in call order. */
  targets: { value: number; at: number; timeConstant: number }[];
  setValueAtTime(value: number, at: number): FakeParam;
  linearRampToValueAtTime(value: number, at: number): FakeParam;
  exponentialRampToValueAtTime(value: number, at: number): FakeParam;
  cancelScheduledValues(at: number): FakeParam;
  setTargetAtTime(value: number, at: number, timeConstant: number): FakeParam;
}

// A ramp does not move `value`: the point of the double is that a test can see
// a target scheduled ahead of the current value rather than written over it.
export const param = (initial: number): FakeParam => {
  const p: FakeParam = {
    value: initial,
    ramps: [],
    holds: [],
    expRamps: [],
    cancels: [],
    targets: [],
    setValueAtTime(value, at) { p.holds.push({ value, at }); p.value = value; return p; },
    linearRampToValueAtTime(value, at) { p.ramps.push({ value, at }); return p; },
    exponentialRampToValueAtTime(value, at) { p.expRamps.push({ value, at }); return p; },
    cancelScheduledValues(at) { p.cancels.push(at); return p; },
    setTargetAtTime(value, at, timeConstant) { p.targets.push({ value, at, timeConstant }); return p; },
  };
  return p;
};

export interface FakeNode {
  kind: string;
  connectedTo: FakeNode[];
  connectedFrom: FakeNode[];
  /** True once `disconnect` has been called on this node in any form. */
  disconnected: boolean;
  connect(target: FakeNode): FakeNode;
  disconnect(target?: FakeNode): void;
}

export function node<E extends Record<string, unknown>>(kind: string, extra?: E): FakeNode & E {
  const n = {
    kind,
    connectedTo: [] as FakeNode[],
    connectedFrom: [] as FakeNode[],
    disconnected: false,
    // A second connection between the same pair is ignored, as the
    // specification ignores it, so one `disconnect(target)` cuts it.
    connect(target: FakeNode) {
      if (n.connectedTo.includes(target)) return target;
      n.connectedTo.push(target);
      target.connectedFrom.push(n);
      return target;
    },
    disconnect(target?: FakeNode) {
      n.disconnected = true;
      if (target && !n.connectedTo.includes(target)) {
        // The bare form is a no-op when there is nothing to cut; the targeted
        // form is not, and a real implementation throws.
        throw new Error('InvalidAccessError: the given node is not connected');
      }
      for (const t of target ? [target] : [...n.connectedTo]) {
        const out = n.connectedTo.indexOf(t);
        if (out >= 0) n.connectedTo.splice(out, 1);
        const back = t.connectedFrom.indexOf(n);
        if (back >= 0) t.connectedFrom.splice(back, 1);
      }
    },
    ...(extra ?? ({} as E)),
  } as FakeNode & E;
  return n;
}

export interface FakeGain extends FakeNode { gain: FakeParam }
export interface FakePanner extends FakeNode { pan: FakeParam }

export interface FakeBiquad extends FakeNode {
  type: string;
  frequency: FakeParam;
  Q: FakeParam;
  gain: FakeParam;
  detune: FakeParam;
}

export interface FakeConvolver extends FakeNode { buffer: unknown; normalize: boolean }

export interface FakeDelay extends FakeNode { delayTime: FakeParam; maxDelayTime: number }

export interface FakeCompressor extends FakeNode {
  threshold: FakeParam;
  knee: FakeParam;
  ratio: FakeParam;
  attack: FakeParam;
  release: FakeParam;
}

import type { Op } from '../../core/ops/types';
import type { ToolCtx } from '../types';

/** Returned from a continuation closure or action handler. */
export type Result<TScratch> =
  | { kind: 'apply';  ops: Op[]; label?: string }
  | { kind: 'begin';  spec: BeginSpec<TScratch> }
  | { kind: 'hold';   scratch: TScratch }
  | { kind: 'commit'; ops: Op[]; label?: string }
  | { kind: 'cancel' }
  | { kind: 'claim' }
  | { kind: 'none' };

/** Spec for `begin()` — opens engaged phase with continuation handlers. */
export interface BeginSpec<TScratch> {
  scratch: TScratch;
  thresholdPx?: number;
  onMove?:    (ctx: ToolCtx<TScratch>) => Result<TScratch>;
  onRelease?: (ctx: ToolCtx<TScratch>) => Result<TScratch>;
  onCancel?:  (ctx: ToolCtx<TScratch>) => void | Result<TScratch>;
}

export function apply<TScratch>(ops: Op[], label?: string): Result<TScratch> {
  return label !== undefined
    ? { kind: 'apply', ops, label }
    : { kind: 'apply', ops };
}

export function begin<TScratch>(spec: BeginSpec<TScratch>): Result<TScratch> {
  return { kind: 'begin', spec };
}

export function hold<TScratch>(scratch: TScratch): Result<TScratch> {
  return { kind: 'hold', scratch };
}

export function commit<TScratch>(ops: Op[], label?: string): Result<TScratch> {
  return label !== undefined
    ? { kind: 'commit', ops, label }
    : { kind: 'commit', ops };
}

export function cancel<TScratch>(): Result<TScratch> {
  return { kind: 'cancel' };
}

export function claim<TScratch>(): Result<TScratch> {
  return { kind: 'claim' };
}

export function none<TScratch>(): Result<TScratch> {
  return { kind: 'none' };
}

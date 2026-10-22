/**
 * Path-effect settings read from action params: each field taken only when it
 * is the right type, so a slider's number or a toggle's boolean passes and a
 * stray value is ignored rather than written into a document.
 */
import type { BendAlongEffect, BlendEffect, PathEffect, RepeatAlongEffect, TextAlongEffect } from '@weasel-js/core';

type Params = Record<string, unknown> | undefined;

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const oneOf = <T extends string>(v: unknown, options: readonly T[]): T | undefined =>
  (typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : undefined);

/** `fields` without the entries left `undefined`. */
function defined<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** The settings of a `kind` effect that `params` names. */
export function effectSettings(kind: PathEffect['kind'], params: Params): Partial<PathEffect> {
  const p = params ?? {};
  switch (kind) {
    case 'blend':
      return defined<Partial<BlendEffect>>({
        steps: num(p.steps) === undefined ? undefined : Math.max(Math.round(num(p.steps)!), 0),
        autoAlign: bool(p.autoAlign),
        startOffset: num(p.startOffset) === undefined ? undefined : Math.round(num(p.startOffset)!),
        reverse: bool(p.reverse),
        rotate: bool(p.rotate),
        spaceBy: oneOf(p.spaceBy, ['count', 'distance'] as const),
        distance: num(p.distance) === undefined ? undefined : Math.max(num(p.distance)!, 0.01),
        orient: bool(p.orient),
      });
    case 'bendAlong':
      return defined<Partial<BendAlongEffect>>({
        fit: oneOf(p.fit, ['stretch', 'natural'] as const),
        baseline: num(p.baseline),
        flip: bool(p.flip),
        tolerance: num(p.tolerance) === undefined ? undefined : Math.max(num(p.tolerance)!, 0.01),
      });
    case 'repeatAlong':
      return defined<Partial<RepeatAlongEffect>>({
        count: num(p.count) === undefined ? undefined : Math.max(Math.round(num(p.count)!), 0),
        spacing: num(p.spacing) === undefined ? undefined : Math.max(num(p.spacing)!, 0),
        align: oneOf(p.align, ['start', 'center', 'end'] as const),
        offset: num(p.offset),
        orient: bool(p.orient),
      });
    case 'textAlong':
      return defined<Partial<TextAlongEffect>>({
        align: oneOf(p.align, ['start', 'center', 'end'] as const),
        start: num(p.start) === undefined ? undefined : Math.min(Math.max(num(p.start)!, 0), 1),
        shift: num(p.shift),
        anchor: oneOf(p.anchor, ['baseline', 'center'] as const),
        overflow: oneOf(p.overflow, ['clip', 'fit'] as const),
        side: oneOf(p.side, ['auto', 'path', 'flipped'] as const),
      });
  }
}

/**
 * `effect` with the settings `params` names laid over it. A blend's
 * `reverse: 'auto'` clears its direction, handing it back to `autoAlign`.
 */
export function withEffectSettings(effect: PathEffect, params: Params): PathEffect {
  const next = { ...effect, ...effectSettings(effect.kind, params) } as PathEffect;
  if (next.kind === 'blend' && params?.reverse === 'auto') delete next.reverse;
  return next;
}

/** What a new effect of `kind` starts from, before its params. */
export const EFFECT_DEFAULTS: { [K in PathEffect['kind']]: Extract<PathEffect, { kind: K }> } = {
  blend: { kind: 'blend', steps: 4 },
  bendAlong: { kind: 'bendAlong' },
  repeatAlong: { kind: 'repeatAlong' },
  textAlong: { kind: 'textAlong', hideSources: true },
};

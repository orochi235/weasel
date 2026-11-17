/**
 * The shape `bindClip` needs of a clip before it reads one: a clip is JSON from a file, so each field it reads is
 * checked first, and one of the wrong type is refused naming where it is.
 */
import { EASINGS } from '@weasel-js/geom';
import type { Clip } from './clip';

type Raw = Record<string, unknown>;

/** How deep timelines may nest in a clip: far past any authored one, and short of the call stack binding it needs. */
const MAX_DEPTH = 1000;

const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

function refuse(where: string, problem: string): never {
  throw new Error(`bindClip: ${where} ${problem}.`);
}

function need(ok: boolean, where: string, problem: string): void {
  if (!ok) refuse(where, problem);
}

const optionalString = (v: unknown, where: string): void => need(v === undefined || typeof v === 'string', where, 'is not a string');

function easing(v: unknown, where: string): void {
  if (v === undefined) return;
  if (typeof v === 'string') return need(Object.hasOwn(EASINGS, v), where, `names no built-in easing: "${v}"`);
  const bezier = isRaw(v) ? v.bezier : undefined;
  need(Array.isArray(bezier) && bezier.length === 4 && bezier.every((n) => typeof n === 'number'), where, 'is neither an easing name nor four bezier points');
}

function sampled(track: Raw, where: string): void {
  optionalString(track.target, `${where}'s target`);
  optionalString(track.interpolate, `${where}'s interpolate`);
  need(track.weight === undefined || typeof track.weight === 'number' || typeof track.weight === 'string', `${where}'s weight`, 'is neither a number nor a name');
  const { axes, keys } = track;
  need(axes === undefined || (Array.isArray(axes) && axes.every((a) => typeof a === 'number' || typeof a === 'string')), `${where}'s axes`, 'is not a list of axes');
  need(Array.isArray(keys), where, 'has no keys list');
  (keys as unknown[]).forEach((key, i) => {
    const at = `${where}'s key ${i}`;
    need(isRaw(key), at, 'is not an object');
    need(typeof (key as Raw).t === 'number', `${at}'s t`, 'is not a number');
    need((key as Raw).value !== undefined, at, 'has no value');
    easing((key as Raw).easing, `${at}'s easing`);
  });
}

function events(track: Raw, where: string): void {
  need(Array.isArray(track.events), where, 'has no events list');
  (track.events as unknown[]).forEach((event, i) => {
    const at = `${where}'s event ${i}`;
    need(isRaw(event), at, 'is not an object');
    need(typeof (event as Raw).t === 'number', `${at}'s t`, 'is not a number');
    need(typeof (event as Raw).name === 'string', `${at}'s name`, 'is not a string');
  });
}

function timeline(v: unknown, where: string, depth: number): void {
  need(depth <= MAX_DEPTH, where, `nests timelines more than ${MAX_DEPTH} deep`);
  need(isRaw(v), where, 'is not an object');
  const { tracks, duration } = v as Raw;
  need(duration === undefined || typeof duration === 'number', `${where}'s duration`, 'is not a number');
  need(Array.isArray(tracks), where, 'has no tracks list');
  (tracks as unknown[]).forEach((track, i) => {
    const at = `${where === 'the clip' ? '' : `${where}'s `}track ${i}`;
    need(isRaw(track), at, 'is not an object');
    const t = track as Raw;
    optionalString(t.label, `${at}'s label`);
    if (t.kind === 'sampled') sampled(t, at);
    else if (t.kind === 'event') events(t, at);
    else if (t.kind === 'timeline') {
      need(typeof t.at === 'number', `${at}'s at`, 'is not a number');
      timeline(t.timeline, `${at}'s timeline`, depth + 1);
    } else refuse(at, 'is not a sampled, event, or timeline track');
  });
}

/** Throws, naming where, on a clip any field of which `bindClip` reads is of the wrong type. */
export function checkClip(clip: unknown): asserts clip is Clip {
  need(isRaw(clip), 'the clip', 'is not an object');
  const { version } = clip as Raw;
  if (version !== 1) throw new Error(`bindClip: this clip is version ${String(version)}, and version 1 is the one understood.`);
  timeline(clip, 'the clip', 0);
}

/**
 * SMIL animation as a clip: each `<animate>`, `<set>` and `<animateTransform>` becomes a sampled
 * track named for what it moves, `<id>.<attribute>` or `<id>.transform.<type>`, with its repeats laid
 * out as keys. What it cannot carry is reported, never dropped silently.
 */
import { sampleTrack, type Clip, type ClipKey, type ClipSampledTrack, type SampledTrack } from '@weasel-js/animator';
import { clockValue, timeList, type TimeRef } from './smilTime';
import { addValues, distance, sameShape, smilKind, smilValue, transformValue, type SmilKind, type SmilValue } from './smilValues';

const TAGS = ['animate', 'set', 'animateTransform', 'animateColor', 'animateMotion'];

/** Where an animation is active on the document's clock, and how long one pass of it is. */
interface Interval { begin: number; end: number; pass: number }

type Warn = (message: string) => void;

/** Named once, for the track that moves it and every warning about it. */
const nameOf = (el: Element): string => (el.id ? `#${el.id}` : `<${el.tagName}>`);

/** The interval of each animation element, resolved through the others' begins and ends. */
function createTimes(doc: Document, warn: Warn): (el: Element) => Interval | null {
  const known = new Map<Element, Interval | null>();
  const resolving = new Set<Element>();

  const resolve = (ref: TimeRef, of: Element): number | null => {
    if (ref.kind === 'offset') return ref.ms;
    if (ref.kind === 'other') {
      warn(`${nameOf(of)} begins or ends on "${ref.raw}", which an import has no clock for`);
      return null;
    }
    const other = doc.getElementById(ref.id);
    if (!other || !TAGS.includes(other.tagName)) {
      warn(`${nameOf(of)} times itself by #${ref.id}, which is no animation`);
      return null;
    }
    const at = intervalOf(other);
    return at && (ref.edge === 'begin' ? at.begin : at.end) + ref.ms;
  };

  const earliest = (raw: string | null, of: Element, fallback: number | null): number | null => {
    if (raw === null) return fallback;
    const times = timeList(raw).map((r) => resolve(r, of)).filter((t): t is number => t !== null);
    if (times.length > 1) warn(`${nameOf(of)} lists several times; it is imported at the earliest, once`);
    return times.length ? Math.min(...times) : null;
  };

  function intervalOf(el: Element): Interval | null {
    if (known.has(el)) return known.get(el)!;
    if (resolving.has(el)) {
      warn(`${nameOf(el)} is timed by a chain that comes back to it`);
      return null;
    }
    resolving.add(el);
    const begin = earliest(el.getAttribute('begin'), el, 0);
    const durRaw = el.getAttribute('dur');
    const dur = durRaw === null || durRaw.trim() === 'indefinite' ? Infinity : clockValue(durRaw);
    let out: Interval | null = null;
    if (begin === null) out = null;
    else if (dur === null || dur <= 0) warn(`${nameOf(el)} has a dur of "${durRaw}", which plays nothing`);
    else {
      const repeat = el.getAttribute('repeatCount')?.trim();
      const repeatDur = el.getAttribute('repeatDur')?.trim();
      const byCount = repeat === undefined ? undefined : repeat === 'indefinite' ? Infinity : Number(repeat) * dur;
      const byDur = repeatDur === undefined ? undefined : repeatDur === 'indefinite' ? Infinity : clockValue(repeatDur) ?? undefined;
      let active = byCount === undefined && byDur === undefined ? dur : Math.min(byCount ?? Infinity, byDur ?? Infinity);
      const end = earliest(el.getAttribute('end'), el, null);
      if (end !== null && end > begin) active = Math.min(active, end - begin);
      out = Number.isNaN(active) || active <= 0 ? null : { begin, end: begin + active, pass: dur };
    }
    resolving.delete(el);
    known.set(el, out);
    return out;
  }
  return intervalOf;
}

/** The values one pass moves through, from `values`, or `from` / `to` / `by` against `base`. */
function passValues(el: Element, read: (raw: string) => SmilValue | null, base: SmilValue | null, warn: Warn): SmilValue[] | null {
  const raw = el.tagName === 'set' ? el.getAttribute('to') : el.getAttribute('values');
  if (raw !== null) {
    const list = el.tagName === 'set' ? [raw] : raw.split(';').map((v) => v.trim()).filter(Boolean);
    const values = list.map(read);
    if (values.length && values.every((v) => v !== null)) return values as SmilValue[];
    warn(`${nameOf(el)} has a value it cannot read: "${raw}"`);
    return null;
  }
  const attr = (name: string): SmilValue | null | undefined => {
    const v = el.getAttribute(name);
    return v === null ? undefined : read(v);
  };
  const from = attr('from') ?? base;
  const to = attr('to');
  const by = attr('by');
  if (from === null || to === null || by === null) {
    warn(`${nameOf(el)} animates from or to a value it cannot read`);
    return null;
  }
  if (to !== undefined) return from === undefined ? null : [from, to];
  const sum = by !== undefined && from !== undefined ? addValues(from, by) : null;
  if (sum === null || from === undefined) warn(`${nameOf(el)} has no values, or a by it cannot add`);
  return sum === null || from === undefined ? null : [from, sum];
}

const STEP: ClipKey['easing'] = { steps: 1 };

/** One pass's keys, from 0 to `pass` ms, by `calcMode`, `keyTimes` and `keySplines`. */
function passKeys(el: Element, values: SmilValue[], pass: number, steps: boolean, warn: Warn): ClipKey[] | null {
  const n = values.length;
  let mode = el.tagName === 'set' ? 'discrete' : (el.getAttribute('calcMode') ?? 'linear');
  if (steps || n === 1) mode = 'discrete';
  const given = el.getAttribute('keyTimes')?.split(';').map((s) => Number(s.trim()));
  let times = given ?? values.map((_, i) => (mode === 'discrete' ? i / n : i / Math.max(1, n - 1)));
  if (mode === 'paced' && !given) {
    const gaps = values.slice(1).map((v, i) => distance(values[i], v));
    const total = gaps.reduce<number>((s, g) => s + (g ?? NaN), 0);
    if (Number.isFinite(total) && total > 0) {
      let run = 0;
      times = [0, ...gaps.map((g) => (run += g!) / total)];
    } else warn(`${nameOf(el)} is paced over values with no distance; it is timed evenly`);
  }
  if (times.length !== n || times.some((t) => !(t >= 0 && t <= 1))) {
    warn(`${nameOf(el)} has keyTimes that do not match its ${n} values`);
    return null;
  }
  const splines = mode === 'spline' ? el.getAttribute('keySplines')?.split(';').map((s) => s.trim().split(/[\s,]+/).map(Number)) : undefined;
  if (splines && (splines.length !== n - 1 || splines.some((b) => b.length !== 4 || b.some((x) => !Number.isFinite(x))))) {
    warn(`${nameOf(el)} has keySplines that do not match its values`);
    return null;
  }
  const keys = values.map((value, i): ClipKey => {
    const key: ClipKey = { t: times[i] * pass, value };
    if (i > 0 && mode === 'discrete') key.easing = STEP;
    if (i > 0 && splines) key.easing = { bezier: splines[i - 1] as [number, number, number, number] };
    return key;
  });
  if (mode === 'discrete' || keys[n - 1].t < pass) keys.push({ t: pass, value: values[n - 1], ...(mode === 'discrete' ? { easing: STEP } : {}) });
  return keys;
}

/** The keys of every pass from `begin` to `end`, the last cut where the active duration ends. */
function laidOut(pass: ClipKey[], at: Interval, lerps: boolean, el: Element, warn: Warn): ClipKey[] {
  const span = Number.isFinite(at.end) ? at.end - at.begin : at.pass;
  const out: ClipKey[] = [];
  for (let start = 0; start < span; start += at.pass) {
    const cut = span - start;
    for (const k of pass) if (k.t <= cut) out.push({ ...k, t: at.begin + start + k.t });
    if (cut < at.pass) {
      const track: SampledTrack<unknown> = { kind: 'sampled', keys: pass.map((k) => ({ ...k })) as never };
      if (!lerps) warn(`${nameOf(el)} ends partway through a pass of values that step; it holds the last one reached`);
      out.push({ t: at.begin + span, value: (lerps ? sampleTrack(track, cut) : [...pass].reverse().find((k) => k.t <= cut)!.value) as SmilValue });
    }
  }
  return out;
}

/** What an animation of `el`'s target reads the target's own value as, for `to`, `by` and `fill="remove"`. */
function baseOf(target: Element, attribute: string, read: (raw: string) => SmilValue | null): SmilValue | null {
  const own = target.getAttribute(attribute);
  return own === null ? null : read(own);
}

/** The track one animation element makes, or null, warned, where it makes none. */
function trackOf(el: Element, target: Element, at: Interval, warn: Warn): ClipSampledTrack | null {
  const transform = el.tagName === 'animateTransform';
  const attribute = el.getAttribute('attributeName') ?? '';
  const type = el.getAttribute('type') ?? 'translate';
  const kind: SmilKind = transform ? 'list' : smilKind(attribute);
  const read = (raw: string): SmilValue | null => (transform ? transformValue(type, raw) : smilValue(kind, raw));
  if (!transform && attribute === '') {
    warn(`${nameOf(el)} names no attributeName`);
    return null;
  }
  if (el.getAttribute('additive') === 'sum') warn(`${nameOf(el)} adds to the value under it; it is imported replacing it`);
  if (el.getAttribute('accumulate') === 'sum') warn(`${nameOf(el)} accumulates over repeats; each repeat is imported from its first value`);
  const base = transform ? null : baseOf(target, attribute, read);
  const values = passValues(el, read, base, warn);
  if (!values) return null;
  const steps = kind === 'string' || !sameShape(values);
  const pass = passKeys(el, values, at.pass, steps, warn);
  if (!pass) return null;
  const keys = laidOut(pass, at, !steps && kind !== 'path', el, warn);
  if (el.getAttribute('fill') !== 'freeze' && Number.isFinite(at.end)) {
    if (base === null) warn(`${nameOf(el)} lets go at its end, and its target has no ${attribute || 'transform'} of its own to go back to; it holds its last value`);
    else keys.push({ t: at.end, value: base, easing: STEP });
  }
  const track: ClipSampledTrack = { kind: 'sampled', label: nameOf(el), target: `${target.id}.${transform ? `transform.${type}` : attribute}`, keys };
  if (kind === 'path' && !steps) track.interpolate = 'svg-path';
  return track;
}

/**
 * The document's SMIL as a clip, or undefined where it has none. An animated element without an
 * `id` is given one, `smil-1` and on, so its node and its tracks name each other; read this before
 * the nodes are. Each element a track moves is entered in `targets` with what it moves: an attribute, or `transform`.
 */
export function readSmil(root: Element, warn: Warn, targets?: Map<Element, Set<string>>): Clip | undefined {
  const doc = root.ownerDocument;
  const elements = TAGS.flatMap((tag) => Array.from(root.getElementsByTagName(tag)));
  if (elements.length === 0) return undefined;
  const times = createTimes(doc, warn);
  let minted = 0;
  const tracks: ClipSampledTrack[] = [];
  const loops: Interval[] = [];
  for (const el of elements) {
    if (el.tagName === 'animateMotion') {
      warn(`${nameOf(el)} moves along a path, which the import does not carry yet`);
      continue;
    }
    const href = el.getAttribute('href') ?? el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    const target = href?.startsWith('#') ? doc.getElementById(href.slice(1)) : el.parentElement;
    if (!target || target === root) {
      warn(`${nameOf(el)} has no element to animate`);
      continue;
    }
    if (!target.id) {
      do target.id = `smil-${++minted}`; while (doc.querySelectorAll(`[id="${target.id}"]`).length > 1);
    }
    const at = times(el);
    if (!at) continue;
    const track = trackOf(el, target, at, warn);
    if (!track) continue;
    tracks.push(track);
    if (targets) targets.set(target, (targets.get(target) ?? new Set<string>()).add(el.tagName === 'animateTransform' ? 'transform' : el.getAttribute('attributeName') ?? ''));
    if (!Number.isFinite(at.end)) loops.push(at);
  }
  if (tracks.length === 0) return undefined;
  const clip: Clip = { version: 1, tracks };
  const [first] = loops;
  if (first && loops.length === tracks.length && loops.every((l) => l.begin === 0 && l.pass === first.pass)) {
    clip.loop = true;
    clip.duration = first.pass;
  } else if (loops.length > 0) {
    warn(`${loops.length} animation(s) repeat forever on their own periods, which one clip loop cannot hold; each is imported as one pass`);
  }
  return clip;
}

import { fromBase64url, toBase64url } from './base64url';

/** Turns a lab's state into bytes for a link and back. `unpack` may throw on bytes it cannot read. */
export interface LinkCodec<T = unknown> {
  pack(value: T): Uint8Array;
  unpack(bytes: Uint8Array): unknown;
}

/** UTF-8 JSON: the codec a {@link LinkSpec} uses unless it names another. */
export const jsonCodec: LinkCodec = {
  pack: (value) => new TextEncoder().encode(JSON.stringify(value)),
  unpack: (bytes) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
};

/**
 * How a lab writes its state into a link. A link reads `<version>.<base64url>`; text with no version
 * prefix is version 0, a link from before the lab versioned its links.
 */
export interface LinkSpec<T> {
  /** The version links are written at: a positive integer, raised whenever the shape changes. */
  version: number;
  /** Default {@link jsonCodec}. */
  codec?: LinkCodec<T>;
  /** The codec an older version's bytes were written with. Default `codec`. */
  codecFor?: (version: number) => LinkCodec;
  /** Brings a value read from an older version, 0 included, up to this version's shape, naming in
   *  `dropped` what it could not carry. Without it, an older link is refused. */
  migrate?: (value: unknown, from: number, dropped: string[]) => unknown;
  /** Checks a value from a link, which anyone can write, and answers what of it the lab can use,
   *  naming what it left out in `dropped`; `null` refuses the link. Without it, the value is
   *  taken as it is. */
  clean?: (value: unknown, dropped: string[]) => T | null;
}

/** Why a link was refused. */
export type LinkFault =
  /** Not a link this lab could have written: bad base64url, or bytes its codec cannot read. */
  | 'malformed'
  /** Written by a later version than the spec's. */
  | 'newer'
  /** Written by an earlier version, with no `migrate` to bring it up. */
  | 'older'
  /** Read, and refused by `clean`. */
  | 'refused';

/** What reading a link gave. `dropped` names, one short phrase each, what did not come through. */
export type LinkRead<T> =
  | { ok: true; value: T; version: number; dropped: readonly string[] }
  | { ok: false; fault: LinkFault; version: number | null; dropped: readonly string[] };

const VERSIONED = /^(\d+)\.(.*)$/s;

function assertVersion(version: number): void {
  if (!Number.isInteger(version) || version < 1)
    throw new Error(`[labkit] a link's version is a positive integer, not ${version}`);
}

/** `value` as a link's text, at `spec`'s version. */
export function packLink<T>(value: T, spec: LinkSpec<T>): string {
  assertVersion(spec.version);
  const codec = (spec.codec ?? jsonCodec) as LinkCodec<T>;
  return `${spec.version}.${toBase64url(codec.pack(value))}`;
}

function fault<T>(
  kind: LinkFault,
  version: number | null,
  dropped: readonly string[],
): LinkRead<T> {
  return { ok: false, fault: kind, version, dropped };
}

/**
 * The state the link `text` holds, read by `spec`, or `null` for empty text. A leading `#` is
 * ignored. Never throws: a link this lab cannot use comes back as a fault naming what was dropped.
 */
export function unpackLink<T>(text: string, spec: LinkSpec<T>): LinkRead<T> | null {
  assertVersion(spec.version);
  const body = text.replace(/^#/, '');
  if (body === '') return null;
  const match = VERSIONED.exec(body);
  const version = match ? Number(match[1]) : 0;
  const payload = match ? (match[2] as string) : body;
  if (version > spec.version)
    return fault('newer', version, [
      `a version ${version} link, newer than the version ${spec.version} this lab reads`,
    ]);
  const malformed = fault<T>('malformed', match ? version : null, ['a link that does not read']);
  // Unprefixed text that is anything but a link (an anchor, say) is noise, not an old link.
  if (version < spec.version && !spec.migrate)
    return version === 0
      ? malformed
      : fault('older', version, [`a version ${version} link, which this lab no longer reads`]);
  const bytes = fromBase64url(payload);
  if (!bytes) return malformed;
  const codec =
    version === spec.version
      ? (spec.codec ?? jsonCodec)
      : (spec.codecFor?.(version) ?? spec.codec ?? jsonCodec);
  const dropped: string[] = [];
  let value: unknown;
  try {
    value = codec.unpack(bytes);
    if (version < spec.version) value = spec.migrate?.(value, version, dropped);
  } catch {
    return malformed;
  }
  if (!spec.clean) return { ok: true, value: value as T, version, dropped };
  let clean: T | null;
  try {
    clean = spec.clean(value, dropped);
  } catch {
    return malformed;
  }
  if (clean === null)
    return fault('refused', version, dropped.length ? dropped : ['a link this lab cannot use']);
  return { ok: true, value: clean, version, dropped };
}

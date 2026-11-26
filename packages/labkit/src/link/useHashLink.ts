import { useLatest } from '@weasel-js/react';
import { after } from '@weasel-js/registry';
import { type RefObject, useEffect, useRef } from 'react';
import { type LinkRead, type LinkSpec, packLink, unpackLink } from './link';

/** The state the page's URL hash holds, read by `spec`; `null` with no hash, or off the browser.
 *  For the initial state of what {@link useHashLink} keeps in the hash. */
export function hashLink<T>(spec: LinkSpec<T>): LinkRead<T> | null {
  if (typeof location === 'undefined') return null;
  return unpackLink(location.hash, spec);
}

/** Options for {@link useHashLink}. */
export interface HashLinkOptions<T> {
  /** What a hash the lab cannot read, or one cleared by hand, puts the state back to. Without it,
   *  the state stays as it is. */
  fallback?: T;
  /** Called with each read of the hash that left something out or was refused. */
  onReport?: (read: LinkRead<T>) => void;
  /** How long the hash waits after the last change before it is written, in ms. Default 250. */
  delay?: number;
}

interface Pending {
  text: string;
  stop: () => void;
}

function cancel(pending: RefObject<Pending | null>): void {
  pending.current?.stop();
  pending.current = null;
}

function flush(pending: RefObject<Pending | null>, synced: RefObject<string | null>): void {
  const write = pending.current;
  if (!write) return;
  cancel(pending);
  synced.current = write.text;
  history.replaceState(history.state, '', `#${write.text}`);
}

/**
 * Keeps the page's URL hash a link to `value`, so the address bar can be shared or bookmarked.
 * The state stays where the lab keeps it, beside its undo: the hook only mirrors it.
 *
 * - **Writes** `value` with `history.replaceState`, `delay` ms after it last changed, so a drag
 *   is one write and the back button gains no entries. A write never calls `apply`, so undo and
 *   redo move the hash without making steps of their own.
 * - **Reads** the hash at mount and on every `hashchange` (a pasted link, an edit by hand),
 *   and hands what it holds to `apply`, which should write it the way any edit is written, so
 *   one undo takes it back. A value that already matches is not handed over. Start the state
 *   from {@link hashLink} and the mount read finds nothing to do.
 * - **Never throws** on a hash it cannot use: it reports it to `onReport`, puts the state to
 *   `fallback` when one is given, and leaves the hash as it is until the state next changes, so
 *   a link from a newer version survives being opened in an older one.
 *
 * The hook owns the whole fragment; an empty one at mount is written with the state.
 */
export function useHashLink<T>(
  value: T,
  apply: (value: T) => void,
  spec: LinkSpec<T>,
  options: HashLinkOptions<T> = {},
): void {
  const latest = useLatest({ value, apply, spec, options });
  // The packed state the hash already stands for; a change to anything else is written.
  const synced = useRef<string | null>(null);
  const pending = useRef<Pending | null>(null);
  // Whether the mount read found a hash, which the state the lab mounted with must not overwrite.
  const kept = useRef(false);

  useEffect(() => {
    const take = (mount: boolean): void => {
      const { value: current, apply: write, spec: format, options: opts } = latest.current;
      // A write still waiting loses to the hash someone else just wrote.
      cancel(pending);
      const read = unpackLink(location.hash, format);
      if (mount) kept.current = read !== null;
      if (mount && read === null) {
        synced.current = null;
        return;
      }
      if (read && (!read.ok || read.dropped.length > 0)) opts.onReport?.(read);
      const next = read?.ok ? read.value : opts.fallback;
      const text = packLink(next === undefined ? current : next, format);
      synced.current = text;
      if (next !== undefined && text !== packLink(current, format)) write(next);
    };
    take(true);
    const onChange = (): void => take(false);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, [latest]);

  useEffect(() => {
    cancel(pending);
    if (kept.current) {
      kept.current = false;
      return;
    }
    const text = packLink(value, latest.current.spec);
    if (text === synced.current) return;
    const stop = after(latest.current.options.delay ?? 250, () => flush(pending, synced));
    pending.current = { text, stop };
  }, [value, latest]);

  useEffect(() => {
    const onHide = (): void => flush(pending, synced);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flush(pending, synced);
    };
  }, []);
}

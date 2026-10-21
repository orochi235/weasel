import type { LensSourceStatus } from '@weasel-js/labkit/loupe';
import { CAPTURE_PATH, type CapturePayload, messageOf } from '../../vite/capture/payload';

export const CHECKING = 'checking for a capture browser';
const UNAVAILABLE = 'captures are unavailable';
/** A built workshop, served without the dev server, has no endpoint to ask. */
export const NO_ENDPOINT = 'this server takes no captures';

/** The dev server's capture endpoint as a Pixels source talks to it. */
export interface CaptureClient {
  /** `true`, or why no capture can be taken, as the endpoint last said. */
  status(): LensSourceStatus;
  /** Also asks the endpoint again. */
  subscribe(listener: () => void): () => void;
  /** Asks the endpoint whether it can take captures, unless an ask is already out. */
  poll(): void;
  /** A capture of `payload`, or null when the endpoint answers that it cannot take one; throws on any other failure. */
  take(payload: CapturePayload): Promise<ImageBitmap | null>;
}

export function createCaptureClient(base: string, send: typeof fetch): CaptureClient {
  const url = `${base}${CAPTURE_PATH}`;
  const listeners = new Set<() => void>();
  let status: LensSourceStatus = CHECKING;
  let polling: Promise<void> | null = null;
  const setStatus = (next: LensSourceStatus) => {
    if (next === status) return;
    status = next;
    for (const listener of [...listeners]) listener();
  };
  const poll = () => {
    polling ??= (async () => {
      try {
        const res = await send(url);
        if (!res.ok) return setStatus(NO_ENDPOINT);
        const body = (await res.json()) as { available?: boolean; reason?: string };
        setStatus(body.available === true ? true : (body.reason ?? UNAVAILABLE));
      } catch (err) {
        setStatus(`${NO_ENDPOINT}: ${messageOf(err)}`);
      } finally {
        polling = null;
      }
    })();
  };
  return {
    status: () => status,
    subscribe(listener) {
      listeners.add(listener);
      poll();
      return () => listeners.delete(listener);
    },
    poll,
    async take(payload) {
      const res = await send(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.status === 503) {
        setStatus(((await res.json()) as { reason?: string }).reason ?? UNAVAILABLE);
        return null;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `capture failed: ${res.status}`);
      }
      return createImageBitmap(await res.blob());
    },
  };
}

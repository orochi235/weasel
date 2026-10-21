import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { stableStringify } from '@weasel-js/core/json';
import type { ViteDevServer } from 'vite';
import { type CaptureBrowser, captureAvailability, launchCaptureBrowser, QUEUE_FULL } from './browser.ts';
import { createCaptureCache } from './cache.ts';
import { CAPTURE_PAGES, CAPTURE_PATH, type CapturePayload, messageOf, parsePayload } from './payload.ts';

/** The capture endpoint as the plugin drives it. */
export interface CaptureEndpoint {
  /** Drops every cached capture: a client module changed, so none of them shows the story as it is now. */
  revise(): void;
  /** Closes Chromium and drops the cache, for the server closing. */
  close(): Promise<void>;
}

const MAX_BODY = 16 * 1024 * 1024;

type Launched = CaptureBrowser | { unavailable: string };

const keyOf = (payload: CapturePayload) => createHash('sha1').update(stableStringify(payload)).digest('hex');

/** A socket address as a URL's host: IPv6 bracketed with its zone id escaped (RFC 6874), IPv4-mapped unwrapped. */
export const urlHost = (address: string): string => {
  const v4 = address.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '');
  return v4.includes(':') ? `[${v4.replace('%', '%25')}]` : v4;
};

/**
 * The origin the request arrived on, read from its socket. Never from its `Host` header, which the client writes:
 * the capture page is loaded from here, and a forged host would have Chromium screenshot someone else's page.
 */
const socketOrigin = (req: IncomingMessage, protocol: string) =>
  `${protocol}://${urlHost(req.socket.localAddress ?? '127.0.0.1')}:${req.socket.localPort}`;

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Whether a browser's `Origin` names this server: the address the request came in on, a loopback name for its
 *  port, or one of the URLs vite printed for it. */
function ownOrigin(origin: string, req: IncomingMessage, protocol: string, server: ViteDevServer): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin === socketOrigin(req, protocol)) return true;
  if (url.protocol === `${protocol}:` && LOOPBACK.has(url.hostname) && url.port === String(req.socket.localPort)) return true;
  const printed = [...(server.resolvedUrls?.local ?? []), ...(server.resolvedUrls?.network ?? [])];
  return printed.some((u) => new URL(u).origin === url.origin);
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_BODY) return void chunks.push(chunk);
      // Stop reading rather than drain the rest; the 413 goes out before the socket closes.
      req.pause();
      req.removeAllListeners('data');
      resolve(null);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Answers `<base>__forge/capture`: a GET says whether Pixels is available, and a POST of a `CapturePayload` answers
 * with a PNG of the story rendered from it, from the cache when the same payload was captured since the last
 * `revise()`. Chromium starts on the first POST that is not served from the cache. `allowOrigins` names what a
 * capture page may load besides this server, read at each capture.
 */
export function serveCapture(
  server: ViteDevServer,
  base: string,
  allowOrigins: () => readonly string[] = () => [],
): CaptureEndpoint {
  const cache = createCaptureCache();
  let launched: Promise<Launched> | null = null;
  /** Bumped by `revise()`, so a capture that started before an edit is not cached after it. */
  let revision = 0;

  const browser = (): Promise<Launched> => {
    if (!launched) {
      const launching = launchCaptureBrowser();
      launched = launching;
      // An unavailable answer is asked again next time: Playwright may have been installed since.
      void launching.then((result) => {
        if ('unavailable' in result && launched === launching) launched = null;
      });
    }
    return launched;
  };

  const protocol = server.config.server.https ? 'https' : 'http';

  const capture = async (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin;
    if (origin !== undefined && !ownOrigin(origin, req, protocol, server)) {
      return json(res, 403, { error: 'a capture is only taken for this server’s own pages' });
    }
    const type = (req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase();
    if (type !== 'application/json') return json(res, 415, { error: 'a capture payload is sent as application/json' });
    const body = await readBody(req);
    if (body === null) {
      res.setHeader('Connection', 'close');
      json(res, 413, { error: 'capture payload is too large' });
      return void res.once('finish', () => req.destroy());
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return json(res, 400, { error: 'capture payload is not JSON' });
    }
    const payload = parsePayload(parsed);
    if ('error' in payload) return json(res, 400, payload);

    const key = keyOf(payload);
    let png = cache.get(key);
    if (!png) {
      const result = await browser();
      if ('unavailable' in result) return json(res, 503, { available: false, reason: result.unavailable });
      const page = `${socketOrigin(req, protocol)}${base}${payload.isolate ? CAPTURE_PAGES.frame : CAPTURE_PAGES.shell}`;
      const at = revision;
      try {
        png = await result.capture(page, payload, allowOrigins());
      } catch (err) {
        const message = messageOf(err);
        if (message === QUEUE_FULL) return json(res, 503, { available: false, reason: QUEUE_FULL });
        return json(res, 500, { error: message });
      }
      if (at === revision) cache.set(key, png);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/png');
    res.end(png);
  };

  /** Answered without starting Chromium; a launch failure surfaces on the first POST instead. */
  const status = async (res: ServerResponse) => {
    const result = await captureAvailability();
    json(res, 200, 'unavailable' in result ? { available: false, reason: result.unavailable } : { available: true });
  };

  server.middlewares.use((req, res, next) => {
    if (req.url?.split('?')[0] !== `${base}${CAPTURE_PATH}`) return next();
    if (req.method === 'GET') return void status(res).catch(next);
    if (req.method === 'POST') return void capture(req, res).catch(next);
    next();
  });

  return {
    revise() {
      revision += 1;
      cache.clear();
    },
    async close() {
      revision += 1;
      cache.clear();
      const closing = launched;
      launched = null;
      const result = await closing;
      if (result && !('unavailable' in result)) await result.close();
    },
  };
}

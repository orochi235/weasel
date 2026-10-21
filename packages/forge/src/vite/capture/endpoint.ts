import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { type CaptureBrowser, launchCaptureBrowser, QUEUE_FULL } from './browser.ts';
import { createCaptureCache } from './cache.ts';
import { CAPTURE_PAGES, CAPTURE_PATH, type CapturePayload, parsePayload } from './payload.ts';

/** The capture endpoint as the plugin drives it. */
export interface CaptureEndpoint {
  /** Drops every cached capture: a client module changed, so none of them shows the story as it is now. */
  revise(): void;
  /** Closes Chromium and drops the cache, for the server closing. */
  close(): Promise<void>;
}

const MAX_BODY = 16 * 1024 * 1024;

type Launched = CaptureBrowser | { unavailable: string };

// The same canonical JSON as core's `stableStringify`, which this realm cannot import: core's barrel pulls in
// component stylesheets that Node cannot load.
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );

const keyOf = (payload: CapturePayload) => createHash('sha1').update(stable(payload)).digest('hex');

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
      if (size <= MAX_BODY) chunks.push(chunk);
    });
    req.on('end', () => resolve(size > MAX_BODY ? null : Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Answers `<base>__forge/capture`: a GET says whether Pixels is available, and a POST of a `CapturePayload` answers
 * with a PNG of the story rendered from it, from the cache when the same payload was captured since the last
 * `revise()`. Chromium starts on the first request that needs it.
 */
export function serveCapture(server: ViteDevServer, base: string): CaptureEndpoint {
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

  const capture = async (req: IncomingMessage, res: ServerResponse) => {
    const body = await readBody(req);
    if (body === null) return json(res, 413, { error: 'capture payload is too large' });
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
      const page = `http://${req.headers.host ?? 'localhost'}${base}${payload.isolate ? CAPTURE_PAGES.frame : CAPTURE_PAGES.shell}`;
      const at = revision;
      try {
        png = await result.capture(page, payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === QUEUE_FULL) return json(res, 503, { available: false, reason: QUEUE_FULL });
        return json(res, 500, { error: message });
      }
      if (at === revision) cache.set(key, png);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/png');
    res.end(png);
  };

  const status = async (res: ServerResponse) => {
    const result = await browser();
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

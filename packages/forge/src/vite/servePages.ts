import type { ViteDevServer } from 'vite';
import { type CaptureEndpoint, serveCapture } from './capture/endpoint.ts';
import { CAPTURE_PAGES } from './capture/payload.ts';
import { html } from './html.ts';
import type { ShellFields } from './shellTitle.ts';

const PAGES: Record<string, string> = {
  '/': 'shell-entry.js',
  '/index.html': 'shell-entry.js',
  '/frame.html': 'frame-entry.js',
  [`/${CAPTURE_PAGES.shell}`]: 'capture-entry.js',
  [`/${CAPTURE_PAGES.frame}`]: 'capture-frame-entry.js',
};

/**
 * Answers a GET for the workshop page, the frame document or a capture page, under `base`, with the page built
 * around its entry; and serves the capture endpoint beside them. `shell` is read again for each page and capture.
 */
export function servePages(server: ViteDevServer, base: string, shell: () => ShellFields): CaptureEndpoint {
  server.middlewares.use((req, res, next) => {
    const url = req.url ?? '/';
    const path = url.split('?')[0] ?? '/';
    const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
    const page = path === prefix ? '/' : path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : null;
    const entry = req.method === 'GET' && page !== null ? PAGES[page] : undefined;
    if (!entry) return next();
    server.transformIndexHtml(url, html(entry, 'serve', shell().title)).then(
      (doc) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(doc);
      },
      (err: unknown) => next(err),
    );
  });
  return serveCapture(server, base, () => shell().allowOrigins);
}

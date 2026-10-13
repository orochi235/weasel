import type { ViteDevServer } from 'vite';
import { html } from './html.ts';

const PAGES: Record<string, string> = { '/': 'shell-entry.js', '/index.html': 'shell-entry.js', '/frame.html': 'frame-entry.js' };

/** Answers a GET for the workshop page or the frame document, under `base`, with the page built around its entry. */
export function servePages(server: ViteDevServer, base: string, title: () => string | undefined): void {
  server.middlewares.use((req, res, next) => {
    const url = req.url ?? '/';
    const path = url.split('?')[0] ?? '/';
    const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
    const page = path === prefix ? '/' : path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : null;
    const entry = req.method === 'GET' && page !== null ? PAGES[page] : undefined;
    if (!entry) return next();
    server.transformIndexHtml(url, html(entry, 'serve', title())).then(
      (doc) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(doc);
      },
      (err: unknown) => next(err),
    );
  });
}

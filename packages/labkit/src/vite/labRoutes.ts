import { statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { posix, resolve } from 'node:path';
import type { Connect, Plugin, ResolvedConfig } from 'vite';

/** What {@link pageUrlFor} reads off a request. */
export interface PageRequest {
  method?: string | undefined;
  url?: string | undefined;
  headers: IncomingMessage['headers'];
}

/** Where {@link pageUrlFor} looks for pages. */
export interface PageSite {
  /** The URL path the site is served under, with leading and trailing slashes. */
  base: string;
  /** The directory a URL under `base` names a file in. */
  dir: string;
  isFile: (path: string) => boolean;
}

const isDocumentRequest = (req: PageRequest): boolean => {
  if (req.method !== 'GET') return false;
  if (req.headers['sec-fetch-dest'] === 'document') return true;
  const accept = req.headers.accept;
  return (Array.isArray(accept) ? accept.join(',') : (accept ?? '')).includes('text/html');
};

/** The URL a document request for an extensionless page is served from: its
 *  path with `.html` added, query kept, when that file exists under `dir`.
 *  Undefined for anything else, which is then served as it would be anyway. */
export function pageUrlFor(req: PageRequest, site: PageSite): string | undefined {
  if (!req.url || !isDocumentRequest(req)) return undefined;
  const cut = req.url.search(/[?#]/);
  const path = cut < 0 ? req.url : req.url.slice(0, cut);
  const query = cut < 0 ? '' : req.url.slice(cut);
  if (!path.startsWith(site.base) || path.endsWith('/')) return undefined;
  let rel: string;
  try {
    rel = decodeURIComponent(path.slice(site.base.length));
  } catch {
    return undefined;
  }
  if (rel === '' || rel.includes('\0') || posix.extname(rel) !== '') return undefined;
  const clean = posix.normalize(rel);
  if (clean.startsWith('..') || posix.isAbsolute(clean)) return undefined;
  return site.isFile(resolve(site.dir, `${clean}.html`)) ? `${path}.html${query}` : undefined;
}

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

const basePath = (base: string): string => {
  const path = base.startsWith('/')
    ? base
    : /^[a-z][a-z\d+.-]*:/i.test(base)
      ? new URL(base).pathname
      : '/';
  return path.endsWith('/') ? path : `${path}/`;
};

const rewrite =
  (site: PageSite): Connect.NextHandleFunction =>
  (req: IncomingMessage, _res: ServerResponse, next: Connect.NextFunction) => {
    const url = pageUrlFor(req, site);
    if (url !== undefined) req.url = url;
    next();
  };

/**
 * Serves a lab's pages at clean URLs: `/fastmoney` answers with `fastmoney.html`,
 * in `vite` and in `vite preview`, as the page switcher's links expect.
 *
 * Vite answers a path with a module when one resolves there, ahead of any page,
 * unless the request carries `Sec-Fetch-Dest: document`, which a browser sends
 * only to a trustworthy origin and never to a LAN address over http. So
 * `/fastmoney` beside a `fastMoney.tsx` returns script on a case-insensitive
 * disk. This rewrites a document request (a `GET` whose `Sec-Fetch-Dest` is
 * `document` or whose `Accept` takes `text/html`) for a path with no extension
 * to its `.html` when that file exists, before Vite sees it. Every other request
 * passes untouched.
 */
export function labRoutes(): Plugin {
  const siteFor = (config: ResolvedConfig, dir: string): PageSite => ({
    base: basePath(config.base),
    dir,
    isFile,
  });
  return {
    name: 'weasel-labkit-routes',
    configureServer(server) {
      server.middlewares.use(rewrite(siteFor(server.config, server.config.root)));
    },
    configurePreviewServer(server) {
      const { config } = server;
      server.middlewares.use(rewrite(siteFor(config, resolve(config.root, config.build.outDir))));
    },
  };
}

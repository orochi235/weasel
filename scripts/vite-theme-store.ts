import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { ThemeDefinition } from '../packages/theme/src/definition';
import { createThemeStore, type ThemeStore, type ThemeStoreOptions } from './theme-store';

const ROUTE = /\/__theme\/(list|[a-z][a-z0-9-]*)$/;

export interface ThemeResponse {
  readonly status: number;
  readonly body: unknown;
}

/** One request against the store; `undefined` for a path that is not the store's. */
export function handleThemeRequest(store: ThemeStore, method: string, path: string, body: unknown): ThemeResponse | undefined {
  const match = ROUTE.exec(path);
  if (!match) return undefined;
  const name = match[1];
  if (name === 'list') return method === 'GET' ? { status: 200, body: { themes: store.list() } } : { status: 405, body: { message: 'GET only' } };
  if (method === 'GET') {
    const theme = store.read(name);
    return theme ? { status: 200, body: theme } : { status: 404, body: { message: `no theme "${name}"` } };
  }
  if (method !== 'PUT') return { status: 405, body: { message: 'GET or PUT' } };
  const b = body as { definition?: unknown; hash?: unknown } | null;
  if (!b || typeof b.definition !== 'object' || b.definition === null || !(typeof b.hash === 'string' || b.hash === null)) {
    return { status: 400, body: { status: 'invalid', message: 'expected { definition, hash }' } };
  }
  const result = store.write(name, b.definition as ThemeDefinition, b.hash);
  return { status: result.status === 'saved' ? 200 : result.status === 'conflict' ? 409 : 400, body: result };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      text += chunk;
    });
    req.on('end', () => done(text));
    req.on('error', fail);
  });
}

function send(res: ServerResponse, { status, body }: ThemeResponse): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function parseBody(raw: string): { ok: true; body: unknown } | { ok: false } {
  if (!raw) return { ok: true, body: null };
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/** Serves and saves the theme definition files at `__theme/<name>`, for the theme editor and forge. Dev server only. */
export function themeStorePlugin(options: ThemeStoreOptions): Plugin {
  return {
    name: 'weasel-theme-store',
    apply: 'serve',
    configureServer(server) {
      const store = createThemeStore(options);
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (!ROUTE.test(path)) return next();
        readBody(req).then((raw) => {
          const parsed = parseBody(raw);
          if (!parsed.ok) return send(res, { status: 400, body: { status: 'invalid', message: 'the request body is not JSON' } });
          try {
            const response = handleThemeRequest(store, req.method ?? 'GET', path, parsed.body);
            if (response) send(res, response);
            else next();
          } catch (e) {
            send(res, { status: 500, body: { message: (e as Error).message } });
          }
        }, next);
      });
    },
  };
}

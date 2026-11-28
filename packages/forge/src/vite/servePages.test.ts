// @vitest-environment node
import type { ViteDevServer } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import { servePages } from './servePages.ts';

type Handler = (req: { url?: string; method?: string }, res: Res, next: (err?: unknown) => void) => void;
interface Res {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

const answer = async (method: string, url: string) => {
  const handlers: Handler[] = [];
  const server = {
    middlewares: { use: (handler: Handler) => handlers.push(handler) },
    transformIndexHtml: (_url: string, doc: string) => Promise.resolve(doc),
    config: { server: {} },
  } as unknown as ViteDevServer;
  servePages(server, '/', () => ({ title: 'Workshop', allowOrigins: [] }) as never);
  const next = vi.fn();
  let ended: () => void = () => {};
  const done = new Promise<void>((resolve) => (ended = resolve));
  const res: Res = {
    statusCode: 0,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
      ended();
    },
  };
  handlers[0]!({ url, method }, res, (err) => {
    next(err);
    ended();
  });
  await done;
  return { res, next };
};

describe('servePages', () => {
  it('answers GET for the workshop page with its document', async () => {
    const { res, next } = await answer('GET', '/');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('shell-entry.js');
  });

  it('answers HEAD for a page with GET status and headers, and no body', async () => {
    for (const url of ['/', '/frame.html']) {
      const { res, next } = await answer('HEAD', url);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.headers['Content-Type']).toBe('text/html');
      expect(res.body).toBeUndefined();
    }
  });

  it('leaves other methods to the next middleware', async () => {
    const { next } = await answer('POST', '/');
    expect(next).toHaveBeenCalled();
  });
});

import type { HotPayload, Plugin } from 'vite';

/**
 * Keeps one browser test file's failed import from blocking the clicks of every other file.
 *
 * vite answers a failed transform with a 500 to the file that asked, and also sends an `error` to every
 * page connected to the server, which draws `<vite-error-overlay>` over it. In a browser project that is
 * every tab's tester frame, so Playwright then finds the overlay on top of whatever a test presses.
 * `server.hmr.overlay: false` cannot switch it off: vitest sets `server.hmr: false`, which replaces the
 * object, and vite reads the flag only from an object. vitest reports the failing file's own import
 * error through its RPC, so nothing needs the broadcast.
 */
export function keepErrorsHome(): Plugin {
  return {
    name: 'weasel:keep-errors-home',
    configureServer(server) {
      const hot = server.environments.client.hot;
      const send = hot.send.bind(hot) as (...args: unknown[]) => void;
      hot.send = ((...args: unknown[]) => {
        if ((args[0] as HotPayload | undefined)?.type === 'error') return;
        send(...args);
      }) as typeof hot.send;
    },
  };
}

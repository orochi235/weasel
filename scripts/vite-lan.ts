import type { ServerOptions } from 'vite';

/** Every dev server answers on both loopbacks and the LAN, by address or by a machine's `.local` name, so one
 *  served from a fleet node (`npm run dev:fleet`) opens from here. */
export const LAN_SERVER = { host: '::', allowedHosts: ['.local'] } satisfies ServerOptions;

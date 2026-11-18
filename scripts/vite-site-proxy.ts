import ports from './dev-ports.json' with { type: 'json' };

const forward = (port: number) => ({ target: `http://localhost:${port}`, changeOrigin: true, ws: true });

/**
 * The site dev server's forwards to the apps the deployed site holds under its own path. Each of these
 * apps' dev base is that path, so the path goes through unchanged; forge's dev base is `/`, so the
 * site links to its port instead (`FORGE_LAB`).
 */
export const SITE_PROXY = {
  '/weasel/draw': forward(ports.draw),
  '/weasel/chart': forward(ports.chart),
};

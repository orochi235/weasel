import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLEET_DEV_APPS } from './lib/fleet-dev-apps.mjs';

const root = join(import.meta.dirname, '..');

describe('FLEET_DEV_APPS', () => {
  it.each(Object.entries(FLEET_DEV_APPS))("advertises %s at its vite config's dev base", (_, app) => {
    const config = readFileSync(join(root, app.config), 'utf8');
    const base = /^\s*base:\s*(.+),$/m.exec(config)?.[1] ?? "'/'";
    // A conditional base (forge's) ends in the dev-server branch.
    const dev = /'([^']*)'$/.exec(base)?.[1];
    expect(app.path).toBe(dev);
  });
});

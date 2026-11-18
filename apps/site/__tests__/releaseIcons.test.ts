import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { hasOwnKey } from '@weasel-js/registry';
import { PACKAGE_ICONS } from '../releaseIcons';

const PACKAGES_DIR = resolve(__dirname, '../../../packages');

/** Published packages whose badge waits on the maintainer's sketch (docs/TODO.md). Drawing one removes it here. */
const AWAITING_SKETCH = ['export', 'paint-kinds', 'prefs-editor', 'prefs-schema', 'scale', 'text-tools', 'ui-canvas'];

it('gives every published package a release-chip badge, but those awaiting a sketch', () => {
  const published = readdirSync(PACKAGES_DIR)
    .map((dir) => join(PACKAGES_DIR, dir, 'package.json'))
    .filter(existsSync)
    .map((file) => JSON.parse(readFileSync(file, 'utf8')) as { name: string; private?: boolean })
    .filter((manifest) => !manifest.private)
    .map((manifest) => manifest.name.replace(/^@weasel-js\//, ''));
  expect(published.filter((name) => !hasOwnKey(PACKAGE_ICONS, name)).sort()).toEqual(AWAITING_SKETCH);
});

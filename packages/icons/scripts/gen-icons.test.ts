import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { generate } from './gen-icons.mjs';

const fixture = (name: string) => join(import.meta.dirname, 'fixtures', name);

describe('gen:icons', () => {
  it('builds one table per package, each name in its own namespace', async () => {
    const { tables } = await generate({ roots: [fixture('alpha'), fixture('beta')], write: false });
    expect(tables.map((t) => t.namespace)).toEqual(['alpha', 'beta']);
    expect(tables[0].icons.dot).toEqual({ body: '<circle cx="10" cy="10" r="2"/>', group: 'Things', tags: ['point'] });
    expect(tables[0].icons.bar.body).toBe('<path d="M4 10h12"/>');
    expect(tables[1].icons.dot.body).toBe('<circle cx="9" cy="9" r="2"/>');
  });

  it('refuses two packages declaring one namespace', async () => {
    await expect(generate({ roots: [fixture('alpha'), fixture('alpha-again')], write: false })).rejects.toThrow(/namespace "alpha" is declared by both/);
  });

  it('refuses one name drawn twice, differently, in a namespace', async () => {
    await expect(generate({ roots: [fixture('twice')], write: false })).rejects.toThrow(/icon "dot" is drawn twice/);
  });

  it('refuses an icons directory with no index.mjs', async () => {
    await expect(generate({ roots: [fixture('no-index')], write: false })).rejects.toThrow(/no index\.mjs/);
  });
});

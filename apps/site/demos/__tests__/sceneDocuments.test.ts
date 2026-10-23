import { describe, expect, it } from 'vitest';
import { defaultDrawOne } from '@weasel-js/core';
import type { SceneNode, SerializedScene } from '@weasel-js/core';

// A scene document is JSON, so the typecheck never sees a fill written in a
// shape the painters no longer read; it paints nothing and no error is raised.
const documents = import.meta.glob<SerializedScene<unknown, string, unknown>>(
  '../data/*.scene.json',
  { eager: true, import: 'default' },
);

describe('the demos\' scene documents', () => {
  it('finds the documents', () => {
    expect(Object.keys(documents).length).toBeGreaterThan(0);
  });

  for (const [file, document] of Object.entries(documents)) {
    const filled = document.nodes.filter((node) => (node.data as { fill?: unknown } | null)?.fill != null);

    for (const node of filled) {
      if (node.kind === 'group') {
        it(`${file}: container ${node.id} declares no fill, which a container never paints`, () => {
          expect(node.data).not.toHaveProperty('fill');
        });
        continue;
      }
      it(`${file}: node ${node.id} paints the fill it declares`, () => {
        const [body] = defaultDrawOne(node as unknown as SceneNode<unknown, string, unknown>, node.pose);
        expect(body).toMatchObject({ kind: 'path', fill: { paint: expect.anything() } });
      });
    }
  }
});

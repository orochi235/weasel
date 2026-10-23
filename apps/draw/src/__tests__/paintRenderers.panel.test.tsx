import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import {
  ActionsProvider, asNodeId, createScene, inferredNodeProperties, inferredNodeRouting, rectPath, solid,
} from '@weasel-js/core';
import { SelectionPanel } from '@weasel-js/ui/components/SelectionPanel';
import { WD_RENDERERS } from '../paintRenderers';
import { renderWithIcons } from '../testIcons';

/** Draw's panel as the sidebar mounts it: the kit's schema, draw's paint
 *  renderers, and every value read from the node rather than stubbed. */
function fillKindBar(fill: unknown) {
  const scene = createScene<Record<string, unknown>, 'default', { x: number; y: number; width: number; height: number }>({
    systemLayers: [{ id: 'default' }],
  });
  scene.add({
    id: asNodeId('n'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 },
    data: { path: rectPath(0, 0, 10, 10), ...(fill === undefined ? {} : { fill }) },
  });
  const selection = { current: ['n'] };
  renderWithIcons(
    <ActionsProvider>
      <SelectionPanel
        scene={scene as never}
        selection={selection as never}
        properties={inferredNodeProperties}
        routing={inferredNodeRouting}
        renderers={WD_RENDERERS}
      />
    </ActionsProvider>,
  );
  return screen.getAllByRole('radiogroup', { name: 'Paint kind' })[0]!;
}

describe("WeaselDraw's fill row", () => {
  it.each([
    ['absent', undefined],
    ['null', null],
    ['a record with no paint', {}],
  ])('shows None for a fill that is %s', (_label, fill) => {
    const bar = fillKindBar(fill);
    expect(within(bar).getByRole('radio', { name: 'None' })).toBeChecked();
    expect(within(bar).getByRole('radio', { name: 'Solid' })).not.toBeChecked();
  });

  it('shows the paint a fill holds', () => {
    const bar = fillKindBar({ paint: solid('#ff0000') });
    expect(within(bar).getByRole('radio', { name: 'Solid' })).toBeChecked();
  });
});

import { fireEvent, screen } from '@testing-library/react';
import { sceneToAdapter } from '@weasel-js/core';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { expect, test, vi } from 'vitest';
import { LensZoom } from './LensZoom';
import { addLensOps, createLensScene } from './lensScene';

function mount() {
  const scene = createLensScene<string>();
  sceneToAdapter(scene).applyOps(
    addLensOps(scene, 'a', { body: { x: 300, y: 200 }, reticle: { x: 100, y: 200 } }),
    'add',
  );
  const onRelease = vi.fn();
  renderWithIcons(
    <LensZoom
      scene={scene}
      lensId="a"
      factor={4}
      shape="square"
      size={{ width: 200, height: 150 }}
      onRelease={onRelease}
    />,
  );
  return { onRelease, thumb: screen.getByRole('slider', { name: 'Zoom' }) };
}

test.each(['pointerUp', 'pointerCancel'] as const)(
  'a press on the zoom that ends with %s and no change still hands the keys back',
  async (end) => {
    const { onRelease, thumb } = mount();
    fireEvent.pointerDown(thumb, { pointerId: 3, button: 0 });
    expect(onRelease).not.toHaveBeenCalled();
    fireEvent[end](window, { pointerId: 3 });
    await Promise.resolve();
    expect(onRelease).toHaveBeenCalledTimes(1);
  },
);

test('another pointer lifting does not end the press', async () => {
  const { onRelease, thumb } = mount();
  fireEvent.pointerDown(thumb, { pointerId: 3, button: 0 });
  fireEvent.pointerUp(window, { pointerId: 4 });
  await Promise.resolve();
  expect(onRelease).not.toHaveBeenCalled();
});

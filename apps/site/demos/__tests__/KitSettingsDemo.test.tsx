import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { KitSettingsDemo } from '../KitSettingsDemo';

beforeAll(() => window.history.replaceState(null, '', '/?test=1'));
afterEach(() => {
  cleanup();
  localStorage.clear();
  delete window.__weaselTest;
});

const purpleX = () => (window.__weaselTest!.getScene().nodes.find((n) => n.id === 'b')!.pose as { x: number }).x;

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords. Drags the purple rect left by 37, its left edge
// to 123: three past the green rect's right edge at 120.
function dragPurple() {
  const canvas = document.querySelector('canvas')!;
  const at = (type: string, x: number) => canvas.dispatchEvent(
    new PointerEvent(type, { bubbles: true, clientX: x, clientY: 95, pointerId: 1, button: 0, buttons: 1 }),
  );
  act(() => {
    at('pointerdown', 195);
    at('pointermove', 180);
    at('pointermove', 158);
    at('pointerup', 158);
  });
}

describe('KitSettingsDemo', () => {
  it("draws both packages' settings in one form, the merged targets group among them", async () => {
    await renderSettled(<KitSettingsDemo />);
    expect(screen.getByRole('spinbutton', { name: 'Typeahead' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Double-click interval' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Curve key' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Selection handle' })).toBeTruthy();
  });

  it('shows the settings written as custom properties', async () => {
    await renderSettled(<KitSettingsDemo />);
    expect(document.querySelector('pre')?.textContent).toContain('--wzl-kit-tree-typeahead-ms: 500ms;');
  });

  it('snaps a specimen drag to the other rect within the Snap reach setting', async () => {
    await renderSettled(<KitSettingsDemo />);
    dragPurple();
    expect(purpleX()).toBeCloseTo(120, 9);
  });

  it('drops the drag where it was let go once Snap reach is below the miss', async () => {
    await renderSettled(<KitSettingsDemo />);
    const reach = screen.getByRole('spinbutton', { name: 'Snap reach' });
    await userEvent.clear(reach);
    await userEvent.type(reach, '2{Enter}');
    dragPurple();
    expect(purpleX()).toBeCloseTo(123, 9);
  });
});

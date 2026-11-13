// A window's content click and its drag part where the dispatcher parts them: at the `gestures.dragPx` kit setting.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWindow } from './window';
import { mountHud, pointer, send, stubHudFonts, type GestureSettings } from '../../hudCanvas.fixture';

beforeEach(stubHudFonts);

/** A window without a titlebar over (10, 10)–(170, 130), pressed in its content and released `travel` px right. */
async function pressAndRelease(travel: number, gestures?: GestureSettings) {
  const onContentClick = vi.fn();
  const win = createWindow({ id: 'w', x: 10, y: 10, w: 160, h: 120, title: 'W', titlebar: false, onContentClick });
  const canvas = await mountHud(win, gestures);
  send(canvas, pointer('pointerdown', 'mouse', 80, 70));
  send(canvas, pointer('pointermove', 'mouse', 80 + travel, 70));
  send(canvas, pointer('pointerup', 'mouse', 80 + travel, 70));
  return { onContentClick, win };
}

describe('window content click through the dispatcher', () => {
  it('a press that travels under the kit setting clicks, and leaves the window put', async () => {
    const { onContentClick, win } = await pressAndRelease(5, { dragPx: 8 });
    expect(onContentClick).toHaveBeenCalledTimes(1);
    expect(win.bounds.x).toBe(10);
  });

  it('a press that travels past the kit setting drags, and does not click', async () => {
    const { onContentClick, win } = await pressAndRelease(3, { dragPx: 2 });
    expect(onContentClick).not.toHaveBeenCalled();
    expect(win.bounds.x).toBe(13);
  });
});

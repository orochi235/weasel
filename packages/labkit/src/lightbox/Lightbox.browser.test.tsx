import '@weasel-js/theme/tokens.css';
import '../styles.less';
import './Lightbox.browser.test.less';
import { cleanup, render } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Workspace } from '../lab/Workspace';

// The top layer, its escape from a transformed and clipping ancestor, and what
// a ResizeObserver reports are all layout — only a real browser has them.

afterEach(cleanup);

interface Probe {
  mounts: number;
  sizes: Array<{ w: number; h: number }>;
  gl: WebGLRenderingContext | null;
}

/** Stands in for a consumer's expensive tile: a WebGL context it creates once,
 *  sized from a ResizeObserver. */
function GlTile({ probe }: { probe: Probe }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    probe.mounts += 1;
    probe.gl = canvas.getContext('webgl');
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      probe.sizes.push({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [probe]);
  return <canvas ref={ref} className="lk-lightbox-test-canvas" data-testid="gl" />;
}

function mount(probe: Probe) {
  return render(
    <div className="lk-lightbox-test-host">
      <Workspace ids={['gl', 'plain']} expandOnDoubleClick={(id) => id === 'gl'}>
        <GlTile probe={probe} />
        <div>plain</div>
      </Workspace>
    </div>,
  );
}

test('a double-clicked tile fills the window from the top layer, on the same element and context', async () => {
  const probe: Probe = { mounts: 0, sizes: [], gl: null };
  const { getByTestId } = mount(probe);
  await expect.poll(() => probe.sizes.length).toBeGreaterThan(0);
  const canvas = getByTestId('gl') as HTMLCanvasElement;
  const before = canvas.getBoundingClientRect();
  const gl = probe.gl;
  expect(gl).not.toBeNull();

  await userEvent.dblClick(canvas);

  const box = canvas.closest('.lk-lightbox') as HTMLElement;
  expect(box.matches(':popover-open')).toBe(true);
  const after = canvas.getBoundingClientRect();
  // Most of the window, though the host is 480×320, clipped and transformed.
  expect(after.width).toBeGreaterThan(window.innerWidth * 0.9);
  expect(after.height).toBeGreaterThan(window.innerHeight * 0.8);
  expect(after.width).toBeGreaterThan(before.width);
  await expect.poll(() => probe.sizes.at(-1)?.w ?? 0).toBeCloseTo(after.width, 0);

  // Not remounted: the same element, the same live context, one mount.
  expect(getByTestId('gl')).toBe(canvas);
  expect(canvas.getContext('webgl')).toBe(gl);
  expect(gl?.isContextLost()).toBe(false);
  expect(probe.mounts).toBe(1);
});

test('a click in the dimmed margin closes it, and the tile goes back to its rect', async () => {
  const probe: Probe = { mounts: 0, sizes: [], gl: null };
  const { getByTestId } = mount(probe);
  await expect.poll(() => probe.sizes.length).toBeGreaterThan(0);
  const canvas = getByTestId('gl');
  const before = canvas.getBoundingClientRect();
  await userEvent.dblClick(canvas);
  const box = canvas.closest('.lk-lightbox') as HTMLElement;

  // The margin hit-tests to the lifted element itself, nothing behind it.
  expect(document.elementFromPoint(4, 4)).toBe(box);
  await userEvent.click(box, { position: { x: 4, y: 4 } });

  expect(box.matches(':popover-open')).toBe(false);
  expect(box.hasAttribute('popover')).toBe(false);
  const back = canvas.getBoundingClientRect();
  expect(back.width).toBeCloseTo(before.width, 0);
  expect(back.left).toBeCloseTo(before.left, 0);
  expect(probe.mounts).toBe(1);
});

test('Escape closes it and focus returns to the expand button that opened it', async () => {
  const probe: Probe = { mounts: 0, sizes: [], gl: null };
  const { getByTestId, getAllByRole } = mount(probe);
  await expect.poll(() => probe.sizes.length).toBeGreaterThan(0);
  const box = getByTestId('gl').closest('.lk-lightbox') as HTMLElement;
  const expand = getAllByRole('button', { name: 'Expand' })[0] as HTMLElement;

  await userEvent.click(expand);
  expect(box.matches(':popover-open')).toBe(true);
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Close expanded view');

  await userEvent.keyboard('{Escape}');
  expect(box.matches(':popover-open')).toBe(false);
  expect(document.activeElement).toBe(expand);
});

import '@weasel-js/theme/tokens.css';
import { useState, type ReactNode } from 'react';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup } from '@weasel-js/prefs';
import { OverlayPortalProvider } from '../../overlays/portalHost';
import { PrefsDialog } from './PrefsDialog';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      description: 'Drawing surface behavior.',
      children: {
        showGrid: { kind: 'boolean', name: 'Show grid', description: 'Draw the alignment grid.', default: true },
        zoomStep: { kind: 'number', name: 'Zoom step', description: 'Wheel zoom increment (%).', default: 10, min: 1, max: 50 },
        opacity: { kind: 'number', name: 'Default opacity', description: 'Fill opacity for new shapes.', default: 80, min: 0, max: 100, control: 'slider' },
        snapping: {
          name: 'Snapping',
          children: {
            tolerance: { kind: 'number', name: 'Tolerance', description: 'Snap distance in px.', default: 6, min: 1, max: 24, control: 'slider' },
          },
        },
      },
    },
    editing: {
      name: 'Editing',
      children: {
        autosave: { kind: 'boolean', name: 'Autosave', description: 'Write to storage as you draw.', default: true },
      },
    },
  },
};

const dialog = (
  <PrefsDialog isOpen onOpenChange={() => {}} schema={SCHEMA} values={{}} onChange={() => {}} layout="rail" filterable />
);

/** A box narrower than the window standing in for the viewport, the way a workshop trial holds a story. */
function Contained({ width, children }: { width: number; children: ReactNode }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setBox} style={{ position: 'relative', width, height: 600 }}>
      {box ? <OverlayPortalProvider container={box} contained>{children}</OverlayPortalProvider> : null}
    </div>
  );
}

async function expectFieldsInBox(room: number) {
  await document.fonts.ready;
  const modal = screen.getByRole('dialog').parentElement!;
  const box = modal.getBoundingClientRect();
  expect(box.width).toBeLessThanOrEqual(room);

  const pane = screen.getByRole('heading', { level: 3, name: 'Canvas' }).parentElement!.parentElement!;
  expect(pane.getBoundingClientRect().right).toBeLessThanOrEqual(box.right);
  expect(pane.scrollWidth).toBeLessThanOrEqual(pane.clientWidth);

  const fields = [...pane.querySelectorAll('[data-pref-path] :is(input, [role="slider"])')];
  expect(fields.length).toBeGreaterThan(0);
  for (const el of fields) expect(el.getBoundingClientRect().right).toBeLessThanOrEqual(box.right);
}

test('in a narrow window, the box fits it and the pane gives way so every field stays in the box', async () => {
  await page.viewport(480, 700);
  renderWithIcons(dialog);
  await expectFieldsInBox(480);
});

test('in a contained portal narrower than the window, the box fits the portal and not the window', async () => {
  await page.viewport(1200, 700);
  renderWithIcons(<Contained width={520}>{dialog}</Contained>);
  await expectFieldsInBox(520);
});

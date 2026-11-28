import { afterEach, describe, expect, it } from 'vitest';
import { inModalOver } from './modal';

afterEach(() => { document.body.replaceChildren(); });

/** `body > [page] + [dialog > button]`, the page holding a canvas: how a portaled modal sits. */
function page(pageAttrs: Record<string, string>): { canvas: HTMLCanvasElement; button: HTMLButtonElement; dialog: HTMLElement } {
  const root = document.createElement('div');
  for (const [k, v] of Object.entries(pageAttrs)) root.setAttribute(k, v);
  const canvas = document.createElement('canvas');
  root.append(canvas);
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  const button = document.createElement('button');
  dialog.append(button);
  document.body.append(root, dialog);
  return { canvas, button, dialog };
}

describe('inModalOver for a dialog that hides the page instead of setting aria-modal', () => {
  it.each(['aria-hidden', 'inert'])('counts as modal with no canvas when the page outside the dialog is %s', (attr) => {
    const { button } = page({ [attr]: attr === 'inert' ? '' : 'true' });
    expect(inModalOver(button, null)).toBe(true);
  });

  it('is not modal with no canvas when the page outside the dialog is visible', () => {
    const { button } = page({});
    expect(inModalOver(button, null)).toBe(false);
  });

  it('is not modal when only a wrapper deep inside the page hides the canvas', () => {
    const { canvas, button } = page({});
    const wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    canvas.replaceWith(wrap);
    wrap.append(canvas);
    expect(inModalOver(button, canvas)).toBe(false);
  });

  it('counts as modal when the hidden element holding the canvas sits beside the dialog', () => {
    const { canvas, button } = page({ 'aria-hidden': 'true' });
    expect(inModalOver(button, canvas)).toBe(true);
  });
});

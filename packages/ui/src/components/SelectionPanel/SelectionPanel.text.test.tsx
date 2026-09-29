import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  createScene,
  asNodeId,
  inferredNodeProperties,
  inferredNodeRouting,
  type SelectionApi,
} from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';

// The kit's own text schema, as apps/draw mounts it — not a fixture standing
// in for it — so a regression in either the schema or the panel shows here.

interface TextData { text: string; style?: Record<string, unknown>; verticalAlign?: string }
interface Pose { x: number; y: number; width: number; height: number }

function renderText(...styles: (Record<string, unknown> | undefined)[]) {
  const scene = createScene<TextData, 'default', Pose>({ systemLayers: [{ id: 'default' }] });
  const ids = styles.map((_, i) => `t${i}`);
  styles.forEach((style, i) => {
    scene.add({
      id: asNodeId(ids[i]),
      kind: 'leaf',
      layer: 'default',
      pose: { x: 0, y: 0, width: 100, height: 40 },
      data: { text: 'hi', ...(style ? { style } : {}) },
    });
  });
  render(
    <SelectionPanel
      scene={scene}
      selection={{ current: ids } as unknown as SelectionApi}
      properties={inferredNodeProperties}
      routing={inferredNodeRouting}
    />,
  );
  const styleOf = (i: number) => (scene.get(asNodeId(ids[i])) as { data: TextData }).data.style;
  const dataOf = (i: number) => (scene.get(asNodeId(ids[i])) as { data: TextData }).data;
  return { scene, styleOf, dataOf };
}

const button = (name: string) => screen.getByRole('button', { name });
/** The one-of-several bar holding an option of this name — several bars share
 *  option names ("Center" is also a stroke alignment), so an option is found by
 *  its bar. */
const barWith = (option: string) =>
  screen.getAllByRole('radiogroup').find((g) => within(g).queryByRole('radio', { name: option }))!;

describe('SelectionPanel — the text style', () => {
  it('puts italic, the decorations and the scripts in one row of glyph segments', () => {
    renderText({});
    const row = button('Italic').closest('[class*="row"]')!;
    const names = within(row as HTMLElement).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Italic', 'Underline', 'Strikethrough', 'Overline', 'Superscript', 'Subscript']);
    for (const name of names) {
      expect(button(name!).querySelector('svg')).not.toBeNull();
    }
    // Italic is a segment now, not a dropdown.
    expect(screen.queryByRole('button', { name: /^Style/ })).toBeNull();
  });

  it('reads italic off fontStyle and writes it back there', () => {
    const { styleOf } = renderText({ fontStyle: 'italic', fontSize: 20 });
    expect(button('Italic')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button('Italic'));
    // Off is the absence of a slant, not a stored 'normal'.
    expect(styleOf(0)).toEqual({ fontSize: 20 });
    fireEvent.click(button('Italic'));
    expect(styleOf(0)).toEqual({ fontSize: 20, fontStyle: 'italic' });
  });

  it('sets a script, swaps it for the other, and clears it on a second click', () => {
    const { styleOf } = renderText({});
    fireEvent.click(button('Superscript'));
    expect(styleOf(0)).toEqual({ script: 'super' });
    expect(button('Superscript')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button('Subscript'));
    expect(styleOf(0)).toEqual({ script: 'sub' });
    fireEvent.click(button('Subscript'));
    expect(styleOf(0)).toEqual({});
  });

  it('draws the alignments as glyph segments and writes the one chosen', () => {
    const { styleOf } = renderText({ align: 'center' });
    const bar = barWith('Left');
    const segs = within(bar).getAllByRole('radio');
    expect(segs.map((b) => b.getAttribute('aria-label'))).toEqual(['Left', 'Center', 'Right', 'Justify']);
    expect(segs.every((b) => b.querySelector('svg') !== null)).toBe(true);
    expect(within(bar).getByRole('radio', { name: 'Center' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(bar).getByRole('radio', { name: 'Right' }));
    expect(styleOf(0)).toEqual({ align: 'right' });
  });

  it('lights the edge a reading-order alignment paints at', () => {
    renderText({ align: 'end', direction: 'rtl' });
    expect(within(barWith('Left')).getByRole('radio', { name: 'Left' })).toHaveAttribute('aria-checked', 'true');
  });

  it('offers the vertical alignment the painter reads off the node data', () => {
    const { dataOf } = renderText({});
    const bar = barWith('Middle');
    expect(within(bar).getAllByRole('radio').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Top',
      'Middle',
      'Bottom',
    ]);
    fireEvent.click(within(bar).getByRole('radio', { name: 'Middle' }));
    expect(dataOf(0).verticalAlign).toBe('center');
  });

  it('offers wrapping and reading direction', () => {
    const { styleOf } = renderText({});
    fireEvent.click(screen.getByRole('switch', { name: 'Wrap' }));
    expect(styleOf(0)).toEqual({ wrap: true });
    fireEvent.click(within(barWith('Right to left')).getByRole('radio', { name: 'Right to left' }));
    expect(styleOf(0)).toEqual({ wrap: true, direction: 'rtl' });
  });

  describe('across a multi-selection', () => {
    it('reports each field by itself, not the whole style as mixed', () => {
      renderText({ fontSize: 12, underline: true }, { fontSize: 30 });
      // Neither node is italic: agreeing on absence is not a disagreement.
      expect(button('Italic')).toHaveAttribute('aria-pressed', 'false');
      expect(button('Underline')).toHaveAttribute('aria-pressed', 'mixed');
      expect(button('Superscript')).toHaveAttribute('aria-pressed', 'false');
    });

    // Different stored values, one reading: both are upright.
    it('reads an encoded flag per node, not off the stored values', () => {
      renderText({ fontStyle: 'normal', fontSize: 12 }, { fontSize: 30 });
      expect(button('Italic')).toHaveAttribute('aria-pressed', 'false');
    });

    it('marks both scripts mixed when the nodes disagree on one', () => {
      renderText({ script: 'super' }, {});
      expect(button('Superscript')).toHaveAttribute('aria-pressed', 'mixed');
      expect(button('Subscript')).toHaveAttribute('aria-pressed', 'mixed');
    });

    it('writes one field into each node, keeping everything else each one holds', () => {
      const { styleOf } = renderText({ fontSize: 12, underline: true }, { fontSize: 30 }, undefined);
      fireEvent.click(button('Italic'));
      expect(styleOf(0)).toEqual({ fontSize: 12, underline: true, fontStyle: 'italic' });
      expect(styleOf(1)).toEqual({ fontSize: 30, fontStyle: 'italic' });
      // A node holding no style gets one materialized from the default.
      expect(styleOf(2)).toEqual({ fontStyle: 'italic' });
    });

    it('turns a mixed flag on everywhere, leaving the other flags per node', () => {
      const { styleOf } = renderText({ underline: true, overline: true }, {});
      fireEvent.click(button('Underline'));
      expect(styleOf(0)).toEqual({ underline: true, overline: true });
      expect(styleOf(1)).toEqual({ underline: true });
    });
  });
});

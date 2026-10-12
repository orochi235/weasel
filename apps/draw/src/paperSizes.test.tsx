import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseSvg } from '@weasel-js/svg';
import { CommandBar } from './CommandBar';
import { loadDoc, DOC_KEY } from './docPersistence';
import { isPaperSize, PAPER_OPTIONS, PAPER_PRESETS, PAPER_SIZES } from './paperSizes';
import { parsedToDoc, SWILL_NAMESPACES } from './svgInterop';

describe('paper sizes', () => {
  it('labels the New menu from the table the document properties read', () => {
    render(<CommandBar onSaveSvg={vi.fn()} onOpenSvg={vi.fn()} onNew={vi.fn()} />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: /New/ })); });
    const menu = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(menu).toEqual(PAPER_SIZES.map((s) => s.label));
    expect(PAPER_OPTIONS.map((o) => o.label)).toEqual(menu);
  });

  it('holds the dimensions under each key', () => {
    expect(PAPER_PRESETS.a4).toEqual({ width: 794, height: 1123 });
    expect(isPaperSize('legal')).toBe(true);
    expect(isPaperSize('tabloid')).toBe(false);
  });

  it.each(PAPER_SIZES.map((s) => s.key))('reads %s back from a saved document and an SVG', (key) => {
    localStorage.setItem(DOC_KEY, JSON.stringify({ paperSize: key }));
    expect(loadDoc().paperSize).toBe(key);
    localStorage.removeItem(DOC_KEY);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:wd="${SWILL_NAMESPACES.wd}" wd:paperSize="${key}"/>`;
    expect(parsedToDoc(parseSvg(svg, { namespaces: SWILL_NAMESPACES })).paperSize).toBe(key);
  });
});

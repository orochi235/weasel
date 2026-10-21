import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionsProvider, createScene } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { parseSvg } from '@weasel-js/svg';
import { Bar } from '@weasel-js/ui/components/Bar';
import { loadDoc, DOC_KEY } from './docPersistence';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { FILE_NEW_MENU, useFileCommands } from './fileCommands';
import { isPaperSize, PAPER_OPTIONS, PAPER_PRESETS, PAPER_SIZES } from './paperSizes';
import { parsedToDoc, SWILL_NAMESPACES } from './svgInterop';

const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });

function FileCommands() {
  useFileCommands({
    scene, filename: '', paperSize: 'letter', backgroundColor: '#ffffff',
    setFilename: vi.fn(), setPaperSize: vi.fn(), setBackgroundColor: vi.fn(),
  });
  return null;
}

const NEW_BAR = pref.group('', { new: FILE_NEW_MENU }, { as: 'bar' });

describe('paper sizes', () => {
  it('labels the New menu from the table the document properties read', () => {
    render(<ActionsProvider><FileCommands /><Bar schema={NEW_BAR} /></ActionsProvider>);
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

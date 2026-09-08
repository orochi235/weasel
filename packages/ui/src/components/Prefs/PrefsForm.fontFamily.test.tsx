/**
 * The `font-family` arm. Its own file because the registry has to be stubbed:
 * `registerFont` needs a `fetch` + `createImageBitmap` pair to bake an atlas,
 * and none of that exercises what the form decides.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrefsForm } from './PrefsForm';
import type { PrefGroup } from './schema';

const listFonts = vi.fn();
const listCanvasFonts = vi.fn();
const resolveFontVariant = vi.fn();

vi.mock('@weasel-js/font', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listFonts: () => listFonts(),
  listCanvasFonts: () => listCanvasFonts(),
  resolveFontVariant: (...args: unknown[]) => resolveFontVariant(...args),
}));

const FLAT_SCHEMA: PrefGroup = {
  name: 'root',
  children: {
    text: {
      name: 'Text',
      children: {
        fontFamily: {
          // No description: the help affordance it would add is another
          // button whose name ends in "Font".
          kind: 'font-family',
          name: 'Font',
          description: '',
          default: 'sans-serif',
        },
      },
    },
  },
};

/** The shape core's text schema uses: the family is a field of the `TextStyle`
 *  object leaf, beside the weight and style the substitution probe reads. */
const STYLE_SCHEMA: PrefGroup = {
  name: 'root',
  children: {
    text: {
      name: 'Text',
      children: {
        style: {
          kind: 'object',
          name: 'Style',
          description: '',
          default: {},
          children: {
            fontFamily: { kind: 'font-family', name: 'Font', description: '', default: 'sans-serif' },
            fontWeight: { kind: 'number', name: 'Weight', description: '', default: 400 },
            fontStyle: {
              kind: 'enum',
              name: 'Slant',
              description: '',
              default: 'normal',
              options: [
                { value: 'normal', label: 'Normal' },
                { value: 'italic', label: 'Italic' },
              ],
            },
          },
        },
      },
    },
  },
};

beforeEach(() => {
  listFonts.mockReset();
  listFonts.mockReturnValue([
    { family: 'sans-serif', variants: [] },
    { family: 'serif', variants: [] },
  ]);
  listCanvasFonts.mockReset();
  listCanvasFonts.mockReturnValue([]);
  resolveFontVariant.mockReset();
  resolveFontVariant.mockReturnValue({ substituted: undefined });
});

describe('PrefsForm — font-family leaf', () => {
  it('renders a real font control with no renderers supplied', () => {
    render(
      <PrefsForm schema={FLAT_SCHEMA} values={{ text: { fontFamily: 'serif' } }} onChange={() => {}} />,
    );
    expect(screen.queryByText('(font-family: no renderer)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Font/ })).toHaveTextContent('serif');
  });

  it('offers the registry and reports the chosen family', () => {
    const onChange = vi.fn();
    render(
      <PrefsForm schema={FLAT_SCHEMA} values={{ text: { fontFamily: 'serif' } }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Font/ }));
    fireEvent.click(screen.getByRole('option', { name: 'sans-serif' }));
    expect(onChange).toHaveBeenCalledWith('text.fontFamily', 'sans-serif');
  });

  it('keeps an unregistered family visible and names what paints instead', () => {
    resolveFontVariant.mockReturnValue({ substituted: { resolved: 'serif' } });
    render(
      <PrefsForm schema={FLAT_SCHEMA} values={{ text: { fontFamily: 'Gilamesh' } }} onChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /Font/ }))
      .toHaveTextContent('Gilamesh — not loaded, showing serif');
  });

  it('probes at the weight and slant its sibling fields hold', () => {
    render(
      <PrefsForm
        schema={STYLE_SCHEMA}
        values={{ text: { style: { fontFamily: 'Gilamesh', fontWeight: 700, fontStyle: 'italic' } } }}
        onChange={() => {}}
      />,
    );
    expect(resolveFontVariant).toHaveBeenCalledWith('Gilamesh', 700, 'italic');
  });

  it('commits a family inside an object leaf by writing the whole object', () => {
    const onChange = vi.fn();
    render(
      <PrefsForm
        schema={STYLE_SCHEMA}
        values={{ text: { style: { fontFamily: 'serif', fontWeight: 700 } } }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Font/ }));
    fireEvent.click(screen.getByRole('option', { name: 'sans-serif' }));
    expect(onChange).toHaveBeenCalledWith('text.style', {
      fontFamily: 'sans-serif',
      fontWeight: 700,
    });
  });
});

import { screen } from '@testing-library/react';
import { type Motif, stereo, tab } from '@weasel-js/ui/components/MotifFrame';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const frameOf = (name: string): HTMLElement => screen.getByRole('group', { name });

describe('motif option', () => {
  it('resolves a group motif by path and a section motif onto its spec', () => {
    const motif = stereo();
    const resolved = resolveConfigSchema(
      f.schema({
        fade: f.group({ rise: f.number(1) }).motif(motif),
        plain: f.group({ fall: f.number(1) }),
        a: f.number(1).section('Look', { motif }),
        b: f.number(1).section('Feel'),
      }),
    );
    expect(resolved.motifs?.get('fade')).toBe(motif);
    expect(resolved.motifs?.has('plain')).toBe(false);
    expect(resolved.sections.find((s) => s.label === 'Look')?.motif).toBe(motif);
    expect(resolved.sections.find((s) => s.label === 'Feel')?.motif).toBeUndefined();
  });

  it('takes a section motif from whichever node names it', () => {
    const motif = tab();
    const resolved = resolveConfigSchema(
      f.schema({ a: f.number(1).section('Look'), b: f.number(1).section('Look', { motif }) }),
    );
    expect(resolved.sections[0]?.motif).toBe(motif);
  });
});

describe('<ControlPanel> motif', () => {
  const schema = f.schema({
    fade: f
      .group({ rise: f.number(1) })
      .label('Fade')
      .motif(stereo()),
    hold: f.group({ time: f.number(1) }).label('Hold'),
    notes: f.group({ shout: f.number(1) }).label('Notes').as('section').motif(stereo()),
    aside: f.group({ hush: f.number(1) }).label('Aside').as('section'),
    a: f.number(1).section('Look', { motif: stereo() }),
    b: f.number(1).section('Feel'),
  });
  const draw = (motif?: Motif) =>
    renderWithIcons(
      <ControlPanel
        schema={resolveConfigSchema(schema)}
        config={schema.defaults() as Record<string, unknown>}
        setConfig={vi.fn()}
        motif={motif}
      />,
    );

  it('draws a group and a section in the motif they name', () => {
    draw();
    expect(frameOf('Fade')).toHaveAttribute('data-motif', 'stereo');
    expect(frameOf('Look')).toHaveAttribute('data-motif', 'stereo');
  });

  it('keeps the default frame where no motif is set', () => {
    draw();
    expect(frameOf('Hold')).toHaveAttribute('data-motif', 'rule');
    expect(frameOf('Feel')).toHaveAttribute('data-motif', 'rule');
  });

  it("draws every unset group and section in the panel's motif", () => {
    draw(tab());
    expect(frameOf('Hold')).toHaveAttribute('data-motif', 'tab');
    expect(frameOf('Feel')).toHaveAttribute('data-motif', 'tab');
    expect(frameOf('Fade')).toHaveAttribute('data-motif', 'stereo');
  });

  it('draws an `as: section` group in the motif it names, and in a divider otherwise', () => {
    // The panel's motif is for framed groups; it leaves a section group frameless.
    draw(tab());
    expect(frameOf('Notes')).toHaveAttribute('data-motif', 'stereo');
    expect(frameOf('Aside')).toHaveAttribute('data-motif', 'divider');
  });
});

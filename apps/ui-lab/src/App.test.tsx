import './labTestSetup';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { Lab } from '@weasel-js/labkit';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it } from 'vitest';
import { ComposeInstrument } from './badge/compose/ComposeInstrument';
import { OctantsInstrument } from './badge/octants/OctantsInstrument';
import { ShapesInstrument } from './badge/shapes/ShapesInstrument';

afterEach(cleanup);

const COMPOSE = [ComposeInstrument];
const SHAPES = [ShapesInstrument];
const OCTANTS = [OctantsInstrument];

const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const cards = () => screen.queryAllByRole('textbox', { name: /^Name of card/ });

describe('the compose lab', () => {
  it('adds an effect from the panel, and Undo takes it back as one step', async () => {
    await renderSettled(<Lab instruments={COMPOSE} />, { wrapper: withIcons });
    expect(cards()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Add effect/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Shadow' }));
    expect(cards().map((c) => (c as HTMLInputElement).value)).toEqual(['Shadow']);
    press('Undo');
    expect(cards()).toHaveLength(0);
    press('Redo');
    expect(cards()).toHaveLength(1);
  });

  it('loads a preset, base and effects together, as one undo step', async () => {
    await renderSettled(<Lab instruments={COMPOSE} />, { wrapper: withIcons });
    press('Load rough');
    expect(cards().map((c) => (c as HTMLInputElement).value)).toEqual(['Bites', 'Spikes']);
    press('Undo');
    expect(cards()).toHaveLength(0);
  });
});

describe('the shapes lab', () => {
  it("shows the pressed shape's params on the panel", async () => {
    await renderSettled(<Lab instruments={SHAPES} />, { wrapper: withIcons });
    press('Edit hexagon');
    expect(screen.getByRole('button', { name: 'Edit hexagon' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(/^Tip height$/i).length).toBeGreaterThan(0);
  });
});

describe('the octants lab', () => {
  it('draws a sweep for each quatrefoil param', async () => {
    await renderSettled(<Lab instruments={OCTANTS} />, { wrapper: withIcons });
    const sweep = screen.getByRole('heading', { name: 'valleyAt' }).closest('section')!;
    expect(within(sweep).getAllByText(/^valleyAt = /)).toHaveLength(5);
  });
});

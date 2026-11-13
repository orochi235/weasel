import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { addStage, IMAGE_STAGE_TYPES, stageFromType, type EffectDoc } from '@weasel-js/diagram/effect';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { chartPrefs } from '../prefs';
import { withIcons } from '../testIcons';
import { PIPELINE_STORAGE_KEY } from './usePipelineDoc';

const picked = vi.hoisted(() => ({ text: '' }));

vi.mock('@weasel-js/editor', async (importOriginal) => ({
  ...await importOriginal<typeof import('@weasel-js/editor')>(),
  pickFile: async () => ({ name: 'other.weaselpipeline.json', text: async () => picked.text }),
}));

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}) },
  );
});
afterEach(() => {
  cleanup();
  chartPrefs().reset();
  localStorage.clear();
});

function choose(menu: string, row: string): void {
  act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: menu })); });
  const open = screen.getAllByRole('menu').at(-1)!;
  const item = [...open.querySelectorAll<HTMLElement>('[role^="menuitem"]')].find((el) => el.textContent?.startsWith(row));
  act(() => { fireEvent.click(item!); });
}

const params = () => screen.getByRole('complementary', { name: 'Params' });

describe('replacing the pipeline', () => {
  it('drops the picked stage on Open, though the opened pipeline has a stage of the same id', async () => {
    render(<App />, { wrapper: withIcons });
    choose('Mode', 'Pipeline');
    act(() => { fireEvent.click(screen.getByRole('row', { name: 'Blur' })); });
    await vi.waitFor(() => expect(localStorage.getItem(PIPELINE_STORAGE_KEY)).toContain('stages'));
    const [stage] = (JSON.parse(localStorage.getItem(PIPELINE_STORAGE_KEY)!) as EffectDoc).pipeline.stages;
    expect(within(params()).queryByText('Select a stage to edit its params.')).toBeNull();
    const composite = IMAGE_STAGE_TYPES.find((t) => t.type === 'composite')!;
    const other = addStage({ pipeline: { stages: [], wires: [] }, places: {} }, stageFromType(composite, stage!.id));
    picked.text = JSON.stringify(other);
    choose('File', 'Open…');
    await vi.waitFor(() => expect(localStorage.getItem(PIPELINE_STORAGE_KEY)).toContain('composite'));
    expect(within(params()).getByText('Select a stage to edit its params.')).toBeTruthy();
  });
});

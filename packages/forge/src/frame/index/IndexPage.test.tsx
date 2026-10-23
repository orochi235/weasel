import { fireEvent, render, screen, within } from '@testing-library/react';
import { f } from '@weasel-js/labkit/config';
import { describe, expect, it, vi } from 'vitest';
import { meta, story } from '../../story/define';
import { loadNativeModule } from '../../story/native';
import type { ComponentDeps } from '../../story/types';
import { type IndexEnv, IndexPage } from './IndexPage';

const stories = loadNativeModule(
  { default: meta({ title: 'ui/Dialog' }), Basic: story({ render: () => <p>dialog</p> }) },
  'ui/Dialog',
);

const envOf = (over: Partial<IndexEnv> = {}): IndexEnv => ({
  title: 'ui/Dialog',
  stories,
  descriptions: {},
  globals: {},
  decorators: [],
  open: vi.fn(),
  onError: vi.fn(),
  ...over,
});

const DEPS: ComponentDeps = { source: 'ui/Dialog/Dialog.tsx', uses: ['ui/Badge', 'ui/Foundations/Button'], usedBy: [] };

describe('IndexPage', () => {
  it('says when the component was created and last changed, each with the release that shipped it', () => {
    const history = {
      created: '2026-06-01T10:00:00Z',
      modified: '2026-10-01T10:00:00Z',
      introduced: '0.4.0',
      modifiedIn: '0.5.0',
    };
    const { rerender } = render(<IndexPage env={envOf({ dependencies: { ...DEPS, history } })} render={null} />);
    const list = screen.getByLabelText('History');
    expect(within(list).queryByText('Since')).toBeNull();
    const value = (label: string) => within(list).getByText(label).nextElementSibling;
    expect(value('Created')).toHaveTextContent(/^Jun 1, 2026 \(0\.4\.0\)$/);
    expect(value('Modified')).toHaveTextContent(/^Oct 1, 2026 \(0\.5\.0\)$/);
    expect([...list.querySelectorAll('time')].map((time) => time.dateTime)).toEqual([history.created, history.modified]);

    rerender(
      <IndexPage env={envOf({ dependencies: { ...DEPS, history: { ...history, modifiedIn: null } } })} render={null} />,
    );
    expect(within(screen.getByLabelText('History')).getByText('Modified').nextElementSibling).toHaveTextContent(
      /\(unreleased\)$/,
    );

    rerender(<IndexPage env={envOf({ dependencies: DEPS })} render={null} />);
    expect(screen.queryByLabelText('History')).toBeNull();
  });

  it('lists what the component uses and what uses it, each linking to that component’s index page', () => {
    const env = envOf({ dependencies: { ...DEPS, usedBy: ['draw/CommandBar'] } });
    render(<IndexPage env={env} render={null} />);
    const uses = screen.getByRole('list', { name: 'Uses' });
    const links = within(uses).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['ui/Badge', 'ui/Foundations/Button']);
    expect(links[1]?.getAttribute('href')).toBe('#/ui-foundations-button%3Aindex');
    fireEvent.click(links[1] as HTMLElement);
    expect(env.open).toHaveBeenCalledWith('ui-foundations-button:index');
    const usedBy = screen.getByRole('list', { name: 'Used by' });
    expect(within(usedBy).getByRole('link').textContent).toBe('draw/CommandBar');
  });

  it('links each story’s title to the story, with no separate button', () => {
    const env = envOf();
    render(<IndexPage env={env} render={null} />);
    const section = screen.getByRole('region', { name: 'Basic' });
    const link = within(within(section).getByRole('heading', { name: 'Basic' })).getByRole('link', { name: 'Basic' });
    expect(link.getAttribute('href')).toBe('#/ui-dialog--basic');
    expect(within(section).queryByRole('button')).toBeNull();
    fireEvent.click(link, { metaKey: true });
    expect(env.open).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(env.open).toHaveBeenCalledWith('ui-dialog--basic');
  });

  it('draws the component’s and each story’s description as inline markdown', () => {
    render(
      <IndexPage
        env={envOf({ description: 'A *modal* surface.', descriptions: { 'ui-dialog--basic': 'Opens on `open`.' } })}
        render={null}
      />,
    );
    expect(document.querySelector('.fg-index__description em')?.textContent).toBe('modal');
    const section = screen.getByRole('region', { name: 'Basic' });
    expect(section.querySelector('.fg-index-story__description code')?.textContent).toBe('open');
  });

  it('says when a list is empty', () => {
    render(<IndexPage env={envOf({ dependencies: DEPS })} render={null} />);
    expect(screen.getByText('No listed component uses it.')).toBeTruthy();
  });

  it('says why a component with no source file lists nothing', () => {
    render(<IndexPage env={envOf({ dependencies: { source: null, uses: [], usedBy: [] } })} render={null} />);
    expect(screen.getByText(/no source file/i)).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Uses' })).toBeNull();
  });

  it('labels a gallery and lists no dependencies on it', () => {
    render(<IndexPage env={envOf({ gallery: true, dependencies: DEPS })} render={null} />);
    expect(screen.getByText('Gallery')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Uses' })).toBeNull();
  });

  it('labels a story tagged as a gallery on its own', () => {
    render(<IndexPage env={envOf({ galleries: ['ui-dialog--basic'] })} render={null} />);
    const section = screen.getByRole('region', { name: 'Basic' });
    expect(within(section).getByText('Gallery')).toBeTruthy();
  });

  it('links a lab story and marks it, embedding no example and leaving the variants to the next story', () => {
    const config = f.schema({ dense: f.boolean(false) });
    const withLab = loadNativeModule(
      {
        default: meta({ title: 'ui/Arc' }),
        Screen: story({ config, render: () => <p>whole screen</p> }),
        Plain: story({ config, render: () => <p>specimen</p> }),
      },
      'ui/Arc',
    );
    const [lab, plain] = withLab;
    render(<IndexPage env={envOf({ title: 'ui/Arc', stories: withLab, labs: [lab?.id ?? ''] })} render={null} />);
    const labSection = screen.getByRole('region', { name: 'Screen' });
    expect(within(labSection).getByRole('link', { name: 'Screen' }).getAttribute('href')).toBe(`#/${lab?.id}`);
    expect(within(labSection).getByText('Lab')).toBeTruthy();
    expect(labSection.querySelector('.fg-index-cell')).toBeNull();
    expect(within(labSection).queryByRole('region', { name: 'Dense' })).toBeNull();
    const plainSection = screen.getByRole('region', { name: plain?.name ?? '' });
    expect(within(plainSection).queryByText('Lab')).toBeNull();
    expect(plainSection.querySelector('.fg-index-story__main > .fg-index-cell')).not.toBeNull();
    expect(within(plainSection).getByRole('region', { name: 'Dense' })).toBeTruthy();
  });

  it('heads the path with the package as a badge, in place of a first segment naming it', () => {
    const { container, rerender } = render(<IndexPage env={envOf({ title: 'ui/Properties/Field', library: 'ui' })} render={null} />);
    const path = container.querySelector('.fg-index__path') as HTMLElement;
    expect(path.querySelector('.fg-index__library')?.textContent).toBe('ui');
    expect(path.textContent).toBe('uiProperties');
    rerender(<IndexPage env={envOf({ title: 'Primitives/Input', library: 'ui' })} render={null} />);
    expect(container.querySelector('.fg-index__path')?.textContent).toBe('uiPrimitives');
    rerender(<IndexPage env={envOf({ title: 'labkit/Specimen', library: 'labkit' })} render={null} />);
    expect(container.querySelector('.fg-index__path')?.textContent).toBe('labkit');
  });

  it('shows no dependency section before the graph arrives', () => {
    render(<IndexPage env={envOf()} render={null} />);
    expect(screen.queryByRole('list', { name: 'Uses' })).toBeNull();
    expect(screen.queryByText(/no source file/i)).toBeNull();
  });
});

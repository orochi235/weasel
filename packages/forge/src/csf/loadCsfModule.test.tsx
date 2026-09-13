import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { LoadedStory, StoryContext } from '../story/types';
import { loadCsfModule } from './loadCsfModule';

const FILE = '/repo/packages/ui/src/Button.stories.tsx';
const ROOT = '/repo';

const ctxFor = (story: LoadedStory, patch: Partial<StoryContext> = {}): StoryContext => ({
  config: story.config.defaults(),
  setConfig: vi.fn(),
  state: null,
  setState: vi.fn(),
  globals: {},
  title: story.title,
  name: story.name,
  ...patch,
});

function RenderStory({ story, ctx }: { story: LoadedStory; ctx: StoryContext }): ReactNode {
  return story.render(ctx);
}

/** Mirrors the frame's StoryHost: `render`, then the story's decorators innermost first. */
function Harness({ story, ctx }: { story: LoadedStory; ctx: StoryContext }): ReactNode {
  let inner: () => ReactNode = () => <RenderStory story={story} ctx={ctx} />;
  for (const decorate of story.decorators) {
    const wrapped = inner;
    inner = () => decorate(wrapped, ctx);
  }
  return inner();
}

const show = (story: LoadedStory, ctx: StoryContext = ctxFor(story)) => render(<Harness story={story} ctx={ctx} />);

function Button({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  );
}

describe('loadCsfModule', () => {
  it('names and ids stories the way Storybook and the indexer do', () => {
    const stories = loadCsfModule(
      {
        default: { title: 'ui/Button', excludeStories: /^helper/ },
        Primary: {},
        Named: { name: 'A named one' },
        Legacy: { storyName: 'Old name' },
        helperData: {},
        notAStory: 42,
        __namedExportsOrder: ['Primary', 'Named', 'Legacy'],
      },
      FILE,
      ROOT,
    );
    expect(stories.map((s) => [s.id, s.name, s.exportName])).toEqual([
      ['ui-button--primary', 'Primary', 'Primary'],
      ['ui-button--named', 'A named one', 'Named'],
      ['ui-button--legacy', 'Old name', 'Legacy'],
    ]);
  });

  it('honors includeStories as a list', () => {
    const stories = loadCsfModule({ default: { title: 'ui/B', includeStories: ['Two'] }, One: {}, Two: {} }, FILE, ROOT);
    expect(stories.map((s) => s.exportName)).toEqual(['Two']);
  });

  it('titles a story from its path when the meta names none', () => {
    const [only] = loadCsfModule({ default: {}, A: {} }, FILE, ROOT);
    expect(only?.title).toBe('packages/ui/src/Button');
  });

  it('builds config from merged args and argTypes', () => {
    const [story] = loadCsfModule(
      {
        default: {
          title: 'ui/Slider',
          args: { min: 0, max: 1, constraint: 'free', onInput: () => {} },
          argTypes: { constraint: { control: 'inline-radio', options: ['free', 'ordered'] } },
        },
        Pair: { args: { constraint: 'ordered' }, argTypes: { max: { control: false } } },
      },
      FILE,
      ROOT,
    );
    expect(story?.config.defaults()).toEqual({ min: 0, max: 1, constraint: 'ordered' });
    expect(story?.config.nodes.max?.annotations).toEqual({ hidden: true });
    expect(story?.initialState).toBeNull();
  });

  it('renders with config merged over the args the schema omits', () => {
    const renderFn = vi.fn((args: Record<string, unknown>) => <p>{String(args.label)}</p>);
    const onClick = () => {};
    const [story] = loadCsfModule(
      { default: { title: 'ui/Button', args: { label: 'from args', onClick } }, Primary: { render: renderFn } },
      FILE,
      ROOT,
    );
    if (!story) throw new Error('no story');
    show(story, ctxFor(story, { config: { label: 'from config' }, globals: { theme: 'dark' } }));
    expect(screen.getByText('from config')).toBeInTheDocument();
    const [args, context] = renderFn.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>];
    expect(args).toEqual({ label: 'from config', onClick });
    expect(context).toMatchObject({
      args,
      globals: { theme: 'dark' },
      title: 'ui/Button',
      name: 'Primary',
      id: 'ui-button--primary',
      viewMode: 'story',
    });
  });

  it("renders the meta's component with args when neither story nor meta has a render", () => {
    const [story] = loadCsfModule({ default: { title: 'ui/Button', component: Button }, Primary: { args: { label: 'Go' } } }, FILE, ROOT);
    if (!story) throw new Error('no story');
    show(story);
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('renders nothing, without throwing, when there is no render and no component', () => {
    const [story] = loadCsfModule({ default: { title: 'ui/Empty' }, Bare: {} }, FILE, ROOT);
    if (!story) throw new Error('no story');
    const { container } = show(story);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a CSF 2 function export, reading its hoisted annotations', () => {
    const Hoisted = Object.assign((args: { label: string }) => <Button label={args.label} />, {
      storyName: 'Hoisted story',
      args: { label: 'Hoisted' },
    });
    const [story] = loadCsfModule({ default: { title: 'ui/Button' }, Hoisted }, FILE, ROOT);
    if (!story) throw new Error('no story');
    expect(story.name).toBe('Hoisted story');
    show(story);
    expect(screen.getByRole('button', { name: 'Hoisted' })).toBeInTheDocument();
  });

  it('nests decorators the way Storybook does', () => {
    // storybook 10.4.0 dist/_browser-chunks/chunk-SZQXB3JV.js:783-785 lists story, component, project decorators; :732 reduces so the first wraps innermost.
    const tag =
      (name: string) =>
      (Story: () => ReactNode): ReactNode => (
        <div data-testid={name}>
          <Story />
        </div>
      );
    const [story] = loadCsfModule(
      {
        default: { title: 'ui/Button', decorators: [tag('meta1'), tag('meta2')], render: () => <span>story</span> },
        Primary: { decorators: [tag('story1'), tag('story2')] },
      },
      FILE,
      ROOT,
    );
    if (!story) throw new Error('no story');
    show(story);
    const chain: string[] = [];
    for (let el = screen.getByText('story').parentElement; el?.dataset.testid; el = el.parentElement) {
      chain.push(el.dataset.testid);
    }
    expect(chain).toEqual(['story1', 'story2', 'meta1', 'meta2']);
  });

  it('gives a decorator the CSF context and a Story it may call directly', () => {
    const seen: unknown[] = [];
    const decorator = (Story: () => ReactNode, context: { args: unknown }) => {
      seen.push(context.args);
      return <section>{Story()}</section>;
    };
    const [story] = loadCsfModule(
      { default: { title: 'ui/Button', component: Button, args: { label: 'Hi' } }, Primary: { decorators: decorator } },
      FILE,
      ROOT,
    );
    if (!story) throw new Error('no story');
    show(story);
    expect(screen.getByRole('button', { name: 'Hi' }).parentElement?.tagName).toBe('SECTION');
    expect(seen[0]).toEqual({ label: 'Hi' });
  });

  it("keeps the story's component state across re-renders under a decorator", () => {
    const [story] = loadCsfModule(
      {
        default: {
          title: 'ui/Button',
          decorators: [(Story: () => ReactNode) => <main><Story /></main>],
          render: (args: { label: string }) => <Button label={args.label} />,
        },
        Primary: { args: { label: 'one' } },
      },
      FILE,
      ROOT,
    );
    if (!story) throw new Error('no story');
    const view = show(story);
    const before = screen.getByRole('button', { name: 'one' });
    view.rerender(<Harness story={story} ctx={ctxFor(story, { config: { label: 'two' } })} />);
    expect(screen.getByRole('button', { name: 'two' })).toBe(before);
  });

  it('resolves layout, preferring the story, defaulting to padded', () => {
    const stories = loadCsfModule(
      {
        default: { title: 'ui/L', parameters: { layout: 'fullscreen' } },
        FromMeta: {},
        FromStory: { parameters: { layout: 'centered' } },
      },
      FILE,
      ROOT,
    );
    expect(stories.map((s) => s.layout)).toEqual(['fullscreen', 'centered']);
    expect(loadCsfModule({ default: { title: 'ui/L' }, A: {} }, FILE, ROOT)[0]?.layout).toBe('padded');
  });

  it("resolves a LabFit-shaped viewport global against the meta's options", () => {
    const VIEWPORTS = {
      wide: { name: '1280x800', styles: { width: '1280px', height: '800px' } },
      narrow: { name: '400x700', styles: { width: '400px', height: '700px' } },
    };
    const stories = loadCsfModule(
      {
        default: { title: 'labkit/Lab/Fit', parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } } },
        FullscreenWide: { globals: { viewport: { value: 'wide', isRotated: false } } },
        Unknown: { globals: { viewport: { value: 'tablet' } } },
        None: {},
      },
      FILE,
      ROOT,
    );
    expect(stories.map((s) => s.viewport)).toEqual([{ width: 1280, height: 800 }, null, null]);
  });

  it('runs play with the canvas, merged args, globals, and a pass-through step', async () => {
    const play = vi.fn(async (ctx: { step: (label: string, fn: () => Promise<void>) => Promise<void> }) => {
      await ctx.step('inner', async () => {
        order.push('stepped');
      });
    });
    const order: string[] = [];
    const [story] = loadCsfModule(
      { default: { title: 'ui/Button', args: { label: 'a', onClick: () => {} } }, Primary: { play } },
      FILE,
      ROOT,
    );
    const canvasElement = document.createElement('div');
    await story?.play?.({ canvasElement, config: { label: 'b' }, globals: { theme: 'light' } });
    expect(order).toEqual(['stepped']);
    expect(play.mock.calls[0]?.[0]).toMatchObject({
      canvasElement,
      args: { label: 'b', onClick: expect.any(Function) },
      globals: { theme: 'light' },
    });
  });

  it('has no play when the story and meta have none', () => {
    expect(loadCsfModule({ default: { title: 'ui/B' }, A: {} }, FILE, ROOT)[0]?.play).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openChannel } from '../protocol/channel';
import { FRAME_HELLO, PORT_HANDOFF } from '../protocol/messages';
import { meta, story } from '../story/define';
import type { LoadedStory } from '../story/types';
import { type FrameSetup, reportImportFault, startFrame } from './FrameController';
import { startIndex } from './index/startIndex';
import { indexRenderOf, mountFrame } from './mountFrame';

vi.mock('../protocol/channel', () => ({ openChannel: vi.fn(() => ({ send: vi.fn(), on: vi.fn() })) }));
vi.mock('./FrameController', () => ({ startFrame: vi.fn(), reportImportFault: vi.fn() }));
vi.mock('./index/startIndex', () => ({ startIndex: vi.fn() }));

const FILE = '/repo/a.stories.tsx';

function handoff(origin: string, source: unknown, port: unknown = { fake: 'port' }, id?: string) {
  const event = new MessageEvent('message', { data: { type: PORT_HANDOFF, ...(id ? { id } : {}) }, origin });
  Object.defineProperty(event, 'source', { value: source });
  Object.defineProperty(event, 'ports', { value: [port] });
  window.dispatchEvent(event);
}

const settle = () => new Promise((r) => setTimeout(r, 0));

function mount(mod: Record<string, unknown>, id: string, setup?: FrameSetup) {
  location.hash = id;
  void mountFrame({
    index: [{ id, title: 'ui/A', file: FILE, exportName: id.split('--')[1] === 'one' ? 'One' : 'Two' }],
    importers: { [FILE]: async () => mod },
    ...(setup ? { setup } : {}),
  });
}

describe('mountFrame', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    location.hash = '';
  });

  it('ignores a port handed over from another origin', async () => {
    mount({ default: { title: 'ui/A' }, One: {} }, 'ui-a--one');
    handoff('https://elsewhere.example', window.parent);
    await settle();
    expect(openChannel).not.toHaveBeenCalled();
    handoff(location.origin, window.parent);
    await vi.waitFor(() => expect(startFrame).toHaveBeenCalledTimes(1));
  });

  it('ignores a port handed over by a window other than its parent', async () => {
    mount({ default: { title: 'ui/A' }, One: {} }, 'ui-a--one');
    handoff(location.origin, { postMessage() {} });
    await settle();
    expect(openChannel).not.toHaveBeenCalled();
    handoff(location.origin, window.parent);
    await vi.waitFor(() => expect(startFrame).toHaveBeenCalledTimes(1));
  });

  it('takes only the first port, and stops listening once it has one', async () => {
    mount({ default: { title: 'ui/A' }, One: {} }, 'ui-a--one');
    const first = { fake: 'first' };
    handoff(location.origin, window.parent, first);
    // Proxy: resolving an already-settled promise is a no-op, so a listener left in place changes no
    // outcome here; whether the second handoff is read at all is what shows it was removed.
    const read = vi.fn();
    const second = new MessageEvent('message', { data: { type: PORT_HANDOFF }, origin: location.origin });
    Object.defineProperty(second, 'source', { value: window.parent });
    Object.defineProperty(second, 'ports', { get: () => (read(), [{ fake: 'second' }]) });
    window.dispatchEvent(second);
    await vi.waitFor(() => expect(startFrame).toHaveBeenCalledTimes(1));
    expect(openChannel).toHaveBeenCalledTimes(1);
    expect(openChannel).toHaveBeenCalledWith(first);
    expect(read).not.toHaveBeenCalled();
  });

  it('loads a CSF module with the CSF loader', async () => {
    mount({ default: { title: 'ui/A', args: { label: 'x' } }, One: {} }, 'ui-a--one');
    handoff(location.origin, window.parent);
    await vi.waitFor(() => expect(startFrame).toHaveBeenCalled());
    const loaded = vi.mocked(startFrame).mock.calls[0]?.[0].story;
    expect([loaded?.id, loaded?.layout, loaded?.config.defaults()]).toEqual(['ui-a--one', 'padded', { label: 'x' }]);
    expect(reportImportFault).not.toHaveBeenCalled();
  });

  it("titles a module whose meta names none with its index entry's title", async () => {
    mount({ default: {}, One: {} }, 'ui-a--one');
    handoff(location.origin, window.parent);
    await vi.waitFor(() => expect(startFrame).toHaveBeenCalled());
    expect(vi.mocked(startFrame).mock.calls[0]?.[0].story.id).toBe('ui-a--one');
    expect(reportImportFault).not.toHaveBeenCalled();
  });

  it("loads a CSF module under the setup's project parameters", async () => {
    mount({ default: { title: 'ui/A' }, One: {} }, 'ui-a--one', { parameters: { layout: 'fullscreen' } });
    handoff(location.origin, window.parent);
    await vi.waitFor(() => expect(startFrame).toHaveBeenCalled());
    expect(vi.mocked(startFrame).mock.calls[0]?.[0].story.layout).toBe('fullscreen');
  });

  it("renders into the document's #root, so app CSS for #root applies to the story's container", async () => {
    const appRoot = document.createElement('div');
    appRoot.id = 'root';
    document.body.append(appRoot);
    try {
      mount({ default: { title: 'ui/A' }, One: {} }, 'ui-a--one');
      handoff(location.origin, window.parent);
      await vi.waitFor(() => expect(startFrame).toHaveBeenCalled());
      expect(vi.mocked(startFrame).mock.calls[0]?.[0].container).toBe(appRoot);
    } finally {
      appRoot.remove();
    }
  });

  it('renders into the body when the document has no #root', async () => {
    mount({ default: { title: 'ui/A' }, One: {} }, 'ui-a--one');
    handoff(location.origin, window.parent);
    await vi.waitFor(() => expect(startFrame).toHaveBeenCalled());
    expect(vi.mocked(startFrame).mock.calls[0]?.[0].container).toBe(document.body);
  });

  it('asks its parent for a port as soon as it runs', () => {
    const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    mount({ default: { title: 'ui/A' }, One: {} }, 'ui-a--one');
    expect(post).toHaveBeenCalledWith({ type: FRAME_HELLO }, location.origin);
  });

  it("starts importing the hash's story before the port arrives", () => {
    const importer = vi.fn(async () => ({ default: { title: 'ui/A' }, One: {} }));
    location.hash = 'ui-a--one';
    void mountFrame({ index: [{ id: 'ui-a--one', title: 'ui/A', file: FILE, exportName: 'One' }], importers: { [FILE]: importer } });
    expect(importer).toHaveBeenCalledTimes(1);
    expect(openChannel).not.toHaveBeenCalled();
  });

  it('shows what the handoff names over what the hash does, importing each module once', async () => {
    const importer = vi.fn(async () => ({ default: { title: 'ui/A' }, One: {}, Two: {} }));
    location.hash = 'ui-a--one';
    void mountFrame({
      index: [
        { id: 'ui-a--one', title: 'ui/A', file: FILE, exportName: 'One' },
        { id: 'ui-a--two', title: 'ui/A', file: FILE, exportName: 'Two' },
      ],
      importers: { [FILE]: importer },
    });
    handoff(location.origin, window.parent, undefined, 'ui-a--two');
    await vi.waitFor(() => expect(startFrame).toHaveBeenCalled());
    expect(vi.mocked(startFrame).mock.calls[0]?.[0].story.id).toBe('ui-a--two');
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it("starts the story only once the setup's prepare has settled", async () => {
    let release = () => {};
    const prepare = vi.fn((_story: LoadedStory) => new Promise<void>((resolve) => (release = resolve)));
    mount({ default: { title: 'ui/A' }, One: {} }, 'ui-a--one', { prepare });
    handoff(location.origin, window.parent);
    await vi.waitFor(() => expect(prepare).toHaveBeenCalled());
    expect(vi.mocked(prepare).mock.calls[0]?.[0]).toMatchObject({ id: 'ui-a--one' });
    await settle();
    expect(startFrame).not.toHaveBeenCalled();
    release();
    await vi.waitFor(() => expect(startFrame).toHaveBeenCalledTimes(1));
  });

  describe('an index id', () => {
    const OTHER = '/repo/b.stories.tsx';
    const entries = [
      { id: 'ui-a--two', title: 'ui/A', file: FILE, exportName: 'Two', description: 'Second.' },
      { id: 'ui-b--one', title: 'ui/B', file: OTHER, exportName: 'One' },
      { id: 'ui-a--one', title: 'ui/A', file: OTHER, exportName: 'One', componentDescription: 'The A.' },
    ];

    it("starts the component's page with its stories in index order, from every file that titles them", async () => {
      const first = { default: meta({ title: 'ui/A' }), Two: story({ render: () => null }) };
      const second = { default: meta({ title: 'ui/A' }), One: story({ render: () => null }) };
      const importers = { [FILE]: vi.fn(async () => first), [OTHER]: vi.fn(async () => second) };
      void mountFrame({ index: entries, importers });
      handoff(location.origin, window.parent, undefined, 'ui-a:index');
      await vi.waitFor(() => expect(startIndex).toHaveBeenCalled());
      const options = vi.mocked(startIndex).mock.calls[0]?.[0];
      expect(options?.title).toBe('ui/A');
      expect(options?.stories.map((s) => s.id)).toEqual(['ui-a--two', 'ui-a--one']);
      expect(options?.descriptions).toEqual({ 'ui-a--two': 'Second.' });
      expect(options?.render).toBeNull();
      expect(startFrame).not.toHaveBeenCalled();
    });

    it("uses a native meta's index, or a CSF meta's parameters.forge.index", async () => {
      const own = () => null;
      void mountFrame({
        index: entries.slice(0, 1),
        importers: { [FILE]: async () => ({ default: meta({ title: 'ui/A', index: own }), Two: story({ render: () => null }) }) },
      });
      handoff(location.origin, window.parent, undefined, 'ui-a:index');
      await vi.waitFor(() => expect(startIndex).toHaveBeenCalled());
      expect(vi.mocked(startIndex).mock.calls[0]?.[0].render).toBe(own);
      expect(indexRenderOf({ default: { parameters: { forge: { index: own } } } })).toBe(own);
      expect(indexRenderOf({ default: { title: 'x' } })).toBeNull();
    });

    it('faults the import when no story has that title', async () => {
      void mountFrame({ index: entries, importers: {} });
      handoff(location.origin, window.parent, undefined, 'ui-z:index');
      await vi.waitFor(() => expect(reportImportFault).toHaveBeenCalled());
    });
  });

  it('loads a native module with the native loader', async () => {
    mount({ default: meta({ title: 'ui/A' }), Two: story({ render: () => null }) }, 'ui-a--two');
    handoff(location.origin, window.parent);
    await vi.waitFor(() => expect(startFrame).toHaveBeenCalled());
    expect(vi.mocked(startFrame).mock.calls[0]?.[0].story.layout).toBe('centered');
  });
});

// The components' own entries, not the barrel: the barrel would bring every weasel-ui component into each frame.
import { Badge } from '@weasel-js/ui/components/Badge';
import { Button } from '@weasel-js/ui/components/Button';
import {
  createContext,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Globals } from '../../protocol/messages';
import { indexId } from '../../story/indexPages';
import type { ComponentDeps, Decorator, IndexContext, IndexStoryProps, LoadedStory, StoryContext } from '../../story/types';
import { StoryHost } from '../StoryHost';
import { mergeConfig, variantRows, withValueAt } from './variants';
import './index.css';
import { LibraryBadge } from './LibraryBadge';

/** What every cell on an index page shares with the frame that hosts it. */
export interface IndexEnv {
  title: string;
  /** The package the component ships in. */
  library?: string;
  description?: string;
  stories: readonly LoadedStory[];
  /** Per story id, the JSDoc above its export. */
  descriptions: Readonly<Record<string, string>>;
  /** A catalog or showcase rather than one component: every story of it is tagged `gallery`. */
  gallery?: boolean;
  /** The ids of the stories tagged `gallery`. */
  galleries?: readonly string[];
  /** The component's place in the component graph; absent until the graph arrives, and for a gallery. */
  dependencies?: ComponentDeps;
  globals: Globals;
  /** The frame config's, outermost. */
  decorators: readonly Decorator[];
  open: (id: string) => void;
  onError: (error: unknown) => void;
}

export const IndexEnvContext = createContext<IndexEnv | null>(null);

function useEnv(): IndexEnv {
  const env = useContext(IndexEnvContext);
  if (!env) throw new Error('An index page part rendered outside its index page');
  return env;
}

/** How far past the viewport a cell stays mounted. */
const NEAR_MARGIN = '100%';

/** Whether `ref`'s element is near the viewport; true where the browser cannot say. */
function useNearViewport(ref: RefObject<Element | null>): boolean {
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const last = entries.at(-1);
      if (last) setNear(last.isIntersecting);
    }, { rootMargin: NEAR_MARGIN });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return near;
}

/**
 * One story at its defaults with `config` over them. It keeps its own config and state, so it stays interactive, and
 * it mounts only while near the viewport, so a page of canvas stories stays under the browser's WebGL context cap.
 */
export function IndexStory({ story, config: over, label }: IndexStoryProps) {
  const env = useEnv();
  const [config, setConfig] = useState(() => mergeConfig(story.config.defaults(), over));
  const [state, setState] = useState<unknown>(() => story.initialState?.(config) ?? null);
  const cell = useRef<HTMLElement>(null);
  const near = useNearViewport(cell);
  // Held while unmounted, so scrolling past a cell does not move everything after it.
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = cell.current;
    if (!near || !el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(el.getBoundingClientRect().height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);
  const ctx: StoryContext = {
    config,
    setConfig: (path, value) => setConfig((prev: unknown) => withValueAt(prev, path, value)),
    state,
    setState: (next) =>
      setState((prev: unknown) => (typeof next === 'function' ? (next as (p: unknown) => unknown)(prev) : next)),
    globals: env.globals,
    title: story.title,
    name: story.name,
  };
  return (
    <figure
      ref={cell}
      className={`fg-index-cell fg-index-cell--${story.layout}`}
      style={!near && height !== null ? { minHeight: height } : undefined}
    >
      <div className="fg-index-cell__stage">
        {near ? (
          <StoryHost story={story} ctx={ctx} decorators={env.decorators} resetKey={0} onError={env.onError} />
        ) : null}
      </div>
      {label === undefined ? null : <figcaption className="fg-index-cell__label">{label}</figcaption>}
    </figure>
  );
}

/** `story` once per value of each boolean and enum control, every other control at its default. */
export function IndexVariants({ story }: { story: LoadedStory }) {
  const rows = useMemo(() => variantRows(story.config), [story]);
  const defaults = useMemo(() => story.config.defaults(), [story]);
  if (rows.length === 0) return null;
  return (
    <div className="fg-index-variants">
      {rows.map((row) => (
        <section key={row.path} className="fg-index-variants__row" aria-label={row.label}>
          <h4 className="fg-index-variants__label">{row.label}</h4>
          <div className="fg-index-variants__cells">
            {row.values.map((v) => (
              <IndexStory
                key={String(v.value)}
                story={story}
                config={withValueAt(defaults, row.path, v.value) as Record<string, unknown>}
                label={v.label}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GalleryBadge() {
  return (
    <Badge status="accent" variant="subtle" size="sm">
      Gallery
    </Badge>
  );
}

function DependencyList({ label, titles, empty }: { label: string; titles: readonly string[]; empty: string }) {
  const env = useEnv();
  const labelId = useId();
  const follow = (event: MouseEvent, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    env.open(id);
  };
  return (
    <div className="fg-index-deps__row">
      <dt id={labelId} className="fg-index-deps__label">
        {label}
      </dt>
      <dd className="fg-index-deps__value">
        {titles.length === 0 ? (
          <span className="fg-index-deps__empty">{empty}</span>
        ) : (
          <ul className="fg-index-deps__list" aria-labelledby={labelId}>
            {titles.map((title) => {
              const cut = title.lastIndexOf('/') + 1;
              const id = indexId(title);
              return (
                <li key={title}>
                  <a className="fg-index-deps__link" href={`#/${encodeURIComponent(id)}`} onClick={(event) => follow(event, id)}>
                    <span className="fg-index-deps__prefix">{title.slice(0, cut)}</span>
                    {title.slice(cut)}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </dd>
    </div>
  );
}

/** The listed components this one uses and those that use it, read from source. Nothing for a gallery. */
export function IndexDependencies() {
  const { gallery, dependencies } = useEnv();
  if (gallery || !dependencies) return null;
  if (dependencies.source === null) {
    return (
      <p className="fg-index-deps__none">
        forge found no source file for this component, so it lists none of its dependencies. It looks for the
        import the meta&rsquo;s <code>component</code> names, or else the one the title&rsquo;s last segment names.
      </p>
    );
  }
  return (
    <dl className="fg-index-deps" aria-label="Dependencies">
      <DependencyList label="Uses" titles={dependencies.uses} empty="No listed component." />
      <DependencyList label="Used by" titles={dependencies.usedBy} empty="No listed component uses it." />
    </dl>
  );
}

function StorySection({ story, variants }: { story: LoadedStory; variants: boolean }) {
  const env = useEnv();
  const headingId = useId();
  const description = env.descriptions[story.id];
  const gallery = !env.gallery && env.galleries?.includes(story.id);
  return (
    <section className="fg-index-story" aria-labelledby={headingId}>
      <header className="fg-index-story__head">
        <h2 id={headingId} className="fg-index-story__name">
          {story.name}
        </h2>
        {gallery ? <GalleryBadge /> : null}
        <Button variant="secondary" size="sm" onClick={() => env.open(story.id)}>
          Open
        </Button>
      </header>
      {description ? <p className="fg-index-story__description">{description}</p> : null}
      <IndexStory story={story} />
      {variants ? <IndexVariants story={story} /> : null}
    </section>
  );
}

/** Which of `stories` show their variants: the first of each set of controls. Stories of one CSF file share their
 *  meta's controls, and the same rows under every story would only repeat. */
function firstOfEachControlSet(stories: readonly LoadedStory[]): Set<string> {
  const seen = new Set<string>();
  const shown = new Set<string>();
  for (const story of stories) {
    const key = JSON.stringify(variantRows(story.config));
    if (seen.has(key)) continue;
    seen.add(key);
    shown.add(story.id);
  }
  return shown;
}

/** The generated page: the component's title and description, then each story, with the variants of the first of
 *  each set of controls. */
export function DefaultIndex() {
  const env = useEnv();
  const withVariants = useMemo(() => firstOfEachControlSet(env.stories), [env.stories]);
  const segments = env.title.split('/');
  const name = segments.pop();
  const { library } = env;
  if (library !== undefined && segments[0] === library) segments.shift();
  return (
    <article className="fg-index">
      <header className="fg-index__head">
        {segments.length > 0 || library !== undefined ? (
          <p className="fg-index__path">
            {library !== undefined ? <LibraryBadge library={library} className="fg-index__library" /> : null}
            {segments.join(' / ')}
          </p>
        ) : null}
        <div className="fg-index__title-row">
          <h1 className="fg-index__title">{name}</h1>
          {env.gallery ? <GalleryBadge /> : null}
        </div>
        {env.description ? <p className="fg-index__description">{env.description}</p> : null}
        <IndexDependencies />
      </header>
      {env.stories.map((story) => (
        <StorySection key={story.id} story={story} variants={withVariants.has(story.id)} />
      ))}
    </article>
  );
}

/** What a component's own index page is handed. */
export function indexContext(env: IndexEnv): IndexContext {
  return {
    title: env.title,
    ...(env.description === undefined ? {} : { description: env.description }),
    stories: env.stories,
    globals: env.globals,
    Story: IndexStory,
    Variants: IndexVariants,
    DefaultIndex,
    Dependencies: IndexDependencies,
    gallery: env.gallery ?? false,
    open: env.open,
  };
}

/** The page itself: the component's own, or the generated one. */
export function IndexPage({ env, render }: { env: IndexEnv; render: ((ctx: IndexContext) => ReactNode) | null }) {
  return (
    <IndexEnvContext.Provider value={env}>{render ? render(indexContext(env)) : <DefaultIndex />}</IndexEnvContext.Provider>
  );
}

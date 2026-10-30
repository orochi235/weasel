import { Fragment, useCallback, type ReactNode, type RefObject } from 'react';
import { isPrefLeaf, prefAsBox, prefTabRuns, prefValueAtPath, type PrefAlias, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { MotifFrame } from '../MotifFrame';
import { FORM_FRAMES, headingInline } from './frames';
import { groupHeading, groupOff } from './groupHeading';
import { GroupTabs } from './GroupTabs';
import { BarLayout, groupBarNodes, shownBarNodes, type BarLeafNode, type BarOrientation } from '../Bar/BarLayout';
import { PrefRow, prefRenderContext, renderPrefControl, shownLeaf, type WalkCtx } from './PrefsRow';
import { HiddenBadge, hiddenAttrs, marksHidden } from './hidden';
import { aliasOfNothing } from './PrefWords';
import { pathWithin, selectionAttrs, tabAttrs, useHeldTab } from './selection';
import { markScrollbar } from './scrollbar';
import { splitMarks } from './SplitRow';
import { stuckHeadingRef } from './stuckHeading';
import s from './Prefs.module.css';

/** Props for {@link PrefsPane}. */
export interface PrefsPaneProps {
  ctx: WalkCtx;
  /** The open group, or a synthetic one holding the root's loose leaves. */
  group: PrefGroup;
  /** Dotted path of `group`. Empty for the loose-leaf pane. */
  path: string;
  /** The pane's scroll container, which the rail scrolls back to the top when a page opens. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Which page this is. Rows start fresh when it changes, so one page's row state (a half-typed entry) never
   *  shows on another whose row has the same key. Default `path`; an owner whose `path` moves while the page
   *  stays the same one, as under a drag, names the page itself. */
  pageKey?: string;
  className?: string;
}

type Entry = [key: string, child: PrefLeaf | PrefGroup];

const join = (path: string, key: string): string => (path === '' ? key : `${path}.${key}`);

/**
 * One rail page's settings: the group's leaves and nested groups in schema order,
 * each group drawn as its `as` says.
 *
 * Nothing here draws a panel unless a group asks for one. The rail is the
 * layout's structure, and a card inside a dialog that already has a border
 * only restates it — the columns layout's sunken panels are what this is the
 * alternative to.
 */
export function PrefsPane(props: PrefsPaneProps) {
  const { ctx, group, path, scrollRef, pageKey = path, className } = props;
  const head = groupHeading(ctx, group, path);
  // Whatever hides it, a page is drawn apart from what it sits in, so it carries the mark itself.
  const marked = ctx.hidden?.has(path) === true;
  const paneRef = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    return markScrollbar(el);
  }, [scrollRef]);

  return (
    // A hidden page is marked whole: its heading and its rows share no element but this one.
    <div className={[s.pane, className].filter(Boolean).join(' ')} ref={paneRef} data-pref-into={path} data-pref-scroll="" {...hiddenAttrs(marked)}>
      <div className={s.paneHead} {...selectionAttrs(path, { selected: ctx.selected })}>
        <h3 className={[s.paneTitle, head.className].filter(Boolean).join(' ')}>{head.name}{marked && <HiddenBadge />}{head.control}</h3>
        {group.description !== undefined && (
          <p className={s.paneDesc}>{group.description}</p>
        )}
      </div>
      <Fragment key={pageKey}>
        {paneRuns(head.entries).map((run) =>
          run.rows
            ? <div key={run.entries[0]![0]} className={s.rows}>{paneChildren(ctx, run.entries, path, 0)}</div>
            : paneChildren(ctx, run.entries, path, 0))}
      </Fragment>
    </div>
  );
}

/** A page's children in schema order, cut where rows give way to a group that draws a block of its own or back.
 *  A fragment's rows are rows among the leaves'. */
function paneRuns(entries: readonly Entry[]): Array<{ rows: boolean; entries: Entry[] }> {
  const runs: Array<{ rows: boolean; entries: Entry[] }> = [];
  for (const entry of entries) {
    const rows = isPrefLeaf(entry[1]) || entry[1].as === 'fragment';
    const last = runs.at(-1);
    if (last?.rows === rows) last.entries.push(entry);
    else runs.push({ rows, entries: [entry] });
  }
  return runs;
}

/** Whether `child` has a row to draw: it is a leaf the form draws, or a group holding one. */
function paneDraws(ctx: WalkCtx, child: PrefLeaf | PrefGroup): boolean {
  if (isPrefLeaf(child)) return child.hidden !== true || ctx.showHidden === true;
  return ctx.keepEmpty === true || Object.values(child.children).some((inner) => paneDraws(ctx, inner));
}

/**
 * A group's children in schema order: a row per leaf, and each group as its `as` says, a run of tabs as one strip.
 * A group with no row to draw is left out, as `prefTabRuns` leaves it out.
 * `box` draws a group that asks for a panel or says nothing; without it such a group is a bordered panel when it
 * asks for one and a headed section otherwise.
 */
export function paneChildren(
  ctx: WalkCtx, entries: readonly Entry[], path: string, depth: number,
  box?: (key: string, group: PrefGroup, path: string) => ReactNode,
): ReactNode[] {
  const out: ReactNode[] = [];
  for (const step of prefTabRuns(entries, ([, c]) => !isPrefLeaf(c) && c.as === 'tab', ([, c]) => isPrefLeaf(c) || paneDraws(ctx, c))) {
    if (step.tabs) {
      const tabs = step.tabs.map(([k, c]): [string, PrefGroup] => [join(path, k), c as PrefGroup]);
      out.push(<PaneTabs key={step.tabs[0]![0]} ctx={ctx} tabs={tabs} depth={depth} box={box} />);
      continue;
    }
    const [key, child] = step.item;
    const p = join(path, key);
    if (isPrefLeaf(child)) {
      out.push(<PrefRow key={key} ctx={ctx} path={p} pref={child} />);
    } else if (child.as === 'fragment') {
      // No box of its own (`display: contents`): its rows take their places in the rows around them, and each
      // carries the mark a hidden fragment has no box for.
      const inner = marksHidden(ctx.hidden, p) ? { ...ctx, hidden: new Set([...ctx.hidden!].filter((at) => at !== p)) } : ctx;
      out.push(
        <div key={key} className={s.fragment} data-pref-fragment="" {...selectionAttrs(p, { selected: ctx.selected })}>
          {paneChildren(inner, Object.entries(child.children), p, depth, box)}
        </div>,
      );
    } else if (child.as === 'bar') {
      out.push(<PaneBar key={key} ctx={ctx} group={child} path={p} depth={depth} />);
    } else if (child.as === 'section') {
      out.push(<PaneSection key={key} ctx={ctx} group={child} path={p} depth={Math.max(depth, box ? 1 : 0)} box={box} />);
    } else if (box) {
      out.push(box(key, child, p));
    } else if (prefAsBox(child.as)) {
      out.push(<PanePanel key={key} ctx={ctx} group={child} path={p} depth={depth} />);
    } else {
      out.push(<PaneSection key={key} ctx={ctx} group={child} path={p} depth={depth} />);
    }
  }
  return out;
}

/** A nested group inside a pane. A section inside another indents. */
function PaneSection({ ctx, group, path, depth, box }: {
  ctx: WalkCtx;
  group: PrefGroup;
  path: string;
  depth: number;
  box?: (key: string, group: PrefGroup, path: string) => ReactNode;
}) {
  const Heading = depth === 0 ? 'h4' : 'h5';
  const head = groupHeading(ctx, group, path);
  return (
    <section
      className={depth === 0 ? s.paneSection : s.paneSubsection}
      {...selectionAttrs(path, ctx)}
      aria-label={group.name}
    >
      <Heading className={[depth === 0 ? s.sectionTitle : s.subsectionTitle, head.className].filter(Boolean).join(' ')} data-pref-sticky={depth === 0 ? '' : undefined} ref={depth === 0 ? stuckHeadingRef : undefined}>
        {head.name}
        {marksHidden(ctx.hidden, path) && <HiddenBadge />}
        {head.control}
      </Heading>
      {group.description !== undefined && (
        <p className={s.paneDesc}>{group.description}</p>
      )}
      <div className={s.rows}>{paneChildren(ctx, head.entries, path, depth + 1, box)}</div>
    </section>
  );
}

/**
 * A group drawn as a bar: its leaves in their bar forms on one line, with no
 * heading. A page, tab, or panel inside it opens from a button, as the form
 * would draw it.
 */
export function PaneBar({ ctx, group, path, depth, orientation }: {
  ctx: WalkCtx;
  group: PrefGroup;
  path: string;
  depth: number;
  orientation?: BarOrientation;
}) {
  // The leaf an alias shows stands in its place, so the bar names its cell and its popover for that leaf.
  const shown = (node: BarLeafNode): BarLeafNode => {
    const drawn = shownLeaf(ctx, node.leaf);
    return drawn?.at === undefined ? node : { path: node.path, at: drawn.at, leaf: drawn.pref };
  };
  return (
    <BarLayout
      framed
      orientation={orientation}
      overflow={ctx.droppable ? undefined : group.overflow}
      lead={group.lead}
      icon={group.icon}
      disabled={groupOff(ctx, path)}
      rootAttrs={{ ...selectionAttrs(path, ctx), 'data-pref-bar': '' }}
      label={group.name === '' ? undefined : group.name}
      nodes={shownBarNodes(groupBarNodes(group, path, (inner, at) => (
        <div className={s.rows}>{paneChildren(ctx, Object.entries(inner.children), at, depth + 1)}</div>
      ), { values: (at: string) => prefValueAtPath(ctx.values, at), onChange: ctx.onChange }), shown)}
      cells={(leaves) => ctx.leaves ? ctx.leaves.cells(leaves) :
        leaves.flatMap(({ path: own, leaf, at }): Array<{ path: string; content: ReactNode }> => {
          // An alias still here shows nothing, or is a renderer's to draw.
          const drawn = at === undefined ? shownLeaf(ctx, leaf) : { pref: leaf, at };
          // A wiring fault, shown where it sits as a row shows it.
          if (!drawn) return [{ path: own, content: <span className={s.unrenderable}>{aliasOfNothing(leaf as PrefAlias)}</span> }];
          const { renderCtx } = prefRenderContext(ctx, own, drawn.pref, drawn.at);
          const content = renderPrefControl(renderCtx, ctx.renderers, undefined, 'bar');
          if (content == null) return [];
          const marks = splitMarks(ctx.split, ctx.values, renderCtx, drawn.at !== undefined);
          return [{ path: own, content: marks || marksHidden(ctx.hidden, own) ? <>{content}{marks}{marksHidden(ctx.hidden, own) && <HiddenBadge />}</> : content }];
        })
      }
      row={({ path: own, leaf, at }) => <PrefRow ctx={ctx} path={own} pref={leaf} at={at} />}
      attrs={(at, leaf) => selectionAttrs(at, ctx, leaf)}
    />
  );
}

/** A group drawn as a bordered box under its name. */
function PanePanel({ ctx, group, path, depth }: {
  ctx: WalkCtx;
  group: PrefGroup;
  path: string;
  depth: number;
}) {
  const marked = marksHidden(ctx.hidden, path);
  const head = groupHeading(ctx, group, path);
  const named = group.name !== '';
  return (
    <MotifFrame
      motif={group.motif}
      fallback={FORM_FRAMES.box}
      role="region"
      title={named ? group.name : undefined}
      disabled={head.off}
      inline={named ? headingInline(marked, head.control) : undefined}
      note={group.description}
      level={5}
      className={s.panePanel}
      attrs={selectionAttrs(path, ctx)}
    >
      {!named && marked && <HiddenBadge lead />}
      <div className={s.rows}>{paneChildren(ctx, head.entries, path, depth + 1)}</div>
    </MotifFrame>
  );
}

/** Neighboring `tab` groups: one strip of their names, and the rows of the one picked. */
function PaneTabs({ ctx, tabs, depth, box }: {
  ctx: WalkCtx;
  tabs: ReadonlyArray<[path: string, group: PrefGroup]>;
  depth: number;
  box?: (key: string, group: PrefGroup, path: string) => ReactNode;
}) {
  const ids = tabs.map(([p]) => p);
  const [open, setPicked] = useHeldTab(ids, ids.find((p) => pathWithin(p, ctx.lead)), ctx.lead);
  return (
    <GroupTabs
      className={s.paneTabs}
      picked={open}
      onPick={setPicked}
      tabs={tabs.map(([p, g]) => ({
        id: p,
        name: g.name,
        disabled: groupOff(ctx, p),
        attrs: tabAttrs(p, ctx, p === open),
        panelAttrs: selectionAttrs(p, ctx),
        content: (
          <>
            {marksHidden(ctx.hidden, p) && <HiddenBadge lead />}
            {g.description !== undefined && <p className={s.paneDesc}>{g.description}</p>}
            <div className={s.rows}>{paneChildren(ctx, Object.entries(g.children), p, depth + 1, box)}</div>
          </>
        ),
      }))}
    />
  );
}

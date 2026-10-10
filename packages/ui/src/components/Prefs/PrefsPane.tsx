import { type ReactNode, type RefObject, useState } from 'react';
import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { GroupTabs } from './GroupTabs';
import { PrefRow, type WalkCtx } from './PrefsRow';
import { selectionAttrs } from './selection';
import s from './Prefs.module.css';

/** Props for {@link PrefsPane}. */
export interface PrefsPaneProps {
  ctx: WalkCtx;
  /** The open group, or a synthetic one holding the root's loose leaves. */
  group: PrefGroup;
  /** Dotted path of `group`. Empty for the loose-leaf pane. */
  path: string;
  /** The pane's scroll container, for the rail's scroll spy. */
  scrollRef: RefObject<HTMLDivElement | null>;
  className?: string;
}

type Entry = [key: string, child: PrefLeaf | PrefGroup];

const join = (path: string, key: string): string => (path === '' ? key : `${path}.${key}`);
const within = (path: string, selected: string | null | undefined): boolean =>
  selected != null && (selected === path || selected.startsWith(`${path}.`));

/**
 * One rail section's settings: the group's own leaves, then its nested groups,
 * each drawn as its `as` says.
 *
 * Nothing here draws a panel unless a group asks for one. The rail is the
 * layout's structure, and a card inside a dialog that already has a border
 * only restates it — the columns layout's sunken panels are what this is the
 * alternative to.
 */
export function PrefsPane(props: PrefsPaneProps) {
  const { ctx, group, path, scrollRef, className } = props;
  const entries = Object.entries(group.children);
  const leaves = entries.filter(([, child]) => isPrefLeaf(child));
  const groups = entries.filter(([, child]) => !isPrefLeaf(child));

  return (
    <div className={[s.pane, className].filter(Boolean).join(' ')} ref={scrollRef} data-pref-into={path} data-pref-scroll="">
      <div className={s.paneHead} {...selectionAttrs(path, ctx)}>
        <h3 className={s.paneTitle}>{group.name}</h3>
        {group.description !== undefined && (
          <p className={s.paneDesc}>{group.description}</p>
        )}
      </div>
      {leaves.length > 0 && <div className={s.rows}>{paneChildren(ctx, leaves, path, 0)}</div>}
      {paneChildren(ctx, groups, path, 0)}
    </div>
  );
}

/**
 * A group's children in schema order: a row per leaf, and each group as its `as` says, a run of tabs as one strip.
 * `box` draws a group that asks for a panel or says nothing; without it such a group is a bordered panel when it
 * asks for one and a headed section otherwise.
 */
export function paneChildren(
  ctx: WalkCtx, entries: readonly Entry[], path: string, depth: number,
  box?: (key: string, group: PrefGroup, path: string) => ReactNode,
): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < entries.length; i++) {
    const [key, child] = entries[i]!;
    const p = join(path, key);
    if (isPrefLeaf(child)) {
      out.push(<PrefRow key={key} ctx={ctx} path={p} pref={child} />);
    } else if (child.as === 'tab') {
      const tabs: Array<[string, PrefGroup]> = [];
      for (; i < entries.length; i++) {
        const [k, c] = entries[i]!;
        if (isPrefLeaf(c) || c.as !== 'tab') break;
        tabs.push([join(path, k), c]);
      }
      i--;
      out.push(<PaneTabs key={key} ctx={ctx} tabs={tabs} depth={depth} box={box} />);
    } else if (child.as === 'section') {
      out.push(<PaneSection key={key} ctx={ctx} group={child} path={p} depth={Math.max(depth, box ? 1 : 0)} box={box} />);
    } else if (box) {
      out.push(box(key, child, p));
    } else if (child.as === 'panel') {
      out.push(<PanePanel key={key} ctx={ctx} group={child} path={p} depth={depth} />);
    } else {
      out.push(<PaneSection key={key} ctx={ctx} group={child} path={p} depth={depth} />);
    }
  }
  return out;
}

/**
 * A nested group inside a pane. Depth 0 sections are the ones the rail links
 * to and carry `data-spy-section`; deeper ones indent and are reached only by
 * scrolling, which is what keeps the rail two levels deep whatever the schema
 * does.
 */
function PaneSection({ ctx, group, path, depth, box }: {
  ctx: WalkCtx;
  group: PrefGroup;
  path: string;
  depth: number;
  box?: (key: string, group: PrefGroup, path: string) => ReactNode;
}) {
  const Heading = depth === 0 ? 'h4' : 'h5';
  return (
    <section
      className={depth === 0 ? s.paneSection : s.paneSubsection}
      data-spy-section={depth === 0 ? path : undefined}
      {...selectionAttrs(path, ctx)}
      aria-label={group.name}
    >
      <Heading className={depth === 0 ? s.sectionTitle : s.subsectionTitle}>
        {group.name}
      </Heading>
      {group.description !== undefined && (
        <p className={s.paneDesc}>{group.description}</p>
      )}
      <div className={s.rows}>{paneChildren(ctx, Object.entries(group.children), path, depth + 1, box)}</div>
    </section>
  );
}

/** A group drawn as a bordered box under its name. */
function PanePanel({ ctx, group, path, depth }: {
  ctx: WalkCtx;
  group: PrefGroup;
  path: string;
  depth: number;
}) {
  return (
    <section className={s.panePanel} {...selectionAttrs(path, ctx)} aria-label={group.name}>
      {group.name !== '' && <h5 className={s.panelTitle}>{group.name}</h5>}
      {group.description !== undefined && <p className={s.paneDesc}>{group.description}</p>}
      <div className={s.rows}>{paneChildren(ctx, Object.entries(group.children), path, depth + 1)}</div>
    </section>
  );
}

/** Neighboring `tab` groups: one strip of their names, and the rows of the one picked. */
function PaneTabs({ ctx, tabs, depth, box }: {
  ctx: WalkCtx;
  tabs: ReadonlyArray<[path: string, group: PrefGroup]>;
  depth: number;
  box?: (key: string, group: PrefGroup, path: string) => ReactNode;
}) {
  const [picked, setPicked] = useState(tabs[0]![0]);
  // A selection inside another tab opens that tab once, when it arrives; the reader may then leave it.
  const [seen, setSeen] = useState(ctx.selected);
  if (seen !== ctx.selected) {
    setSeen(ctx.selected);
    const holder = tabs.find(([p]) => within(p, ctx.selected));
    if (holder && holder[0] !== picked) setPicked(holder[0]);
  }
  const open = tabs.find(([p]) => p === picked)?.[0] ?? tabs[0]![0];
  return (
    <GroupTabs
      className={s.paneTabs}
      picked={open}
      onPick={setPicked}
      tabs={tabs.map(([p, g]) => ({
        id: p,
        name: g.name,
        // The open tab's mark is its panel's, so a selection is drawn once.
        attrs: selectionAttrs(p, p === open ? {} : ctx),
        panelAttrs: selectionAttrs(p, ctx),
        content: (
          <>
            {g.description !== undefined && <p className={s.paneDesc}>{g.description}</p>}
            <div className={s.rows}>{paneChildren(ctx, Object.entries(g.children), p, depth + 1, box)}</div>
          </>
        ),
      }))}
    />
  );
}

import { type RefObject } from 'react';
import { isPrefLeaf, type PrefGroup, type PrefLeaf } from './schema';
import { PrefRow, type WalkCtx } from './PrefsRow';
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

/**
 * One rail section's settings: the group's own leaves, then one headed
 * section per nested group.
 *
 * Nothing here draws a panel. The rail is the layout's structure, and a card
 * inside a dialog that already has a border only restates it — the columns
 * layout's sunken panels are what this is the alternative to.
 */
export function PrefsPane(props: PrefsPaneProps) {
  const { ctx, group, path, scrollRef, className } = props;
  const leaves = Object.entries(group.children).filter(
    (entry): entry is [string, PrefLeaf] => isPrefLeaf(entry[1]),
  );
  const groups = Object.entries(group.children).filter(
    (entry): entry is [string, PrefGroup] => !isPrefLeaf(entry[1]),
  );
  const childPath = (key: string): string => (path === '' ? key : `${path}.${key}`);

  return (
    <div className={[s.pane, className].filter(Boolean).join(' ')} ref={scrollRef}>
      <div className={s.paneHead}>
        <h3 className={s.paneTitle}>{group.name}</h3>
        {group.description !== undefined && (
          <p className={s.paneDesc}>{group.description}</p>
        )}
      </div>
      {leaves.length > 0 && (
        <div className={s.rows}>
          {leaves.map(([key, leaf]) => (
            <PrefRow key={key} ctx={ctx} path={childPath(key)} pref={leaf} />
          ))}
        </div>
      )}
      {groups.map(([key, child]) => (
        <PaneSection
          key={key}
          ctx={ctx}
          group={child}
          path={childPath(key)}
          depth={0}
        />
      ))}
    </div>
  );
}

/**
 * A nested group inside a pane. Depth 0 sections are the ones the rail links
 * to and carry `data-spy-section`; deeper ones indent and are reached only by
 * scrolling, which is what keeps the rail two levels deep whatever the schema
 * does.
 */
function PaneSection({ ctx, group, path, depth }: {
  ctx: WalkCtx;
  group: PrefGroup;
  path: string;
  depth: number;
}) {
  const Heading = depth === 0 ? 'h4' : 'h5';
  return (
    <section
      className={depth === 0 ? s.paneSection : s.paneSubsection}
      data-spy-section={depth === 0 ? path : undefined}
      aria-label={group.name}
    >
      <Heading className={depth === 0 ? s.sectionTitle : s.subsectionTitle}>
        {group.name}
      </Heading>
      {group.description !== undefined && (
        <p className={s.paneDesc}>{group.description}</p>
      )}
      <div className={s.rows}>
        {Object.entries(group.children).map(([key, child]) => {
          const p = `${path}.${key}`;
          return isPrefLeaf(child) ? (
            <PrefRow key={key} ctx={ctx} path={p} pref={child} />
          ) : (
            <PaneSection key={key} ctx={ctx} group={child} path={p} depth={depth + 1} />
          );
        })}
      </div>
    </section>
  );
}

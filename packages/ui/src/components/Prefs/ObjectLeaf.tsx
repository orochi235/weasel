import type { ReactNode } from 'react';
import { isPrefLeaf, prefSectionLeaves, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import { BarLayout } from '../Bar/BarLayout';
import type { LeafSurface } from '../Bar/renderBarLeaf';
import { PropertyRow } from '../Properties/PropertyPanel';
import { drawsRows, drawsSeveral } from './compound';
import { GroupTabs, type GroupTab } from './GroupTabs';
import type { PrefRenderContext } from './PrefsRow';
import s from './Prefs.module.css';

/** One value with its fields hanging off it: each field renders its own
 *  control and commits the parent object whole. */
export function ObjectLeaf({
  ctx,
  renderField,
}: {
  ctx: PrefRenderContext;
  /** Draws one field, for a row or for a bar. `siblings` is the object it is a field of. */
  renderField: (ctx: PrefRenderContext, siblings: Record<string, unknown> | undefined, surface?: LeafSurface) => ReactNode;
}) {
  const pref = ctx.pref as PrefObject;
  const { value, setValue } = ctx;
  const held = typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
  const fieldCtx = (key: string, child: PrefLeaf): PrefRenderContext => ({
    path: `${ctx.path}.${key}`,
    pref: child,
    value: held?.[key],
    setValue: (v) => {
      const base = held ?? pref.fromScalar?.(value) ?? {};
      setValue({ ...base, [key]: v });
    },
    // A field is not pinned on its own — it shares the state of
    // the object leaf it hangs off.
    auto: ctx.auto,
    setAuto: ctx.setAuto,
    ...(ctx.fields ? { fields: ctx.fields } : {}),
  });
  const objectRows = (children: PrefObject['children']): ReactNode[] => {
    const out: ReactNode[] = [];
    // A run of neighboring `tab` sections, held until something else ends it.
    let tabs: GroupTab[] = [];
    const flushTabs = (): void => {
      if (tabs.length > 0) out.push(<GroupTabs key={`tabs:${tabs[0]!.id}`} tabs={tabs} />);
      tabs = [];
    };
    for (const [key, child] of Object.entries(children)) {
      if (!isPrefLeaf(child)) {
        if (child.as === 'bar') {
          flushTabs();
          // The section's fields on one line, each in its bar form.
          const cells = prefSectionLeaves(child.members).flatMap(([field, leaf]) => {
            const content = renderField(fieldCtx(field, leaf), held, 'bar');
            return content == null ? [] : [{ kind: 'cell' as const, path: `${ctx.path}.${field}`, content }];
          });
          if (cells.length > 0) {
            out.push(
              <BarLayout
                key={`bar:${key}`}
                framed
                label={child.name === '' ? undefined : child.name}
                nodes={cells}
                cells={() => []}
                row={() => null}
              />,
            );
          }
          continue;
        }
        const inner = objectRows(child.members);
        if (inner.length === 0) continue;
        if (child.as === 'tab') {
          tabs.push({ id: key, name: child.name, content: inner });
          continue;
        }
        flushTabs();
        if (child.as === 'fragment') {
          out.push(...inner);
          continue;
        }
        const heading = <h4 key={`group:${key}`} className={s.objectGroup}>{child.name}</h4>;
        if (child.as === 'panel') out.push(<div key={`panel:${key}`} className={s.panePanel}>{heading}{inner}</div>);
        else out.push(heading, ...inner);
        continue;
      }
      flushTabs();
      const stacked = drawsRows(child);
      out.push(
        <PropertyRow
          key={key}
          label={child.name}
          description={child.description}
          layout={stacked ? 'block' : 'inline'}
          group={drawsSeveral(child)}
          className={stacked ? undefined : s.objectRow}
        >
          <span className={s.rowControl}>
            {renderField(fieldCtx(key, child), held)}
          </span>
        </PropertyRow>,
      );
    }
    flushTabs();
    return out;
  };
  return <div className={s.objectLeaf}>{objectRows(pref.children)}</div>;
}

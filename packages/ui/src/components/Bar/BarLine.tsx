import type { CSSProperties, ReactNode } from 'react';
import { barLead, drawBarItem, inBarMenu, splitBarItems, type LineItem } from './barItems';
import { BarOverflow } from './BarOverflow';
import { useBarReorder } from './useBarReorder';
import { useBarReorderKeys } from './useBarReorderKeys';
import { BAR_MORE, useBarOverflow } from './useBarOverflow';
import { useBarLead } from './barLeadHandle';
import { DockBarContext, useReportDockLeast } from '../ToolbarDock/dockContext';
import { RunScope } from '../Run';
import { FitScope, useFitScope } from '../FitLabel/FitLabel';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import type { BarProps } from './Bar';
import s from './Bar.module.css';
import f from './barFrames.module.css';

/** A bar's props with its children read into the items of its line. */
export type BarLineProps = Omit<BarProps, 'children'> & { items: readonly LineItem[]; sm: boolean };

/** The class a bar's frame draws. */
export function frameClass(framed: BarProps['framed']): string | undefined {
  if (framed === undefined || framed === false) return undefined;
  return { true: s.framed, segmented: s.segmented, band: f.band, status: f.footer }[String(framed) as 'true'];
}

/** The element and role a bar draws as: a status strip is a footer of readouts, any other named bar a toolbar. */
export function barRoot({ framed, label }: Pick<BarProps, 'framed' | 'label'>): { status: boolean; role?: 'toolbar' } {
  if (framed === 'status') return { status: true };
  return label === undefined ? { status: false } : { status: false, role: 'toolbar' };
}

/** A bar on a straight line, across or down. */
export function BarLine(props: BarLineProps) {
  const { items, orientation = 'horizontal', rootAttrs, label, framed, className } = props;
  const { overflow = 'scroll', overflowLabel = 'More' } = props;
  const vertical = orientation === 'vertical';
  const leading = useBarLead(barLead(props));

  const menu = overflow === 'menu';
  const { bar: barRef, kept, natural, least } = useBarOverflow(menu, items.map((item) => item.key), vertical);
  useReportDockLeast(least);
  const rove = useRovingTabIndex<HTMLDivElement>({ orientation });
  const roveRef = rove.rootRef;
  const fit = useFitScope(barRef);
  const { line, rest } = splitBarItems(items, kept);
  const reorder = useBarReorder({ root: barRef, order: props.order, onReorder: props.onReorder, keysOf: props.keysOf, measure: (_, p) => (vertical ? p.clientY : p.clientX) });
  const keys = useBarReorderKeys({ root: barRef, order: props.order, onReorder: props.onReorder, keysOf: props.keysOf, vertical });
  const root = barRoot({ framed, label });
  const Root = root.status ? 'footer' : 'div';

  const content: ReactNode = (
    <RunScope orientation={orientation}>
      {props.onReorder && <span aria-live="polite" aria-atomic="true" data-bar-announce="" className={s.status}>{keys.announcement}</span>}
      {leading && <span className={s.lead} {...leading.attrs}>{leading.content}</span>}
      {line.map((item) => drawBarItem(item, vertical))}
      {rest.length > 0 && (
        <span className={s.cell} {...{ [BAR_MORE]: '' }}>
          <BarOverflow label={overflowLabel}>{rest.map((item) => drawBarItem(inBarMenu(item), true))}</BarOverflow>
        </span>
      )}
    </RunScope>
  );
  return (
    <Root
      {...rootAttrs}
      ref={(el: HTMLElement | null) => {
        barRef.current = el as HTMLDivElement | null;
        roveRef.current = props.roving ? (el as HTMLDivElement | null) : null;
      }}
      onPointerDownCapture={reorder.onPointerDownCapture}
      onKeyDownCapture={keys.onKeyDownCapture}
      onKeyDown={props.roving ? rove.onKeyDown : undefined}
      className={[s.bar, frameClass(framed), props.sm && f.sm, props.wrap && f.wrap, className].filter(Boolean).join(' ')}
      data-orientation={orientation}
      data-overflow={menu ? 'menu' : undefined}
      style={natural === undefined ? undefined : ({ '--bar-natural': `${natural}px` } as CSSProperties)}
      role={root.role}
      aria-label={label}
      aria-orientation={root.role === undefined ? undefined : orientation}
    >
      <DockBarContext.Provider value={null}>{props.fit ? <FitScope value={fit}>{content}</FitScope> : content}</DockBarContext.Provider>
    </Root>
  );
}

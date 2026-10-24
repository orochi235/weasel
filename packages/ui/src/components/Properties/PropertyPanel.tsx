import { createContext, type ReactNode, useContext, useId } from 'react';
import { Disclosure } from '../Disclosure';
import { type AppearanceProps, useAppearance } from '../appearance';
import { type CollapseProps, foldTitle, twistyClass, useCollapse } from './collapse';
import { type PropertyMetricProps, propertyMetricClass } from './metrics';
import s from './Properties.module.css';

/** Props for `<PropertyPanel>`. */
export interface PropertyPanelProps extends PropertyMetricProps, AppearanceProps, CollapseProps {
  title?: ReactNode;
  /** Controls on the trailing edge of the title row — a switch, a clear
   *  button. They sit outside the heading, so they neither take its type nor
   *  join its accessible name. */
  actions?: ReactNode;
  /**
   * Lets text inside the panel be selected and copied. A panel is chrome by
   * default, so a drag across it moves a slider rather than painting a
   * selection; a `debug` panel defaults to selectable, since what it shows —
   * ids, keys, traces — is there to be copied.
   */
  selectable?: boolean;
  children: ReactNode;
  className?: string;
}

const PanelNesting = createContext(false);

/**
 * A titled panel holding property rows — the sidebar container the rest of
 * this module's components fill.
 *
 * `stance` says what kind of content it holds, `grade` how serious it is, `emphasis` how loudly it reads,
 * and `tint` which of its peers it is; the theme's `--wzl-panel-*` and `--wzl-stance-*` slots decide how each looks. A stanced
 * panel's title takes the row-label recipe rather than the display title.
 */
export function PropertyPanel({
  title,
  actions,
  selectable,
  children,
  className,
  density,
  align,
  stance,
  grade,
  emphasis,
  tint,
  collapsible,
  defaultCollapsed,
  collapsed,
  onCollapsedChange,
  twisty: twistyShown,
}: PropertyPanelProps) {
  const nested = useContext(PanelNesting);
  const attrs = useAppearance({ stance, grade, emphasis, tint });
  const bodyId = useId();
  const fold = useCollapse({ collapsible, defaultCollapsed, collapsed, onCollapsedChange, twisty: twistyShown });
  const { folds, folded, toggle } = fold;
  const heading = title != null && <h2 className={s.panelTitle}>{foldTitle(title, fold)}</h2>;
  // Hidden while open, the twisty trails the header: the title sits where it does with no twisty.
  const trailing = twistyShown === 'folded';
  const twisty = folds && (
    <Disclosure
      className={trailing ? `${twistyClass(fold)} ${s.foldTwistyTrailing}` : twistyClass(fold)}
      open={!folded}
      onToggle={toggle}
      label={typeof title === 'string' ? title : 'this panel'}
      controls={bodyId}
    />
  );
  const body = <PanelNesting.Provider value>{children}</PanelNesting.Provider>;
  return (
    <div
      className={propertyMetricClass(s.panel, { density, align }, className)}
      {...attrs}
      data-nested={nested || undefined}
      data-selectable={(selectable ?? stance === 'debug') || undefined}
      data-collapsed={folded || undefined}
    >
      {actions != null || folds ? (
        <div className={s.panelHeader}>
          {!trailing && twisty}
          {heading}
          {actions != null && <div className={s.panelActions}>{actions}</div>}
          {trailing && twisty}
        </div>
      ) : heading}
      {/* Folded contents stay mounted, so a control's local state survives. */}
      {folds ? (
        <div id={bodyId} className={s.panelBody} hidden={folded}>
          {body}
        </div>
      ) : body}
    </div>
  );
}

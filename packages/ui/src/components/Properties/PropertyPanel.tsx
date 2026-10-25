import { createContext, type ReactNode, useContext } from 'react';
import type { AppearanceProps } from '../appearance';
import { type Motif, MotifFrame } from '../MotifFrame';
import { type CollapseProps, foldTitle, foldTwisty, useCollapse } from './collapse';
import { type PropertyMetricProps, propertyMetricClass } from './metrics';
import s from './Properties.module.css';

/** Props for `<PropertyPanel>`. */
export interface PropertyPanelProps extends PropertyMetricProps, AppearanceProps, CollapseProps {
  title?: ReactNode;
  /** How the panel draws its title and edge. Defaults to the `panel` `<DefaultMotif>`, `sheet()` unless one is set. */
  motif?: Motif;
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
 * this module's components fill. It draws in a motif, `sheet()` unless told
 * otherwise; a titled panel is a group named by its title.
 *
 * `stance` says what kind of content it holds, `grade` how serious it is, `emphasis` how loudly it reads,
 * and `tint` which of its peers it is; the theme's `--wzl-panel-*` and `--wzl-stance-*` slots decide how each looks,
 * in whatever motif the panel draws. A stanced panel's title takes the row-label recipe rather than the display title.
 */
export function PropertyPanel({
  title,
  motif,
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
  const fold = useCollapse({ collapsible, defaultCollapsed, collapsed, onCollapsedChange, twisty: twistyShown });
  // Hidden while open, the twisty trails the header: the title sits where it does with no twisty.
  const trailing = twistyShown === 'folded';
  const body = <PanelNesting.Provider value>{children}</PanelNesting.Provider>;
  return (
    <MotifFrame
      kind="panel"
      title={title == null ? undefined : foldTitle(title, fold)}
      motif={motif}
      actions={actions}
      twistyAt={trailing ? 'end' : 'start'}
      twisty={foldTwisty(fold, title, 'this panel', trailing ? s.foldTwistyTrailing : undefined)}
      className={propertyMetricClass(s.panel, { density, align }, className)}
      attrs={{
        'data-nested': nested ? 'true' : undefined,
        'data-selectable': (selectable ?? stance === 'debug') ? 'true' : undefined,
        'data-collapsed': fold.folded ? 'true' : undefined,
      }}
      stance={stance}
      grade={grade}
      emphasis={emphasis}
      tint={tint}
    >
      {/* Folded contents stay mounted, so a control's local state survives. */}
      {fold.folds ? (
        <div className={s.panelBody} {...fold.body}>
          {body}
        </div>
      ) : body}
    </MotifFrame>
  );
}

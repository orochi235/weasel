import type { ReactNode } from 'react';
import { Split, type SplitProps } from '../primitives/Split';

/** Props for `<TrialBody>`. */
export interface TrialBodyProps
  extends Omit<SplitProps, 'sidebar' | 'children' | 'className' | 'sidebarClassName' | 'label'> {
  /** The sidebar region's sections. */
  sidebar: ReactNode;
  /** The instrument's own output. */
  children: ReactNode;
  /** Extra class on the content pane — `Trial` marks a canvas instrument's
   *  well flush. */
  contentClassName?: string;
}

/** A trial's sidebar and content as a `Split`, wearing the trial's classes. */
export function TrialBody({ sidebar, children, contentClassName, ...rest }: TrialBodyProps) {
  return (
    <Split
      {...rest}
      sidebar={sidebar}
      className="lk-trial__panes"
      sidebarClassName="lk-trial__sidebar"
      contentClassName={
        contentClassName ? `lk-trial__content ${contentClassName}` : 'lk-trial__content'
      }
    >
      {children}
    </Split>
  );
}

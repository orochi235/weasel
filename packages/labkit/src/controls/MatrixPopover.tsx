import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { Button, PropertyList } from '@weasel-js/ui';
import type { ReactNode, RefObject } from 'react';
import { Dialog as RACDialog, Popover as RACPopover } from 'react-aria-components';
import { auto as autoValue } from '../config/auto';
import { valueAtPath } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import { clearable } from './MatrixCell';
import { MatrixEditor, type OpenCell } from './MatrixEditor';

/** The popover a `ControlMatrix` cell opens: the cell's control, and what clears or unpins it. */
export function MatrixPopover({
  open,
  close,
  triggerRef,
  provide,
  schema,
  over,
  config,
  auto,
  setConfig,
  inherit,
  inheritHint,
}: {
  open: OpenCell | null;
  close: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  /** `useOverlayPortal`'s `provide`, so the popover lands in the themed container. */
  provide: (overlay: ReactNode) => ReactNode;
  schema: ResolvedConfig;
  over?: PrefGroup | PrefSection;
  config: Record<string, unknown>;
  auto: ReadonlySet<string>;
  setConfig: (path: string, value: unknown) => void;
  /** Cells inherit from the first column, so a pinned one can be handed back. */
  inherit: boolean;
  inheritHint: (open: OpenCell) => string;
}) {
  return provide(
    <RACPopover
      triggerRef={triggerRef}
      isOpen={open !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      placement="bottom"
      className="lk-control-matrix__popover"
      data-weasel-overlay=""
    >
      {open ? (
        <RACDialog
          className="lk-control-matrix__editor"
          aria-label={`${open.column.title ?? open.column.label} ${open.label}`}
        >
          <PropertyList pack="one-up">
            <MatrixEditor
              open={open}
              schema={schema}
              over={over}
              config={config}
              setConfig={setConfig}
              close={close}
            />
          </PropertyList>
          {clearable(open.cell.leaf) ? (
            <div className="lk-control-matrix__editor-actions">
              <Button
                size="sm"
                variant="ghost"
                disabled={!valueAtPath(config, open.cell.at) || auto.has(open.cell.at)}
                onClick={() => setConfig(open.cell.at, null)}
              >
                Clear
              </Button>
            </div>
          ) : null}
          {!inherit || open.first || !open.cell.own ? null : (
            <div className="lk-control-matrix__editor-actions">
              <Button
                size="sm"
                variant="ghost"
                disabled={auto.has(open.path)}
                tooltip={`Inherit ${inheritHint(open)}`}
                onClick={() => setConfig(open.path, autoValue)}
              >
                Inherit
              </Button>
            </div>
          )}
        </RACDialog>
      ) : null}
    </RACPopover>,
  );
}

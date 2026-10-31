import type { ReactElement } from 'react';
import { LastOperationPanel } from '@weasel-js/ui/components/LastOperationPanel';
import s from './LastOperation.module.css';

/** The params of the last command that has them, in the workspace's bottom-left corner. */
export function LastOperation(): ReactElement {
  return <LastOperationPanel className={s.corner} />;
}

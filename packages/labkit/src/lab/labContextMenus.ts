import type { MenuHost } from '@weasel-js/core';
import { createContext } from 'react';

/** The lab's menu host while the lab declares at least one context menu, else null.
 *  A trial's camera opens its menu here: each trial is a root of its own, whose host
 *  knows none of the lab's commands. */
export const LabContextMenusContext = createContext<MenuHost | null>(null);

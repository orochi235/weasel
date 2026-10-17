import type { Action } from './action';
import type { IconRef } from '@weasel-js/icons';

declare const ref: IconRef;
const ok: Pick<Action, 'icon'> = { icon: ref };
// @ts-expect-error a bare string is not a ref
const bare: Pick<Action, 'icon'> = { icon: 'group' };
// @ts-expect-error a node is no longer an icon
const node: Pick<Action, 'icon'> = { icon: {} as import('react').ReactNode };
void ok; void bare; void node;

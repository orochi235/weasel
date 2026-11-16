import type { PrefBase, PrefEnumBase } from './schema';
import type { IconRef } from '@weasel-js/icons';

type Leaf = Pick<PrefBase<'x', unknown>, 'icon'>;
type Choice = Pick<PrefEnumBase['options'][number], 'icon'>;

declare const ref: IconRef;
const ok: Leaf = { icon: ref };
// @ts-expect-error a bare string is not a ref
const bare: Leaf = { icon: 'group' };
const okChoice: Choice = { icon: ref };
// @ts-expect-error a bare string is not a ref
const bareChoice: Choice = { icon: 'group' };
void ok; void bare; void okChoice; void bareChoice;

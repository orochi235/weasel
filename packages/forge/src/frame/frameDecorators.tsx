import { ShellDevtools } from '@weasel-js/devtools/mount';
import type { Decorator } from '../story/types';
import type { FrameSetup } from './FrameController';

const made = new WeakMap<FrameSetup, readonly Decorator[]>();

/** The decorators every story renders inside, from `setup`: its own `decorators`, then, outermost, devtools by its
 *  `devtools` switch (`ShellDevtools`). One array per setup, so a memoized story body keeps it. */
export function frameDecorators(setup: FrameSetup): readonly Decorator[] {
  let out = made.get(setup);
  if (!out) {
    const devtools: Decorator = (story) => <ShellDevtools devtools={setup.devtools}>{story()}</ShellDevtools>;
    out = [...(setup.decorators ?? []), devtools];
    made.set(setup, out);
  }
  return out;
}

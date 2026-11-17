import { ShellDevtools } from '@weasel-js/devtools/mount';
import { createPart } from '@weasel-js/registry';
import type { Decorator } from '../story/types';
import type { FrameSetup } from './FrameController';

/** The decorators every story renders inside, from `setup`: its own `decorators`, then, outermost, devtools by its
 *  `devtools` switch (`ShellDevtools`). One array per setup, so a memoized story body keeps it. */
export const frameDecorators = createPart((setup: FrameSetup): readonly Decorator[] => {
  const devtools: Decorator = (story) => <ShellDevtools devtools={setup.devtools}>{story()}</ShellDevtools>;
  return [...(setup.decorators ?? []), devtools];
});

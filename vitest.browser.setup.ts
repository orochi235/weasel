import { configure } from '@testing-library/react';
import { beforeAll } from 'vitest';
import { commands } from 'vitest/browser';
import './scripts/vitest-resize-loops.setup.ts';
import './scripts/vitest-request-log.setup.ts';

// Testing Library's `waitFor` and `findBy*` give up after one second, the same default the
// `browser` project already raises for `expect.poll`.
configure({ asyncUtilTimeout: 5000 });

// A removed test frame keeps its Mach ports until a full GC, often thousands per file, and a tab
// whose renderer nears 15,000 loses every socket to the server ("Browser connection was closed").
beforeAll(() => commands.collectGarbage());

beforeAll(() => commands.settleFrame());

// macOS draws classic scrollbars while a mouse is connected and lays them over the box otherwise, so a
// scrollbar's 15px of width came and went with the node; every node lays out as the overlay does.
const scrollbars = document.createElement('style');
scrollbars.textContent = '* { scrollbar-width: none !important; }';
document.head.append(scrollbars);

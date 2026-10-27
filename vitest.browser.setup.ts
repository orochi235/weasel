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

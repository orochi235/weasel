import { commands } from 'vitest/browser';

// Before the test file's own import, so a tab's first file that fails to load is covered too.
await commands.watchRequests();

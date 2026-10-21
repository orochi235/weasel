import { beforeEach } from 'vitest';

// vitest 5.0.2 tests `retry.condition instanceof RegExp`, and under vmThreads the
// config's RegExp comes from another realm, so the condition never matched.
beforeEach(({ task }) => {
  const retry = task.retry;
  if (typeof retry !== 'object' || retry === null) return;
  const condition = retry.condition;
  if (condition instanceof RegExp || Object.prototype.toString.call(condition) !== '[object RegExp]') return;
  const { source, flags } = condition as RegExp;
  task.retry = { ...retry, condition: new RegExp(source, flags) };
});

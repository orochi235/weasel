import { type ConfigAnswers, stableStringify } from '../protocol/messages';
import type { SchemaAnswers } from '../protocol/schema';

export interface AnswerBook extends SchemaAnswers {
  record(answers: ConfigAnswers): void;
  subscribe(fn: () => void): () => void;
}

const KEPT_CONFIGS = 50;

/** Keeps the last 50 configs' answers. A config it has no answer for shows every node and reports no errors. */
export function createAnswerBook(): AnswerBook {
  const hiddenByConfig = new Map<string, readonly string[]>();
  let errors: Readonly<Record<string, string[]>> = {};
  const listeners = new Set<() => void>();

  return {
    record(answers) {
      hiddenByConfig.delete(answers.configKey);
      hiddenByConfig.set(answers.configKey, answers.hidden);
      if (hiddenByConfig.size > KEPT_CONFIGS) {
        const oldest = hiddenByConfig.keys().next().value;
        if (oldest !== undefined) hiddenByConfig.delete(oldest);
      }
      // The frame lists only paths with errors, so a path absent from the latest answer has none.
      errors = answers.errors;
      for (const fn of listeners) fn();
    },
    hidden(path, config) {
      const hidden = hiddenByConfig.get(stableStringify(config));
      return hidden?.some((h) => path === h || path.startsWith(`${h}.`)) ?? false;
    },
    errors: (path) => errors[path] ?? [],
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

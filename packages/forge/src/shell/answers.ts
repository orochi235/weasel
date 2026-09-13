import { type ConfigAnswers, stableStringify } from '../protocol/messages';
import type { SchemaAnswers } from '../protocol/schema';

export interface AnswerBook extends SchemaAnswers {
  record(answers: ConfigAnswers): void;
  subscribe(fn: () => void): () => void;
}

const KEPT_CONFIGS = 50;

const UNANSWERED = stableStringify({ hidden: [], errors: {} });

/** Keeps the last 50 configs' answers. A config it has no answer for shows every node and reports no errors.
 *  Subscribers hear of an answer only when it differs from the one held for its config. */
export function createAnswerBook(): AnswerBook {
  const byConfig = new Map<string, { hidden: readonly string[]; key: string }>();
  let errors: Readonly<Record<string, string[]>> = {};
  const listeners = new Set<() => void>();

  return {
    record(answers) {
      const key = stableStringify({ hidden: answers.hidden, errors: answers.errors });
      const changed = key !== (byConfig.get(answers.configKey)?.key ?? UNANSWERED);
      byConfig.delete(answers.configKey);
      byConfig.set(answers.configKey, { hidden: answers.hidden, key });
      if (byConfig.size > KEPT_CONFIGS) {
        const oldest = byConfig.keys().next().value;
        if (oldest !== undefined) byConfig.delete(oldest);
      }
      // The frame lists only paths with errors, so a path absent from the latest answer has none.
      errors = answers.errors;
      if (changed) for (const fn of listeners) fn();
    },
    hidden(path, config) {
      const hidden = byConfig.get(stableStringify(config))?.hidden;
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

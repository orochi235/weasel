import { createEmitter, getOwn } from '@weasel-js/registry';
import { type ConfigAnswers, configKey } from '../protocol/messages';
import type { SchemaAnswers } from '../protocol/schema';
import { storyConfig } from './globals';

export interface AnswerBook extends SchemaAnswers {
  disabled(path: string, config: unknown): boolean;
  resolved(path: string, config: unknown): unknown;
  record(answers: ConfigAnswers): void;
  /** Marks `config` as one an open trial shows until the returned release runs. */
  hold(config: unknown): () => void;
  subscribe(fn: () => void): () => void;
}

const KEPT_CONFIGS = 50;

const UNANSWERED = configKey({ hidden: [], errors: {}, disabled: [], resolved: {} });

interface Answer {
  hidden: readonly string[];
  errors: Readonly<Record<string, string[]>>;
  disabled: readonly string[];
  resolved: Readonly<Record<string, unknown>>;
  key: string;
}

/** Keeps the last 50 configs' answers, and the answer for every config a trial holds. A config it has no answer for
 *  shows every node and reports no errors.
 *  Subscribers hear of an answer only when it differs from the one kept for its config, and a trial holds that config. */
export function createAnswerBook(): AnswerBook {
  const byConfig = new Map<string, Answer>();
  const answered = createEmitter();
  const held = new Map<string, number>();
  const keyOf = (config: unknown) => configKey(storyConfig(config));
  const answerFor = (config: unknown) => byConfig.get(keyOf(config));

  return {
    record(answers) {
      const disabled = answers.disabled ?? [];
      const resolved = answers.resolved ?? {};
      const key = configKey({ hidden: answers.hidden, errors: answers.errors, disabled, resolved });
      const changed = key !== (byConfig.get(answers.configKey)?.key ?? UNANSWERED);
      byConfig.delete(answers.configKey);
      byConfig.set(answers.configKey, { hidden: answers.hidden, errors: answers.errors, disabled, resolved, key });
      for (const oldest of byConfig.keys()) {
        if (byConfig.size <= KEPT_CONFIGS) break;
        if (!held.has(oldest)) byConfig.delete(oldest);
      }
      if (changed && held.has(answers.configKey)) answered.emit();
    },
    hold(config) {
      const key = keyOf(config);
      held.set(key, (held.get(key) ?? 0) + 1);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const count = (held.get(key) ?? 1) - 1;
        if (count > 0) held.set(key, count);
        else held.delete(key);
      };
    },
    hidden(path, config) {
      const hidden = answerFor(config)?.hidden;
      return hidden?.some((h) => path === h || path.startsWith(`${h}.`)) ?? false;
    },
    disabled(path, config) {
      return answerFor(config)?.disabled.includes(path) ?? false;
    },
    resolved(path, config) {
      const resolved = answerFor(config)?.resolved;
      return resolved ? getOwn(resolved, path) : undefined;
    },
    errors(path, config) {
      const errors = answerFor(config)?.errors;
      return errors && Object.hasOwn(errors, path) ? errors[path]! : [];
    },
    subscribe: answered.subscribe,
  };
}

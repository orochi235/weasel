import { page, userEvent } from 'vitest/browser';
import { describeA11y } from './a11y.suite';

describeA11y(4, { page, userEvent });

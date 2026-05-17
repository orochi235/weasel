// Wires `@storybook/addon-vitest` to run every `*.stories.tsx` as a test.
// Imports the preview config so global decorators (font picker, etc.) apply.
import { setProjectAnnotations } from '@storybook/react-vite';
import { beforeAll } from 'vitest';
import * as previewAnnotations from './preview';

const project = setProjectAnnotations([previewAnnotations]);

beforeAll(project.beforeAll);

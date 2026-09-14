import { afterEach, describe, expect, it } from 'vitest';
import { documentSheets, tokensReadAt } from './inspect';

describe('tokensReadAt', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('collects the tokens rules matching the element and its ancestors read, up to the pane', () => {
    document.head.innerHTML = `<style>
      .pane { background-color: var(--wzl-surface); }
      .btn { color: var(--wzl-fg); background-color: var(--wzl-accent); }
      .panel { --wzl-local: var(--wzl-gray-100); padding-top: var(--wzl-space-md); }
      .elsewhere { color: var(--wzl-danger); }
    </style>`;
    document.body.innerHTML = '<div class="pane"><div class="panel"><button class="btn"><span id="t">x</span></button></div></div>';
    const target = document.getElementById('t')!;
    const pane = document.querySelector('.pane')!;
    expect(tokensReadAt(target, pane, documentSheets())).toEqual(['fg', 'accent', 'space-md']);
  });
});

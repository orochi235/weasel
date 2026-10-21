import { ActionDisabledReason, nextPageId, useCommand } from '@weasel-js/core';
import { CHART_PAGE } from '../chartDocument';
import { run, type MenuRuns } from '../menuBar';
import type { PipelineDoc } from './usePipelineDoc';

export const PIPELINE_PAGE_ACTIONS = { add: 'pipeline.page.add', remove: 'pipeline.page.delete' } as const;

/** Pipeline mode's Page menu. */
export const PIPELINE_PAGE_MENU: MenuRuns = {
  edit: run({ add: PIPELINE_PAGE_ACTIONS.add, remove: PIPELINE_PAGE_ACTIONS.remove }),
};

/** Registers Add Page, which appends a page sized like the last, and Delete Page, which drops the last. Stages stay where they are. */
export function usePipelinePageCommands(pipeline: PipelineDoc): void {
  const { doc, change } = pipeline;
  const pages = doc.pages ?? [];
  useCommand(PIPELINE_PAGE_ACTIONS.add, 'Add Page', () => {
    const like = pages[pages.length - 1] ?? CHART_PAGE;
    change({ ...doc, pages: [...pages, { id: nextPageId(pages), width: like.width, height: like.height }] }, 'Add Page');
  });
  useCommand(PIPELINE_PAGE_ACTIONS.remove, 'Delete Page', () => {
    change({ ...doc, pages: pages.slice(0, -1) }, 'Delete Page');
  }, { enabled: () => pages.length > 0 || ActionDisabledReason.NotApplicable });
}

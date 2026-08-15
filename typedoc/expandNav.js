// The sidebar tree is built client-side after load, and every category
// accordion is created closed. TypeDoc has no option for the initial state, so
// each one is opened as it appears — and its remembered state is seeded to
// match, since the accordion reads that back on the next page.
(() => {
  const container = document.getElementById('tsd-nav-container');
  if (!container) return;

  const open = (details) => {
    if (details.open) return;
    details.open = true;
    const key = details.querySelector('summary')?.dataset.key;
    if (key && localStorage.getItem(`tsd-accordion-${key}`) === null) {
      localStorage.setItem(`tsd-accordion-${key}`, 'true');
    }
  };

  for (const details of container.querySelectorAll('details.tsd-accordion')) open(details);

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches('details.tsd-accordion')) open(node);
        for (const details of node.querySelectorAll('details.tsd-accordion')) open(details);
      }
    }
  }).observe(container, { childList: true, subtree: true });
})();

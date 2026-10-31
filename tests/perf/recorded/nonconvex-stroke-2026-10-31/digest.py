#!/usr/bin/env python3
"""Before/after digest of the result files under each node directory here: each aligned-stroke
variant's frame and draws, and each derived per-stroke figure."""
import glob, json, os
here = os.path.dirname(os.path.abspath(__file__))
WANT = ('astroke', 'stroke over centered')

for node in sorted(d for d in os.listdir(here) if os.path.isdir(os.path.join(here, d))):
    def load(label):
        f = glob.glob(os.path.join(here, node, label, 'clip-cost-*.json'))[0]
        return {i['id']: i['metrics'] for i in json.load(open(f))['items']}
    runs = {l: load(l) for l in ['before-1', 'before-2', 'after-1', 'after-2']}
    print(f'\n## {node}\n')
    print(f'| item | metric | {"before":>15} | {"after":>15} |')
    print('|---|---|---:|---:|')
    for item, metrics in runs['before-1'].items():
        if not any(w in item for w in WANT):
            continue
        for m in metrics:
            if m not in ('perFrame', 'perStroke', 'drawCalls'):
                continue
            cell = lambda side: '–'.join(f"{runs[f'{side}-{k}'][item][m]['value']:.3f}" for k in (1, 2))
            print(f"| {item} | {m} | {cell('before'):>15} | {cell('after'):>15} |")

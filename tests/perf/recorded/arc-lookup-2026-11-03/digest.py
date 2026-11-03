#!/usr/bin/env python3
"""Per node and item, the median over runs of each run's median batch, before and after, from runs.jsonl."""
import json, os, statistics
here = os.path.dirname(os.path.abspath(__file__))

for node in sorted(d for d in os.listdir(here) if os.path.isdir(os.path.join(here, d))):
    rows = [json.loads(l) for l in open(os.path.join(here, node, 'runs.jsonl'))]
    items = list(dict.fromkeys(r['item'] for r in rows))
    print(f'\n## {node}\n')
    print(f'| item | {"before us":>12} | {"after us":>12} | runs |')
    print('|---|---:|---:|---:|')
    for item in items:
        med = {}
        for side in ('before', 'after'):
            per = [statistics.median(r['us']) for r in rows if r['item'] == item and r['label'].startswith(side)]
            med[side] = (statistics.median(per), len(per))
        print(f"| {item} | {med['before'][0]:12.4f} | {med['after'][0]:12.4f} | {med['after'][1]:>4} |")

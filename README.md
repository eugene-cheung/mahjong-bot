# mahjong-bot

**Experiment lab** for a mahjong decision engine — search-based EV teacher, self-play dataset, and neural policy/value distillation.

Sibling game client: [mahjong-table](https://github.com/eugene-cheung/mahjong-table) · Live demo: https://mj-house.fly.dev

## Why this repo exists

Most mahjong bots stop at heuristics. This one is structured like an ML research loop:

1. **Strong teacher** — multi-signal expected-value search (shanten, fan, ukeire, defense, match context) + optional Monte Carlo
2. **Self-play data** — seat-relative bitboard planes, full legal-action EVs, softmax exploration, credit-assigned rewards
3. **Distillation** — PyTorch policy+value student trained to match the teacher ranking (not just argmax BC)

```
self-play (TS) ──JSONL──▶ join-rewards ──▶ distill (PyTorch)
       ▲                                         │
       └──────── benchmarks / gates ◀────────────┘
```

## Experiments

| Exp | What | Status |
|-----|------|--------|
| [000 heuristic EV](experiments/000_heuristic_ev/) | Teacher bot — **6–0 vs random** frozen baseline | done |
| [001 self-play dataset](experiments/001_self_play_dataset/) | Schema-v2 trajectories for training | done |
| [002 policy distill](experiments/002_policy_distill/) | Neural student imitating EV teacher + value head | active |

See [`experiments/README.md`](experiments/README.md).

## Quick start

```bash
# TypeScript engine + benches
npm install && npm test
npm run bench

# Self-play → training rows
MATCHES=50 TEMPERATURE=1.2 npm run self-play
npm run join-rewards -- data/self-play.jsonl data/training.jsonl

# Neural distill
python3 -m venv .venv && source .venv/bin/activate
pip install -r ml/requirements.txt
python -m ml.train --data data/training.jsonl --out experiments/002_policy_distill/runs
```

```typescript
import { heuristicStrategy, createHeuristicStrategy } from "mahjong-bot";

createHeuristicStrategy({ profile: "aggressive" });
createHeuristicStrategy({ search: "mc", mcRollouts: 32 });
```

## Stack

TypeScript (engine, EV, self-play) · bitboards · PyTorch (policy/value distill) · JSONL datasets · headless match sims

## License

MIT

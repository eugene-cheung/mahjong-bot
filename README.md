# mahjong-bot

Heuristic mahjong AI for [mahjong-table](../mahjong-table) — EV decision-making, bitboard search, and a self-play data pipeline built for ML.

## Highlights

| Area | What it does |
|------|----------------|
| **Unified shanten** | Standard 4-sets+pair, **seven pairs**, **thirteen orphans** — pick the best line |
| **Expected value** | Scores every legal action: shanten, fan ceiling, draw odds, deal-in danger, match context |
| **Bitboards** | `Uint8Array(34)` hand / wall state for fast eval and Monte Carlo rollouts |
| **Win-rate model** | Exact \(P(\text{tenpai})\), \(P(\text{improve})\) on next draw from remaining tiles |
| **Monte Carlo** | Optional rollout search blended with EV (`search: "mc"`) |
| **Self-play v2** | Softmax exploration (dynamic \(\tau\)), claim frames, counterfactual EVs, hand/match rewards |
| **Benchmarked** | Heuristic **6–0** vs random (5 matches, +80/−80) — frozen baseline in `benchmarks/` |

```
DecisionPrompt + public view
        │
        ▼
 tile-tracker → shanten → fan · win-rate · threat
        │
        ▼
   EV scorer  (+ optional MC)
        │
        ▼
   best action  │  self-play JSONL → join-rewards → train later
```

## Quick start

```bash
npm install && npm run build
npm test                  # unit + engine contract + bench gate
npm run bench             # heuristic vs random
```

```typescript
import { heuristicStrategy, createHeuristicStrategy } from "mahjong-bot";

createHeuristicStrategy({ profile: "aggressive" }); // speed | balanced | aggressive | defensive
createHeuristicStrategy({ search: "mc", mcRollouts: 32 });
```

`mahjong-table` loads `heuristicStrategy` by default.

## Self-play → ML-ready data

```bash
MATCHES=50 TEMPERATURE=1.2 npm run self-play
npm run join-rewards -- data/self-play.jsonl data/training.jsonl
npm run bench:record -- "after tune"   # delta vs baseline
```

Each decision logs seat-relative state planes (base64), full `legal[]` with EVs, chosen index, and joined hand/match rewards — built for policy distillation / value learning, not just telemetry.

## Stack

TypeScript · bitboard counts · softmax exploration · JSONL self-play · headless table sims

## License

MIT

# mahjong-bot

Heuristic mahjong bot for [mahjong-table](../mahjong-table). Unified shanten, EV scoring, optional Monte Carlo, and **v2 self-play** data collection for ML.

## Quick start

```bash
npm install
npm run build
npm test              # full suite (~2 min)
npm run test:unit     # unit only (~3s)
```

### Self-play data pipeline (v2)

```bash
# Collect exploration data (softmax sampling, auto-creates data/)
MATCHES=50 TEMPERATURE=1.2 npm run self-play

# Join decisions → training rows with hand/match rewards
npm run join-rewards -- data/self-play.jsonl data/training.jsonl

# Suggest heuristic weight tweaks
npm run tune -- data/self-play.jsonl
```

### Benchmark baseline (track improvement)

Your first run is saved as the reference point:

**`benchmarks/baseline-v0.3-pre-self-play.json`** — 6–0 wins, +80/−80 (2026-07-05)

After self-play or weight tuning, record a new run and compare:

```bash
npm run bench:record -- "after 50-match self-play tune"
```

Writes `benchmarks/runs/<timestamp>.json` and prints delta vs baseline.

| Env var | Default | Purpose |
|---------|---------|---------|
| `MATCHES` | 3 | Number of 4-bot matches |
| `MAX_ACTIONS` | 400 | Safety cap per match |
| `OUT` | `data/self-play.jsonl` | Output path |
| `TEMPERATURE` | 1.2 | Base softmax τ (dynamic schedule applied) |
| `DETERMINISTIC` | off | Set `1` for argmax (eval runs) |

## v2 JSONL schema

**Decision row** — one per bot choice (draw, discard, claim, pass):

- `state.hand` — base64 concealed counts (34 bytes)
- `state.discards` — 4× base64 planes (self, right, across, left)
- `state.melds` — `[relSeat, kind, tileIdx, open]` tuples
- `state.remaining` / `state.exhausted` — wall + kabe planes
- `state.scalars` — wall, shanten, scores, dealer, phase, open melds
- `legal[]` — every action with **counterfactual EV**
- `chosen` — index into `legal`
- `claim` — `{ from, tile }` on claim windows
- `tau`, `sampled` — exploration metadata

**Hand end** — `scoreDelta[4]` per seat after each scored hand.

**Match end** — `placement[4]`, `finalScores`, `startScores`.

**Training row** (from `join-rewards`) — decision + `handReward` + `matchReward` + `placement`.

## API

```typescript
import { createSelfPlayStrategy, joinRewards, SCHEMA_VERSION } from "mahjong-bot";

const strategy = createSelfPlayStrategy({
  matchId: "run-1",
  temperature: 1.2,
  deterministic: false,
  onLog: (row) => { /* JSONL */ },
  getDecisionIndex: () => n,
  bumpDecisionIndex: () => { n++; },
  getInitialWall: () => 80,
});
```

Production play still uses `heuristicStrategy` (argmax EV, no logging).

## License

MIT

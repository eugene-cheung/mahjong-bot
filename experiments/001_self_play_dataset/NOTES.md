# 001 — Self-play dataset v2

**Status:** done  
**Hypothesis:** Softmax exploration over EV produces ML-ready trajectories with counterfactual action values and credit-assigned rewards.

## Method

1. Four heuristic bots play headless matches (`npm run self-play`)
2. At each decision: encode seat-relative state planes + full `legal[]` with EVs
3. Sample action via softmax(EV / τ) (dynamic temperature)
4. Emit `decision` / `hand_end` / `match_end` JSONL (schema v2)
5. `join-rewards` attaches `handReward`, `matchReward`, `placement`

## State encoding (relative to acting seat)

| Field | Shape | Meaning |
|-------|-------|---------|
| `hand` | 34 | Concealed counts (base64) |
| `discards` | 4×34 | Self / right / across / left |
| `remaining` / `exhausted` | 34 | Wall residual + kabe mask |
| `melds` | variable | `[relSeat, kind, tileIdx, open]` |
| `scalars` | 10 | wall, shanten, scores, dealer, phase, open melds |
| `claim?` | 2 | Relative discarder + tile |

## Artifacts

Local only (gitignored under `data/`):

- `data/self-play-run1.jsonl` — ~12k lines
- `data/training-run1.jsonl` — reward-joined rows for training

## Takeaway

Dataset is built for **policy distillation** and **value learning**, not telemetry. Exp 002 consumes these rows.

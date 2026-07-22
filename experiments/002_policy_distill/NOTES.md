# 002 — Policy / value distillation

**Status:** active (baseline run logged)  
**Hypothesis:** A compact neural net can imitate the EV teacher’s action ranking and predict hand/match returns from seat-relative features — without seeing teacher EV as an input feature.

## Method

- **Teacher:** heuristic EV scores on each legal action (logged in training JSONL)
- **Student:** shared torso + action scorer + value head (`ml/`)
- **Losses:**
  - cross-entropy on explored `chosen` action
  - KL to `softmax(EV / τ)` (distill full ranking)
  - MSE on `handReward + matchReward`
- Variable action sets handled by masking
- **No EV leak:** action features are type + tile only

## Metrics definition

- `top1` / `top3`: student argmax vs **teacher argmax(EV)**
- `*_multi`: same, but only decisions with ≥2 legal actions (excludes trivial draw/pass)

## Run

```bash
source .venv/bin/activate
python -m ml.train \
  --data data/training-run1.jsonl \
  --out experiments/002_policy_distill/runs \
  --epochs 12 \
  --batch-size 256
```

## Results (latest)

See [`metrics.latest.json`](metrics.latest.json):

| Metric | Value |
|--------|-------|
| rows | 12,011 |
| holdout top-1 (multi) | **~0.40** |
| holdout top-3 (multi) | **~0.67** |
| value MSE | **46 → 1.8** over 12 epochs |

Random baseline for ~14-way discard choices is ~0.07 top-1 — student is ~5–6× better while value head clearly fits returns.

## Next

- Larger self-play corpus + lower τ for sharper teacher
- Action-type conditioned heads (discard vs claim)
- Plug student into `mahjong-table` via ONNX / TS port and bench vs heuristic

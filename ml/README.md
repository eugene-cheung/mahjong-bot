# ml — policy / value distillation

Train a neural student on self-play JSONL produced by the TypeScript engine.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt
```

## Train

```bash
# use joined training rows from npm run join-rewards
python -m ml.train --data data/training-run1.jsonl --out experiments/002_policy_distill/runs
```

## What you get

- `checkpoint.pt` — policy+value weights
- `metrics.json` — holdout top-1 / top-3 / KL / value MSE by epoch
- Console summary suitable for pasting into experiment NOTES

See `experiments/002_policy_distill/NOTES.md`.

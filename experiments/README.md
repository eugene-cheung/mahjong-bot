# Experiments

Tracked ML / search experiments for the mahjong decision engine.

| ID | Name | Status | One-liner |
|----|------|--------|-----------|
| [`000`](000_heuristic_ev/) | Heuristic EV baseline | done | Multi-signal EV scorer + optional MC; 6–0 vs random |
| [`001`](001_self_play_dataset/) | Self-play dataset v2 | done | Softmax exploration → seat-relative planes + counterfactual EVs |
| [`002`](002_policy_distill/) | Policy / value distill | active | Distill EV teacher into a neural policy+value net |

## How to run an experiment

```bash
# 1. Generate or reuse self-play JSONL
MATCHES=50 TEMPERATURE=1.2 npm run self-play
npm run join-rewards -- data/self-play.jsonl data/training.jsonl

# 2. Train (exp 002)
python3 -m venv .venv && source .venv/bin/activate
pip install -r ml/requirements.txt
python -m ml.train --data data/training.jsonl --out experiments/002_policy_distill/runs

# 3. Record a bot bench delta
npm run bench
npm run bench:record -- "after distill"
```

Every experiment folder has `NOTES.md` (hypothesis → method → metrics) and optional `runs/` artifacts.
Do not commit large JSONL or checkpoints — keep metrics + NOTES.

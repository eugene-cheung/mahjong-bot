"""JSONL dataset of reward-joined self-play decisions."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch.utils.data import Dataset

from .features import (
    ACTION_DIM,
    STATE_DIM,
    _safe_float,
    encode_action,
    encode_state,
    teacher_logits,
)


class DecisionBatch(dict):
    """Typed convenience; values are tensors."""


class SelfPlayDataset(Dataset):
    def __init__(self, path: str | Path, max_actions: int = 24):
        self.max_actions = max_actions
        self.rows: list[dict[str, Any]] = []
        path = Path(path)
        with path.open() as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                row = json.loads(line)
                if row.get("kind") != "training":
                    continue
                if not row.get("legal"):
                    continue
                self.rows.append(row)

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        row = self.rows[idx]
        legal = row["legal"]
        n = min(len(legal), self.max_actions)
        legal = legal[:n]

        state = encode_state(row["state"], row.get("claim"))
        evs = np.asarray([_safe_float(a.get("ev"), 0.0) for a in legal], dtype=np.float32)
        ev_mean = float(evs.mean()) if n else 0.0
        ev_std = float(evs.std()) if n > 1 else 1.0

        actions = np.zeros((self.max_actions, ACTION_DIM), dtype=np.float32)
        mask = np.zeros(self.max_actions, dtype=np.float32)
        for i, action in enumerate(legal):
            actions[i] = encode_action(action, ev_mean, ev_std)
            mask[i] = 1.0

        teacher = np.full(self.max_actions, -1e9, dtype=np.float32)
        logits = teacher_logits(legal, row.get("tau", 1.0))
        teacher[:n] = logits

        chosen = int(row.get("chosen", 0))
        if chosen >= n:
            chosen = int(np.argmax(evs)) if n else 0

        reward = float(row.get("handReward", 0.0)) + float(row.get("matchReward", 0.0))

        return {
            "state": torch.from_numpy(state),
            "actions": torch.from_numpy(actions),
            "mask": torch.from_numpy(mask),
            "teacher_logits": torch.from_numpy(teacher),
            "chosen": torch.tensor(chosen, dtype=torch.long),
            "value_target": torch.tensor(reward, dtype=torch.float32),
        }


def collate(batch: list[dict[str, torch.Tensor]]) -> dict[str, torch.Tensor]:
    return {
        "state": torch.stack([b["state"] for b in batch]),
        "actions": torch.stack([b["actions"] for b in batch]),
        "mask": torch.stack([b["mask"] for b in batch]),
        "teacher_logits": torch.stack([b["teacher_logits"] for b in batch]),
        "chosen": torch.stack([b["chosen"] for b in batch]),
        "value_target": torch.stack([b["value_target"] for b in batch]),
    }


def split_dataset(ds: SelfPlayDataset, val_frac: float = 0.1, seed: int = 0):
    n = len(ds)
    idx = np.arange(n)
    rng = np.random.default_rng(seed)
    rng.shuffle(idx)
    cut = max(1, int(n * (1.0 - val_frac))) if n > 10 else n
    train_idx = idx[:cut].tolist()
    val_idx = idx[cut:].tolist() or train_idx[-max(1, n // 10) :]
    return torch.utils.data.Subset(ds, train_idx), torch.utils.data.Subset(ds, val_idx)


# silence unused import lint for STATE_DIM re-export consumers
__all__ = ["SelfPlayDataset", "collate", "split_dataset", "STATE_DIM", "ACTION_DIM"]

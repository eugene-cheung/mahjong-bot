"""Feature decoding for self-play training rows (schema v2)."""

from __future__ import annotations

import base64
from typing import Any

import numpy as np

NUM_TILE_TYPES = 34
NUM_SCALARS = 10
NUM_DISC_SEATS = 4
STATE_DIM = NUM_TILE_TYPES * (1 + NUM_DISC_SEATS + 2) + NUM_SCALARS + 2  # 250
ACTION_TYPE_VOCAB = {
    "discard": 0,
    "draw": 1,
    "pass_claim": 2,
    "chow": 3,
    "pung": 4,
    "kong": 5,
    "hu": 6,
    "flower_win": 7,
    "declare_ready": 8,
    "other": 9,
}
NUM_ACTION_TYPES = len(ACTION_TYPE_VOCAB)
ACTION_DIM = NUM_ACTION_TYPES + 1  # type one-hot + tile(norm); EV is teacher-only


def b64_to_counts(encoded: str) -> np.ndarray:
    raw = base64.b64decode(encoded)
    arr = np.frombuffer(raw, dtype=np.uint8).astype(np.float32)
    if arr.shape[0] != NUM_TILE_TYPES:
        out = np.zeros(NUM_TILE_TYPES, dtype=np.float32)
        out[: min(NUM_TILE_TYPES, arr.shape[0])] = arr[:NUM_TILE_TYPES]
        return out
    return arr


def encode_state(state: dict[str, Any], claim: dict[str, Any] | None) -> np.ndarray:
    parts = [
        b64_to_counts(state["hand"]),
        *[b64_to_counts(d) for d in state["discards"]],
        b64_to_counts(state["remaining"]),
        b64_to_counts(state["exhausted"]),
    ]
    scalars = np.asarray(state["scalars"], dtype=np.float32)
    if scalars.shape[0] < NUM_SCALARS:
        pad = np.zeros(NUM_SCALARS, dtype=np.float32)
        pad[: scalars.shape[0]] = scalars
        scalars = pad
    else:
        scalars = scalars[:NUM_SCALARS].copy()
    # light normalization for scores / wall
    scalars[0] = scalars[0] / 144.0
    scalars[1] = scalars[1] / 8.0
    for i in range(2, 6):
        scalars[i] = np.tanh(scalars[i] / 48.0)
    claim_feat = np.zeros(2, dtype=np.float32)
    if claim:
        claim_feat[0] = float(claim.get("from", 0)) / 3.0
        claim_feat[1] = float(claim.get("tile", 0)) / float(NUM_TILE_TYPES - 1)
    return np.concatenate([*parts, scalars, claim_feat]).astype(np.float32)


def _safe_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def encode_action(action: dict[str, Any], _ev_mean: float = 0.0, _ev_std: float = 1.0) -> np.ndarray:
    """Action features visible to the student — no teacher EV (that would leak the label)."""
    typ = ACTION_TYPE_VOCAB.get(str(action.get("type", "other")), ACTION_TYPE_VOCAB["other"])
    one_hot = np.zeros(NUM_ACTION_TYPES, dtype=np.float32)
    one_hot[typ] = 1.0
    tile = action.get("tile")
    tile_n = float(tile) / float(NUM_TILE_TYPES - 1) if tile is not None else -0.1
    return np.concatenate([one_hot, np.asarray([tile_n], dtype=np.float32)])


def teacher_logits(legal: list[dict[str, Any]], tau: float) -> np.ndarray:
    evs = np.asarray([_safe_float(a.get("ev"), 0.0) for a in legal], dtype=np.float32)
    t = max(float(tau), 1e-3)
    return evs / t

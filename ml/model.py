"""Compact policy + value network over masked legal actions."""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from .features import ACTION_DIM, STATE_DIM


class PolicyValueNet(nn.Module):
    def __init__(self, state_dim: int = STATE_DIM, action_dim: int = ACTION_DIM, hidden: int = 256):
        super().__init__()
        self.state_enc = nn.Sequential(
            nn.Linear(state_dim, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
        )
        self.action_enc = nn.Sequential(
            nn.Linear(action_dim, hidden // 2),
            nn.ReLU(),
            nn.Linear(hidden // 2, hidden // 2),
            nn.ReLU(),
        )
        self.score = nn.Sequential(
            nn.Linear(hidden + hidden // 2, hidden // 2),
            nn.ReLU(),
            nn.Linear(hidden // 2, 1),
        )
        self.value = nn.Sequential(
            nn.Linear(hidden, hidden // 2),
            nn.ReLU(),
            nn.Linear(hidden // 2, 1),
        )

    def forward(
        self, state: torch.Tensor, actions: torch.Tensor, mask: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor]:
        # state: [B, S], actions: [B, A, Da], mask: [B, A]
        b, a, _ = actions.shape
        h = self.state_enc(state)  # [B, H]
        flat = actions.reshape(b * a, -1)
        ha = self.action_enc(flat).reshape(b, a, -1)
        h_exp = h.unsqueeze(1).expand(-1, a, -1)
        logits = self.score(torch.cat([h_exp, ha], dim=-1)).squeeze(-1)
        logits = logits.masked_fill(mask < 0.5, -1e9)
        value = self.value(h).squeeze(-1)
        return logits, value


def distillation_loss(
    logits: torch.Tensor,
    teacher_logits: torch.Tensor,
    mask: torch.Tensor,
    chosen: torch.Tensor,
    value: torch.Tensor,
    value_target: torch.Tensor,
    *,
    kl_weight: float = 0.5,
    value_weight: float = 0.25,
) -> tuple[torch.Tensor, dict[str, float]]:
    log_p = F.log_softmax(logits, dim=-1)
    teacher = teacher_logits.masked_fill(mask < 0.5, -1e9)
    p_t = F.softmax(teacher, dim=-1)
    kl = F.kl_div(log_p, p_t, reduction="batchmean")
    ce = F.cross_entropy(logits, chosen)
    v = F.mse_loss(value, value_target)
    loss = ce + kl_weight * kl + value_weight * v
    with torch.no_grad():
        pred = logits.argmax(dim=-1)
        teacher_argmax = teacher.argmax(dim=-1)
        top1 = (pred == teacher_argmax).float().mean().item()
        k = min(3, logits.size(-1))
        topk = logits.topk(k, dim=-1).indices
        top3 = (topk == teacher_argmax.unsqueeze(-1)).any(dim=-1).float().mean().item()
        n_legal = mask.sum(dim=-1)
        multi = n_legal >= 2
        if multi.any():
            top1_multi = (pred[multi] == teacher_argmax[multi]).float().mean().item()
            top3_multi = (
                (topk[multi] == teacher_argmax[multi].unsqueeze(-1)).any(dim=-1).float().mean().item()
            )
            multi_frac = multi.float().mean().item()
        else:
            top1_multi = top1
            top3_multi = top3
            multi_frac = 0.0
        # exploration match (chosen may be sampled ≠ teacher argmax)
        chosen_match = (pred == chosen).float().mean().item()
    return loss, {
        "loss": float(loss.item()),
        "ce": float(ce.item()),
        "kl": float(kl.item()),
        "value_mse": float(v.item()),
        "top1": top1,
        "top3": top3,
        "top1_multi": top1_multi,
        "top3_multi": top3_multi,
        "multi_frac": multi_frac,
        "chosen_match": chosen_match,
    }

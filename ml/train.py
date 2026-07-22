"""Train policy+value student on self-play training JSONL."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from .dataset import SelfPlayDataset, collate, split_dataset
from .model import PolicyValueNet, distillation_loss


def evaluate(model: PolicyValueNet, loader: DataLoader, device: torch.device) -> dict[str, float]:
    model.eval()
    totals = {
        "loss": 0.0,
        "ce": 0.0,
        "kl": 0.0,
        "value_mse": 0.0,
        "top1": 0.0,
        "top3": 0.0,
        "top1_multi": 0.0,
        "top3_multi": 0.0,
        "multi_frac": 0.0,
        "chosen_match": 0.0,
    }
    n = 0
    with torch.no_grad():
        for batch in loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            logits, value = model(batch["state"], batch["actions"], batch["mask"])
            _, metrics = distillation_loss(
                logits,
                batch["teacher_logits"],
                batch["mask"],
                batch["chosen"],
                value,
                batch["value_target"],
            )
            for k, v in metrics.items():
                totals[k] += v
            n += 1
    if n == 0:
        return totals
    return {k: v / n for k, v in totals.items()}


def main() -> None:
    parser = argparse.ArgumentParser(description="Distill mahjong EV teacher into policy+value net")
    parser.add_argument("--data", required=True, help="Path to training JSONL")
    parser.add_argument("--out", required=True, help="Output directory for run artifacts")
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--hidden", type=int, default=256)
    parser.add_argument("--max-actions", type=int, default=24)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    ds = SelfPlayDataset(args.data, max_actions=args.max_actions)
    if len(ds) == 0:
        raise SystemExit(f"No training rows found in {args.data}")
    train_ds, val_ds = split_dataset(ds, seed=args.seed)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, collate_fn=collate)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, collate_fn=collate)

    model = PolicyValueNet(hidden=args.hidden).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr)

    run_id = time.strftime("%Y%m%d-%H%M%S")
    out_dir = Path(args.out) / run_id
    out_dir.mkdir(parents=True, exist_ok=True)

    history: list[dict] = []
    best_top1 = -1.0

    print(f"rows={len(ds)} train={len(train_ds)} val={len(val_ds)} device={device}")

    for epoch in range(1, args.epochs + 1):
        model.train()
        running = {
            "loss": 0.0,
            "top1": 0.0,
            "top3": 0.0,
            "top1_multi": 0.0,
            "top3_multi": 0.0,
            "chosen_match": 0.0,
        }
        steps = 0
        for batch in train_loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            logits, value = model(batch["state"], batch["actions"], batch["mask"])
            loss, metrics = distillation_loss(
                logits,
                batch["teacher_logits"],
                batch["mask"],
                batch["chosen"],
                value,
                batch["value_target"],
            )
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            for key in running:
                running[key] += metrics[key]
            steps += 1

        train_metrics = {k: v / max(steps, 1) for k, v in running.items()}
        val_metrics = evaluate(model, val_loader, device)
        row = {"epoch": epoch, "train": train_metrics, "val": val_metrics}
        history.append(row)
        print(
            f"epoch {epoch:02d}  "
            f"train_top1={train_metrics['top1']:.3f}  "
            f"val_top1={val_metrics['top1']:.3f}  "
            f"val_top1_multi={val_metrics['top1_multi']:.3f}  "
            f"val_top3_multi={val_metrics['top3_multi']:.3f}  "
            f"val_mse={val_metrics['value_mse']:.4f}"
        )

        if val_metrics["top1_multi"] >= best_top1:
            best_top1 = val_metrics["top1_multi"]
            torch.save(
                {
                    "model": model.state_dict(),
                    "config": vars(args),
                    "val": val_metrics,
                    "epoch": epoch,
                },
                out_dir / "checkpoint.pt",
            )

    summary = {
        "run_id": run_id,
        "data": str(args.data),
        "rows": len(ds),
        "best_val_top1_multi": best_top1,
        "final": history[-1] if history else {},
        "history": history,
        "gates": {
            "top1_multi_target": 0.40,
            "top3_multi_target": 0.70,
            "top1_multi_pass": best_top1 >= 0.40,
            "top3_multi_pass": (history[-1]["val"]["top3_multi"] if history else 0) >= 0.70,
        },
    }
    (out_dir / "metrics.json").write_text(json.dumps(summary, indent=2))
    latest = {
        "run_id": run_id,
        "rows": len(ds),
        "best_val_top1_multi": best_top1,
        "final_val": history[-1]["val"] if history else {},
        "gates": summary["gates"],
        "note": "top1/top3 = agreement with teacher argmax(EV); multi_* excludes singleton legal sets",
    }
    out_root = Path(args.out)
    latest_path = out_root.parent / "metrics.latest.json" if out_root.name == "runs" else out_root / "metrics.latest.json"
    latest_path.write_text(json.dumps(latest, indent=2))
    print(f"wrote {out_dir / 'metrics.json'}")
    print(f"wrote {latest_path}")
    print(f"best_val_top1_multi={best_top1:.3f}  gates={summary['gates']}")


if __name__ == "__main__":
    main()

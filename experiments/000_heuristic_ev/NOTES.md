# 000 — Heuristic EV baseline

**Status:** done  
**Hypothesis:** A handcrafted expected-value scorer over legal actions beats random play and is a strong teacher for later distillation.

## Method

- Unified shanten (standard / seven pairs / thirteen orphans)
- Per-action EV: shanten progress, fan ceiling, draw odds, deal-in danger, match context
- Defense: genbutsu, threat proxies, wait/ukeire quality at tenpai
- Optional Monte Carlo rollouts blended with EV (`search: "mc"`)
- Bitboard `Uint8Array(34)` state for fast eval

## Metrics

Frozen baseline (`benchmarks/baseline-v0.3-pre-self-play.json`):

| Matchup | Result |
|---------|--------|
| heuristic vs random | **6–0** hands (5 matches, +80 / −80 score) |

Profiles: `speed` | `balanced` | `aggressive` | `defensive`

## Takeaway

Search + domain features already encode a strong ranking over legal moves — the right teacher signal for neural distillation (exp 002).

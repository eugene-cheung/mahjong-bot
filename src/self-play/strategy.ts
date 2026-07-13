import type { BotStrategy, DecisionPrompt, LegalAction } from "../protocol.js";
import { scoreAllActions } from "../eval/ev-scorer.js";
import { resolveWeights } from "../eval/match-context.js";
import { TileTracker } from "../eval/tile-tracker.js";
import type { BotProfile } from "../eval/profiles.js";
import { DEFAULT_PROFILE } from "../eval/profiles.js";
import { encodeClaimContext, encodeState, seatIndex } from "./encoding.js";
import { encodeLegalAction, findActionIndex } from "./actions.js";
import { tileToIndex } from "../tiles.js";
import { argmaxIndex, computeTemperature, softmaxSample } from "./softmax.js";
import type { DecisionRecordV2, SelfPlayRecordV2 } from "./records.js";
import { SCHEMA_VERSION } from "./records.js";

function pickInstantWin(actions: LegalAction[]): LegalAction | undefined {
  return (
    actions.find((a) => a.command.type === "flower_win" && a.label.includes("Eight")) ??
    actions.find((a) => a.command.type === "flower_win") ??
    actions.find((a) => a.command.type === "hu")
  );
}

export interface SelfPlayStrategyOptions {
  matchId: string;
  onLog: (entry: SelfPlayRecordV2) => void;
  profile?: BotProfile;
  maxHands?: number;
  /** Base softmax temperature (dynamic schedule applied on top). */
  temperature?: number;
  /** Wall size at hand start — used for τ schedule. */
  initialWall?: number;
  getInitialWall?: () => number;
  /** If true, always argmax (eval / reproducibility). */
  deterministic?: boolean;
  getDecisionIndex: () => number;
  bumpDecisionIndex: () => void;
}

export function createSelfPlayStrategy(options: SelfPlayStrategyOptions): BotStrategy {
  const profile = options.profile ?? DEFAULT_PROFILE;
  const baseTau = options.temperature ?? 1.2;
  const defaultInitialWall = options.initialWall ?? 80;
  const deterministic = options.deterministic ?? false;

  const wallAtHandStart = () => options.getInitialWall?.() ?? defaultInitialWall;

  return {
    choose(prompt, rng) {
      if (prompt.actions.length === 0) {
        throw new Error(`No legal actions for ${prompt.seat}`);
      }

      const instant = pickInstantWin(prompt.actions);
      if (instant) {
        logDecision(prompt, instant, options, profile, baseTau, wallAtHandStart(), deterministic, rng, true);
        return instant;
      }

      if (!prompt.view) {
        throw new Error(`Self-play requires view for ${prompt.phase} (${prompt.seat})`);
      }

      const weights = resolveWeights(profile, prompt.view, prompt.seat, options.maxHands);
      const tracker = TileTracker.fromView(prompt.view, prompt.seat);
      const scored = scoreAllActions(prompt, weights, tracker);

      const wallRemaining = prompt.view.wall?.live.length ?? 0;
      const tau = computeTemperature({
        baseTau,
        wallRemaining,
        initialWall: wallAtHandStart(),
        phase: prompt.phase,
      });

      const evs = scored.map((s) => s.ev);
      const chosenIdx = deterministic ? argmaxIndex(evs) : softmaxSample(evs, tau, rng);
      const action = prompt.actions[chosenIdx] ?? prompt.actions[0]!;

      logDecision(prompt, action, options, profile, baseTau, wallAtHandStart(), deterministic, rng, false, {
        scored,
        chosenIdx,
        tau,
      });

      return action;
    },
  };
}

function logDecision(
  prompt: DecisionPrompt,
  action: LegalAction,
  options: SelfPlayStrategyOptions,
  profile: BotProfile,
  baseTau: number,
  initialWall: number,
  deterministic: boolean,
  _rng: () => number,
  instant: boolean,
  scoredMeta?: { scored: { action: LegalAction; ev: number }[]; chosenIdx: number; tau: number },
): void {
  if (!prompt.view) return;

  const view = prompt.view;
  const scored =
    scoredMeta?.scored ??
    scoreAllActions(
      prompt,
      resolveWeights(profile, view, prompt.seat, options.maxHands),
      TileTracker.fromView(view, prompt.seat),
    );
  const chosenIdx = scoredMeta?.chosenIdx ?? findActionIndex(prompt.actions, action);
  const tau = scoredMeta?.tau ?? baseTau;

  const legal = scored.map((s, id) => {
    const enc = encodeLegalAction(s.action, id, s.ev);
    const cmd = s.action.command;
    if (cmd.type === "discard" && prompt.view) {
      const tile = prompt.view.hands[prompt.seat].concealed.find((t) => t.instanceId === cmd.instanceId);
      if (tile) {
        const idx = tileToIndex(tile.tileId);
        if (idx >= 0) enc.tile = idx;
      }
    }
    return enc;
  });
  const record: DecisionRecordV2 = {
    v: SCHEMA_VERSION,
    kind: "decision",
    ts: new Date().toISOString(),
    matchId: options.matchId,
    handIndex: view.handIndex ?? 0,
    decisionIndex: options.getDecisionIndex(),
    seat: seatIndex(prompt.seat),
    phase: prompt.phase,
    rulesetId: view.rulesetId,
    state: encodeState(view, prompt.seat),
    claim: encodeClaimContext(view, prompt.seat),
    legal,
    chosen: chosenIdx,
    tau: instant ? 0 : tau,
    sampled: !deterministic && !instant,
  };

  options.onLog(record);
  options.bumpDecisionIndex();
}

/** @deprecated Use createSelfPlayStrategy for v2 logging. */
export function createLoggingStrategy(
  inner: BotStrategy,
  options: { matchId: string; onLog: (entry: SelfPlayRecordV2) => void },
): BotStrategy {
  let decisionIndex = 0;
  return createSelfPlayStrategy({
    matchId: options.matchId,
    onLog: options.onLog,
    getDecisionIndex: () => decisionIndex,
    bumpDecisionIndex: () => {
      decisionIndex++;
    },
    deterministic: true,
    profile: DEFAULT_PROFILE,
  });
}

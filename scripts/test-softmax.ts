/**
 * Softmax sampling tests.
 */

import { argmaxIndex, computeTemperature, softmaxSample } from "../src/self-play/softmax.js";
import { assertEq, assertTrue, section } from "./lib/test-helpers.js";

section("argmax");

assertEq("picks highest", argmaxIndex([1, 5, 3]), 1);

section("temperature schedule");

const early = computeTemperature({ baseTau: 1.2, wallRemaining: 70, initialWall: 80, phase: "turn_discard" });
const claim = computeTemperature({ baseTau: 1.2, wallRemaining: 40, initialWall: 80, phase: "claim_window" });
assertTrue("early tau > claim tau", early > claim);

section("softmax sampling");

let picks = 0;
const rng = () => 0.99;
for (let i = 0; i < 20; i++) {
  if (softmaxSample([0, 10, 0], 1.0, rng) === 1) picks++;
}
assertTrue("high EV action sampled often", picks >= 15);

const deterministic = softmaxSample([3, 3, 3], 0.5, () => 0.5);
assertTrue("uniform scores returns valid index", deterministic >= 0 && deterministic < 3);

console.log("\nAll softmax tests passed");

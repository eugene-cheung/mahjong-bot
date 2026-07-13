/** Shared test utilities for mahjong-bot scripts. */

export function assertEq<T>(label: string, got: T, expected: T): void {
  if (got !== expected) {
    console.error(`FAIL ${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
    process.exit(1);
  }
  console.log(`OK ${label}`);
}

export function assertTrue(label: string, cond: boolean): void {
  if (!cond) {
    console.error(`FAIL ${label}`);
    process.exit(1);
  }
  console.log(`OK ${label}`);
}

export function assertGt(label: string, got: number, min: number): void {
  if (!(got > min)) {
    console.error(`FAIL ${label}: got ${got}, expected > ${min}`);
    process.exit(1);
  }
  console.log(`OK ${label}`);
}

export function assertLt(label: string, got: number, max: number): void {
  if (!(got < max)) {
    console.error(`FAIL ${label}: got ${got}, expected < ${max}`);
    process.exit(1);
  }
  console.log(`OK ${label}`);
}

export function assertGte(label: string, got: number, min: number): void {
  if (!(got >= min)) {
    console.error(`FAIL ${label}: got ${got}, expected >= ${min}`);
    process.exit(1);
  }
  console.log(`OK ${label}`);
}

export function section(title: string): void {
  console.log(`\n── ${title} ──`);
}

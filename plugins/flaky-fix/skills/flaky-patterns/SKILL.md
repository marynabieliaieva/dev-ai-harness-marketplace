---
name: flaky-patterns
description: Reference catalogue of flaky-test causes — for each class, how it shows up in a stack trace, the real fix, the masking fixes to reject, and how to reproduce it deterministically without running the test many times. Use when diagnosing or reviewing a fix for a test that passes and fails on the same code.
user-invocable: false
---

# Flaky test patterns

A flaky test passes and fails on the same code. The fix removes the
nondeterminism; a masking change only lowers how often it shows. Masking
changes: **retry/rerun**, **skip/disable**, **sleep**, **bigger timeout**,
**swallowed error**, **weaker or fewer assertions**.

## Classes

| Class | Trace / symptom | Real fix | Masking to reject | Deterministic repro |
|---|---|---|---|---|
| `async-wait` | assertion on a value that is "not yet" there; timeout waiting for element/message; NPE on a result read too early | wait on the actual condition (await the promise/future, poll for the state with a bound, event/latch) | sleep before the assertion; bigger timeout | delay the producer (inject a slow stub / hook) so the read always comes first |
| `race-condition` | intermittent wrong value, duplicate key, `ConcurrentModificationException`, lost update | synchronise the shared resource, make the operation atomic, or remove the sharing | retry; serialising the whole test suite | barrier/latch that forces the two threads/tasks into the bad interleaving |
| `order-dependency` | passes alone, fails after a specific other test (often a newly added one) | the test sets up everything it needs; the other test cleans up after itself | fixed test order; `@Order` | run the polluting test's setup (or state) before this test inside one test |
| `shared-state` | static/singleton/global, shared DB rows, files, env vars, ports, caches leak between tests | per-test fixtures, unique names/ids, reset in teardown, dependency injection instead of globals | clearing state with a sleep; retry | pre-populate the shared state the way another test leaves it |
| `time-dependency` | fails around midnight, month end, DST, in other time zones; comparisons with `now()` | inject a clock; fixed time in the test; compare with tolerance only where the domain allows it | widening tolerance until it passes | freeze the clock at the boundary (23:59:59, DST switch, Feb 29) |
| `randomness` | data-dependent failures, unordered collections asserted in order, hash order | fixed seed in the test; order-independent assertions; sort before comparing | rerun | the seed / input that fails, pinned |
| `external-dependency` | network errors, 5xx/429, DNS, real third-party service, real clock server | stub/fake the dependency at the boundary; contract test separately | retry; bigger timeout | stub that returns the failing response |
| `resource-leak` | "too many open files", port in use, connection pool exhausted, fails late in a suite | close/dispose in `finally`/teardown; bounded pools; random free ports | bigger pool; bigger timeout | open the leaked resource N times before the test |
| `environment` | only on some agents/OS/locale; after a CI image or dependency bump | pin the version or make the code independent of the difference (locale, path separator, CPU count) | skip on that environment | set the differing locale/env/version in the test |
| `unknown` | none of the above fits the evidence | say what evidence is missing (another trace, logs at a given point) | — | — |

## Reading a trace

- The **top project frame** is where it failed, not necessarily where it went
  wrong. Async failures point at the assertion; the cause is the producer.
- `TimeoutException`/`timed out` is a symptom of `async-wait`,
  `external-dependency` or `resource-leak` — decide by what was awaited.
- Several traces with different top frames but the same awaited resource are
  one cause; different resources are several.

## When a masking change is acceptable

Only when the class has no deterministic fix inside the repo (a real external
system that cannot be stubbed in this test layer) — and then it is bounded,
labelled in the code, and the ticket says the cause stays.
A bounded wait **on a real condition** is not a sleep: it ends as soon as the
condition holds.

## Culprit commits

A commit is a culprit when its diff creates the mechanism: makes something
async, adds shared/static state, adds a test that leaves state behind,
changes time handling, swaps a stub for a real call, bumps a dependency or CI
image. Touching the same file is not enough.

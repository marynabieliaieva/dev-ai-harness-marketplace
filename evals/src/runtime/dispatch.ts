/**
 * Content-tier runner. Content-only calls (skillTask, the LLM judge) go through this one seam so
 * a different backend can be plugged in later without touching the tiers.
 *
 * Tool-using tiers (agentTask, workflowTask) do NOT use this — they call runClaude directly,
 * because only the Agent SDK produces the subagent/skill/file-read trace they assert on.
 */

import { runClaude, type Result, type RunOptions } from "./run-claude.js";

export function runContent(prompt: string, opts: RunOptions = {}): Promise<Result> {
  return runClaude(prompt, opts);
}

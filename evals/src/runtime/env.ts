/**
 * Child-process environment for the SDK: runs on the Claude Code subscription.
 *
 * An API key in the environment takes priority over the Claude Code subscription, so we delete
 * it — without this every eval run would silently bill API tokens.
 */
export function subscriptionEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

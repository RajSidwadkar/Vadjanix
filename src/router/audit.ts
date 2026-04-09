import { CognitiveTrace, RoutingResult } from './schema.js';

const COLORS = {
  reset: "\x1b[0m",
  reflex: "\x1b[35m",     // Magenta
  episodic: "\x1b[36m",   // Cyan
  causal: "\x1b[32m",     // Green
  llm: "\x1b[33m",        // Yellow
  gray: "\x1b[90m",
  red: "\x1b[31m"
};

export function logCognitiveTrace(result: RoutingResult) {
  const trace = result.cognitiveTrace;
  const sourceColor = result.source === "reflex" ? COLORS.reflex :
                      result.source === "episodic_replay" ? COLORS.episodic :
                      result.source === "causal" ? COLORS.causal : COLORS.llm;

  console.log(`\n${COLORS.gray}--- COGNITIVE TRACE ---${COLORS.reset}`);
  console.log(`${sourceColor}[SOURCE]${COLORS.reset}      ${result.source.toUpperCase()}`);
  console.log(`${sourceColor}[STRATEGY]${COLORS.reset}    ${trace.strategy}`);
  console.log(`${sourceColor}[CONFIDENCE]${COLORS.reset}  ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`${sourceColor}[LATENCY]${COLORS.reset}     ${trace.latencyEst}ms`);
  console.log(`${sourceColor}[MEMORY]${COLORS.reset}      ${trace.memoryState}`);
  console.log(`${COLORS.gray}------------------------${COLORS.reset}\n`);
}

/**
 * Logs security-related events like signature failures or malformed packets.
 */
export function logSecurityEvent(type: string, source: string, details: string) {
  console.error(`${COLORS.red}[SECURITY ALERT]${COLORS.reset} Type: ${type} | Source: ${source} | Details: ${details}`);
}

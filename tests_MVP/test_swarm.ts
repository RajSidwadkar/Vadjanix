import http from 'http';
import { executeSwarmTask, SwarmTask } from '../src/brain/engine.js';
import { aggregateResults, withTimeout } from '../src/brain/aggregator.js';
import { logSwarmRun } from '../src/memory/swarm_logger.js';
import { IntentPacket } from '../src/router/schema.js';
import fs from 'fs/promises';
import path from 'path';

const PORT = 3001;
const ROUTER_URL = `http://localhost:${PORT}/`;
process.env.ROUTER_URL = ROUTER_URL;

async function runTests() {
  console.log("--- Starting Swarm Orchestrator Tests ---");

  // 1. Test Aggregator Strategies
  console.log("Testing Aggregator Strategies...");
  const results: IntentPacket[] = [
    { from: 'a', to: 'b', action: 'write', payload: { message: "Result A" }, reasoning: "R1" },
    { from: 'c', to: 'd', action: 'write', payload: { message: "Result A" }, reasoning: "R2" },
  ];

  const firstWins = await aggregateResults(results, 'first_wins');
  if (firstWins.payload.message !== "Result A") throw new Error("first_wins failed");
  console.log("  [PASS] first_wins");

  const consensusPass = await aggregateResults(results, 'consensus');
  if (consensusPass.payload.message !== "Result A") throw new Error("consensus failed on identical results");
  console.log("  [PASS] consensus (match)");

  const splitResults: IntentPacket[] = [
    { from: 'a', to: 'b', action: 'write', payload: { message: "Result A" }, reasoning: "R1" },
    { from: 'c', to: 'd', action: 'write', payload: { message: "Result B" }, reasoning: "R2" },
  ];
  const consensusFail = await aggregateResults(splitResults, 'consensus');
  if (consensusFail.action !== 'refuse') throw new Error("consensus should have refused on split results");
  console.log("  [PASS] consensus (mismatch)");

  const merged = await aggregateResults(splitResults, 'merge');
  if (!merged.payload.message.includes("Result A") || !merged.payload.message.includes("Result B")) {
    throw new Error("merge failed to concatenate messages");
  }
  console.log("  [PASS] merge");

  // 2. Test Timeout Logic
  console.log("Testing Timeout Fallback...");
  const slowPromise = new Promise<IntentPacket>((resolve) => {
    setTimeout(() => resolve(results[0]), 200);
  });
  const timeoutRes = await withTimeout(slowPromise, 100);
  if (timeoutRes !== null) throw new Error("withTimeout should have returned null for slow promise");
  console.log("  [PASS] timeout fallback (triggered)");

  const fastRes = await withTimeout(slowPromise, 500);
  if (fastRes === null) throw new Error("withTimeout should have returned packet for fast promise");
  console.log("  [PASS] timeout fallback (resolved)");

  // 3. Test Full executeSwarmTask with Mock Router
  console.log("Testing executeSwarmTask with Mock Router...");
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const packet = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        from: packet.to,
        to: packet.from,
        action: 'write',
        payload: { message: `Echo: ${packet.payload.message}` },
        reasoning: "Mock Router Response"
      }));
    });
  });

  await new Promise<void>(resolve => server.listen(PORT, resolve));

  const swarm: SwarmTask = {
    goal: "Test Swarm",
    aggregator_strategy: 'merge',
    subtasks: [
      { from: 'brain', to: 'agent1', action: 'read', payload: { message: "Task 1" }, reasoning: "T1" },
      { from: 'brain', to: 'agent2', action: 'read', payload: { message: "Task 2" }, reasoning: "T2" }
    ]
  };

  const finalPacket = await executeSwarmTask(swarm);
  server.close();

  if (!finalPacket.payload.message.includes("Echo: Task 1") || !finalPacket.payload.message.includes("Echo: Task 2")) {
    throw new Error("executeSwarmTask failed to aggregate mocked responses");
  }
  console.log("  [PASS] executeSwarmTask (Full Flow)");

  // 4. Test Logger
  console.log("Testing Swarm Logger...");
  const logFile = path.join(process.cwd(), 'swarm_log.md');
  await fs.unlink(logFile).catch(() => {}); // Clear previous log

  await logSwarmRun("Log Test", "merge", ["agent1"], ["agent1"], [], "Final Msg", 150);
  const logContent = await fs.readFile(logFile, 'utf-8');
  if (!logContent.includes("Goal: Log Test") || !logContent.includes("Latency: 150ms")) {
    throw new Error("logSwarmRun failed to record expected data");
  }
  console.log("  [PASS] Swarm Logger");

  console.log("\n--- ALL SWARM TESTS PASSED ---");
}

runTests().catch(e => {
  console.error("\n[TEST FAILED]:", e);
  process.exit(1);
});

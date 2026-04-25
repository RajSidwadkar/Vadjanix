import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';
import { GoalTracker } from '../../src/modules/autonomy/goals.js';
import { parseRecentAuditLogs } from '../../src/security/audit_parser.js';
import { ReportingEngine } from '../../src/modules/autonomy/reports.js';
import { HeartbeatManager } from '../../src/modules/autonomy/heartbeat.js';
const GOALS_PATH = path.join(process.cwd(), 'GOALS.md');
const AUDIT_PATH = path.join(process.cwd(), 'audit.log');
function setup() {
    if (fs.existsSync(GOALS_PATH))
        fs.unlinkSync(GOALS_PATH);
    if (fs.existsSync(AUDIT_PATH))
        fs.unlinkSync(AUDIT_PATH);
}
function teardown() {
    if (fs.existsSync(GOALS_PATH))
        fs.unlinkSync(GOALS_PATH);
    if (fs.existsSync(AUDIT_PATH))
        fs.unlinkSync(AUDIT_PATH);
}
async function runTests() {
    console.log('--- STARTING AUTONOMY PROTOCOL TEST SUITE ---');
    try {
        setup();
        await (async () => {
            const tracker = new GoalTracker();
            assert.ok(fs.existsSync(GOALS_PATH));
            fs.appendFileSync(GOALS_PATH, '- [ ] Test Auto-completion\n');
            const pending = tracker.getPendingGoals();
            assert.ok(pending.includes('Initialize System'));
            assert.ok(pending.includes('Test Auto-completion'));
            tracker.markGoalComplete('Test Auto-completion');
            const updatedPending = tracker.getPendingGoals();
            assert.ok(!updatedPending.includes('Test Auto-completion'));
            const content = fs.readFileSync(GOALS_PATH, 'utf-8');
            assert.ok(content.includes('- [x] Test Auto-completion'));
            console.log('[PASS] Test 1: GoalTracker File I/O & Mutation');
        })();
        await (async () => {
            const oldTime = new Date(Date.now() - 48 * 3600000).toISOString();
            const recentTime1 = new Date(Date.now() - 2 * 3600000).toISOString();
            const recentTime2 = new Date(Date.now() - 1 * 3600000).toISOString();
            fs.appendFileSync(AUDIT_PATH, JSON.stringify({ ts: oldTime, msg: 'too old' }) + '\n');
            fs.appendFileSync(AUDIT_PATH, JSON.stringify({ ts: recentTime1, level: 'L1', msg: 'recent 1' }) + '\n');
            fs.appendFileSync(AUDIT_PATH, JSON.stringify({ ts: recentTime2, level: 'L3', msg: 'recent 2' }) + '\n');
            const logs = parseRecentAuditLogs(24);
            assert.strictEqual(logs.length, 2);
            console.log('[PASS] Test 2: Audit Parser Temporal Filtering');
        })();
        await (async () => {
            const reporting = new ReportingEngine();
            const report = reporting.buildDailyReport();
            assert.ok(report.includes('Handled autonomously: 1'));
            assert.ok(report.includes('Escalated to you: 1'));
            assert.ok(report.includes('📊 Vadjanix Daily Report'));
            console.log('[PASS] Test 3: Autonomous Reporting Engine');
        })();
        await (async () => {
            const mockAgent = {
                processEventQueue: async () => { throw new Error('CRITICAL EXCEPTION'); },
                checkGoalsProgress: async () => { },
                runAutonomousActions: async () => { },
                sendWhatsApp: async (m) => { }
            };
            const originalSchedule = cron.schedule;
            let callbackExecuted = false;
            cron.schedule = (pattern, callback) => {
                if (pattern === '*/15 * * * *') {
                    callback().then(() => { callbackExecuted = true; });
                }
                return {};
            };
            try {
                const hb = new HeartbeatManager();
                hb.start(mockAgent);
                await new Promise(r => setTimeout(r, 50));
                assert.ok(callbackExecuted);
                const logs = fs.readFileSync(AUDIT_PATH, 'utf-8').split('\n');
                assert.ok(logs.some(l => l.includes('CRITICAL EXCEPTION')));
            }
            finally {
                cron.schedule = originalSchedule;
            }
            console.log('[PASS] Test 4: Heartbeat Crash-Proofing');
        })();
        console.log('\nSTATUS: AUTONOMY ENGINE SECURE. PHASE 2 COMPLETE.');
        process.exit(0);
    }
    catch (error) {
        console.error('\n[FAIL] AUTONOMY TEST SUITE FAILED:', error);
        process.exit(1);
    }
    finally {
        teardown();
    }
}
runTests();

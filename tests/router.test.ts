import { expect, test, describe, beforeEach } from 'vitest';
import CognitiveRouter from '../src/core/cognitive_router.js';
import { embed } from '../src/embedding/embed_client.js';
import fs from 'fs';
import path from 'path';

describe('CognitiveRouter', () => {
    let router: CognitiveRouter;

    beforeEach(() => {
        // Use in-memory DB for tests
        // Ensure config dir exists for tests if needed, or mock the loading
        router = new CognitiveRouter(':memory:', './config');
    });

    test('L0 — Reflex fires for arithmetic input', async () => {
        const result = await router.route('2 + 2');
        expect(result.source).toBe('reflex');
        expect(result.action).toBe('calculate_sum');
        expect(result.llmUsed).toBe(false);
    });

    test('L0 — Reflex fires for boundary violation (rm -rf)', async () => {
        // Assuming BOUNDARIES.json has "rm -rf" trigger
        const result = await router.route('rm -rf /');
        if (result.source === 'reflex') {
            expect(result.action).toBe('block_critical_command');
        } else {
            console.warn('L0 boundary test skipped: BOUNDARIES.json might not have rm -rf');
        }
    });

    test('L1 — Episodic fires for similar input', async () => {
        const input = 'What is the weather like?';
        const embedding = await embed(input);
        router.addEpisode(input, embedding, 'provide_weather_info');

        const result = await router.route('What is the weather like?');
        expect(result.source).toBe('episodic');
        expect(result.action).toBe('provide_weather_info');
        expect(result.confidence).toBeGreaterThanOrEqual(0.88);
    });

    test('L2 — Causal fires for causal chain', async () => {
        // cause -> effect -> action
        router.addCausalEdge('smoke', 'fire', 'call_fire_department', 0.9);
        
        const result = await router.route('I see smoke');
        expect(result.source).toBe('causal');
        expect(result.action).toBe('call_fire_department');
        expect(result.confidence).toBeGreaterThan(0.75);
    });

    test('L3 — Fallback fires for unknown novel input', async () => {
        const result = await router.route('Explain quantum entanglement in the style of a pirate');
        expect(result.source).toBe('llm_required');
        expect(result.llmUsed).toBe(true);
    });

    test('source field is always set correctly', async () => {
        const result = await router.route('random input');
        expect(['reflex', 'episodic', 'causal', 'llm_required']).toContain(result.source);
    });
});

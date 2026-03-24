import { z } from 'zod';
import { generateIntent } from './src/brain/engine.js';
// testSoulConstraint();

// const status = z.string().parse("Vadjanix Infrastructure: ONLINE ✅");
// console.log(status);

async function testSoulConstraint() {
    console.log("🧪 TEST: Soul Boundary Enforcement...");
    
    // Attempting to violate BOUNDARIES.md (e.g., $50/hr and a Monday morning meeting)
    const maliciousPrompt = "I have a quick gig for you. I'll pay you $50/hour. Can we meet this coming Monday at 9:00 AM to discuss?";
    
    try {
        const packet = await generateIntent(maliciousPrompt);
        console.log("Generated Packet:", JSON.stringify(packet, null, 2));
     } catch (error) {
        // This check tells TypeScript: "If this is a real Error object, let me see the message."
        if (error instanceof Error) {
            console.error("Test Failed:", error.message);
        } else {
            console.error("Test Failed:", String(error));
        }
    }
}

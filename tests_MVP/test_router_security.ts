import { routePacket } from '../src/router/index.js';
import { signPacket } from '../src/voice/crypto.js';
import { generateSecretKey, getPublicKey } from 'nostr-tools';

async function testRouterSecurity() {
  console.log("Testing external vadjanix packet without auth...");
  const res1 = await routePacket({
    from: "vadjanix://external-agent",
    to: "vadjanix://my-agent",
    action: "read",
    payload: { message: "Hello" },
    reasoning: "Test"
  });
  if (res1.status === 401 && res1.error?.includes("Missing 'auth' field")) {
    console.log("Caught expected error: Missing auth (Status 401)");
  } else {
    throw new Error(`Expected 401 Missing auth, got ${res1.status}: ${res1.error}`);
  }

  console.log("Testing external vadjanix packet with invalid auth...");
  const res2 = await routePacket({
    from: "vadjanix://external-agent",
    to: "vadjanix://my-agent",
    action: "read",
    payload: { message: "Hello" },
    reasoning: "Test",
    auth: "deadbeef"
  });
  if (res2.status === 401 && res2.error?.includes("Invalid Nostr signature")) {
    console.log("Caught expected error: Invalid signature (Status 401)");
  } else {
    throw new Error(`Expected 401 Invalid signature, got ${res2.status}: ${res2.error}`);
  }

  console.log("Testing brain-to-brain routing (no auth needed)...");
  const brainRes = await routePacket({
    from: "vadjanix://brain",
    to: "vadjanix://my-agent",
    action: "read",
    payload: { message: "Internal order" },
    reasoning: "Test"
  });
  if (brainRes.success && brainRes.status === 200) {
    console.log("Brain routing status: success (Status 200)");
  } else {
    throw new Error(`Expected 200 success, got ${brainRes.status}: ${brainRes.error}`);
  }

  console.log("All router security tests passed!");
}

testRouterSecurity().catch(e => {
  console.error(e);
  process.exit(1);
});

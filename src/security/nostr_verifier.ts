import { verifyEvent } from 'nostr-tools';

export async function verifyNostrEvent(event: any, pubkey: string): Promise<boolean> {
  try {
    if (event.pubkey !== pubkey) return false;
    return verifyEvent(event);
  } catch {
    return false;
  }
}

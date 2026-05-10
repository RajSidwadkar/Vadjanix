import fs from 'node:fs';
import path from 'node:path';
import { classifyAction } from './mcq.js';
import { AutonomyLevel } from '../core/mcq_schema.js';

/**
 * Wraps classifyAction with CONTACTS.json lookup.
 * Protected contact check happens FIRST, before confidence check.
 */
export function getAutonomyLevel(
  jid: string,
  action: string,
  confidence: number,
  trustScore: number
): AutonomyLevel {
  const contactsPath = path.join(process.cwd(), 'config', 'CONTACTS.json');
  let contactCategory = 'normal';

  try {
    if (fs.existsSync(contactsPath)) {
      const content = fs.readFileSync(contactsPath, 'utf-8');
      if (content) {
        const contacts = JSON.parse(content);
        if (contacts && typeof contacts === 'object') {
          if (Array.isArray(contacts.protected) && contacts.protected.includes(jid)) {
            contactCategory = 'protected';
          } else if (contacts.owner === jid) {
            contactCategory = 'owner';
          }
        }
      }
    }
  } catch (error) {
    console.error('Critical Error reading CONTACTS.json, defaulting to restrictive classification:', error);
    // On critical error, we could return L4 immediately, but classifyAction 
    // will still run with 'normal' which is a reasonable fallback.
    // For maximum safety, we'll force 'protected' logic if the config is corrupted.
    return 'L4';
  }
  
  return classifyAction(action, confidence, trustScore, contactCategory);
}

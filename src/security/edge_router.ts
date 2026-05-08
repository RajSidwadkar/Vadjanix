export function securityGate(input: string, source: string): { allowed: boolean, reason?: string } {
  const blocklist = [
    /ignore[ \-_]*previous[ \-_]*instructions/i,
    /you[ \-_]*are[ \-_]*now/i,
    /system[ \-_]*prompt/i,
    /assistant[ \-_]*mode/i
  ];

  for (const pattern of blocklist) {
    if (pattern.test(input)) {
      return { allowed: false, reason: `Pattern match: ${pattern}` };
    }
  }

  return { allowed: true };
}

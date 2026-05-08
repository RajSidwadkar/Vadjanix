export function trustGate(content: string, trustScore: number): boolean {
  if (trustScore < 0.3) {
    return false;
  }
  // Source tagging should be handled by the caller, but we ensure basic validation here
  return true;
}

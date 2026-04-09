import net from 'node:net';
import dns from 'node:dns/promises';

const BLOCKED_RANGES = [
  '127.0.0.0/8',
  '169.254.169.254/32',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '0.0.0.0/32'
];

function ipToLong(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isIpInRange(ip: string, range: string): boolean {
  const [rangeIp, cidr] = range.split('/');
  const mask = ~((1 << (32 - parseInt(cidr, 10))) - 1) >>> 0;
  return (ipToLong(ip) & mask) === (ipToLong(rangeIp) & mask);
}

export async function validateUrl(urlStr: string): Promise<boolean> {
  try {
    const url = new URL(urlStr);
    const host = url.hostname;

    if (net.isIP(host)) {
      return !BLOCKED_RANGES.some(range => isIpInRange(host, range));
    }

    const addresses = await dns.resolve4(host);
    for (const addr of addresses) {
      if (BLOCKED_RANGES.some(range => isIpInRange(addr, range))) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function secureFetch(url: string, options?: RequestInit): Promise<Response> {
  const isValid = await validateUrl(url);
  if (!isValid) {
    throw new Error('SSRF_GUARD_BLOCK: Destination address is in a restricted range.');
  }
  return fetch(url, options);
}

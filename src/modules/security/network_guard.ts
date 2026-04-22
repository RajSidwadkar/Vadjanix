import net from 'node:net';
import dns from 'node:dns/promises';

export class NetworkGuard {
  private static readonly BLOCKED_RANGES = [
    '127.0.0.0/8',
    '169.254.169.254/32',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '0.0.0.0/32'
  ];

  private static ipToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  private static isIpInRange(ip: string, range: string): boolean {
    const [rangeIp, cidr] = range.split('/');
    const mask = ~((1 << (32 - parseInt(cidr, 10))) - 1) >>> 0;
    return (this.ipToLong(ip) & mask) === (this.ipToLong(rangeIp) & mask);
  }

  public static async validateUrl(urlStr: string): Promise<boolean> {
    try {
      const url = new URL(urlStr);
      const host = url.hostname;

      if (net.isIP(host)) {
        return !this.BLOCKED_RANGES.some(range => this.isIpInRange(host, range));
      }

      const addresses = await dns.resolve4(host);
      for (const addr of addresses) {
        if (this.BLOCKED_RANGES.some(range => this.isIpInRange(addr, range))) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  public static async secureFetch(url: string, options?: RequestInit): Promise<Response> {
    const isValid = await this.validateUrl(url);
    if (!isValid) {
      throw new Error('SSRF_GUARD_BLOCK: Destination address is in a restricted range.');
    }
    return fetch(url, options);
  }
}

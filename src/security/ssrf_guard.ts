import net from 'node:net';

export function allowedUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    if (net.isIP(hostname)) {
      return !isRestrictedIP(hostname);
    }

    // Note: In a real environment, we should resolve DNS and check IPs.
    // For this implementation, we'll block common restricted hostnames.
    const restrictedHostnames = ['localhost', 'metadata.google.internal'];
    if (restrictedHostnames.includes(hostname.toLowerCase())) return false;

    return true;
  } catch {
    return false;
  }
}

function isRestrictedIP(ip: string): boolean {
  // Block: 10.x.x.x, 192.168.x.x, 172.16-31.x.x, 127.x.x.x, 169.254.x.x
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('169.254.')) return true;
  
  if (ip.startsWith('172.')) {
    const secondOctet = parseInt(ip.split('.')[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  return false;
}

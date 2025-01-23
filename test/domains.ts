import { readFile } from 'node:fs/promises';
import { https, tcpTransport } from '../src/export';

const file = 'test/cloudflare-radar_top-1000-domains_20250113-20250120.csv';
const domainsTxt = await readFile(file, { encoding: 'utf-8' });
const domains = domainsTxt.match(/.*[.].*/g)!;
const w = process.stdout.write.bind(process.stdout);

const padRight = (s: string, n: number, ch = ' ') => s + ch.repeat(Math.max(1, n - s.length));

for (const domain of domains) for (const prefix of ['', 'www.']) {
  const host = prefix + domain;
  w(padRight(host, 40));

  try {
    const response = await new Promise<string>((resolve, reject) =>
      void https('https://' + host, 'GET', tcpTransport, {
        httpVersion: '1.1',
        headers: { Connection: 'close' },
        socketOptions: {
          timeout: [2000, () => reject(new Error('socket timeout'))],
          error: reject,
        }
      }).then(resolve, reject)
    );

    w('\x1b[0;32m' + response.slice(0, response.indexOf('\n')) + '\x1b[0;0m\n');

  } catch (err: any) {
    const e: Error = err;
    const color =
      e.message === 'socket timeout' || e.message.startsWith('getaddrinfo') || e.message.indexOf('protocol_version') !== -1 ? '0' : // white
        e.message.startsWith('Fatal TLS alert') ? '31' : // red
          '33';  // yellow

    w(`\x1b[0;${color}m` + e.message + '\x1b[0;0m\n');
  }

}

// compare: curl -v --tlsv1.3 https://example.com


import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import ChildProcess from 'node:child_process';
import { https, tcpTransport } from '../src/export';
import { getRootCertsDatabase } from '../src/util/rootCerts';

const file = 'test/cloudflare-radar_top-1000-domains_20250113-20250120.csv';

const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const curlPath = '/opt/homebrew/opt/curl/bin/curl';
const domainsTxt = await readFile(file, { encoding: 'utf-8' });
const domains = domainsTxt.match(/.*[.].*/g)!;
const padRight = (s: string, n: number, ch = ' ') => s + ch.repeat(Math.max(1, n - s.length));
const rootCertsPromise = getRootCertsDatabase();

const execFile = promisify(ChildProcess.execFile);
const curl = async (url: string) => {
  let success = true;
  const opts = [
    '--tlsv1.3',
    '--head',
    '--http1.1',
    '--user-agent', ua,
    '--connect-timeout', '2',
    '--max-time', '2',
    url
  ];
  await execFile(curlPath, opts).catch(() => success = false);
  return success;
};

const w = process.stdout.write.bind(process.stdout);
w('* = `curl --tlsv1.3 https://host` fails, same as subtls\n');
w('! = `curl --tlsv1.3 https://host` fails, unlike subtls\n\n');

for (const domain of domains) for (const prefix of ['', 'www.']) {
  const host = prefix + domain;
  const url = 'https://' + host;
  w(padRight(host, 40));

  try {
    const response = await new Promise<string>((resolve, reject) =>
      void https(url, 'HEAD', tcpTransport, rootCertsPromise, {
        httpVersion: '1.1',
        headers: {
          'User-Agent': ua,
          'Accept': '*/*',
          'Connection': 'close',
        },
        socketOptions: {
          timeout: [2000, () => reject(new Error('socket timeout'))],
          error: reject,
        }
      }).then(resolve, reject)
    );

    let msg = response.slice(0, response.indexOf('\n') - 1);
    const curlOK = await curl(url);
    if (!curlOK) msg += ' !';

    const color = curlOK ? '32' : '31';  // green vs red
    w(`\x1b[0;${color}m${msg}\x1b[0;0m\n`);

  } catch (err: any) {
    let msg = (err as Error).message;

    const networkIssue =
      msg === 'socket timeout' ||
      msg.startsWith('getaddrinfo E') ||
      msg.startsWith('connect E') ||
      msg.startsWith('read E');

    let curlOK = false;
    if (!networkIssue) {
      curlOK = await curl(url);
      if (!curlOK) msg += ' *';
    }

    const color = networkIssue || !curlOK ? '0' : '33';  // white vs yellow
    w(`\x1b[0;${color}m${msg}\x1b[0;0m\n`);
  }
}


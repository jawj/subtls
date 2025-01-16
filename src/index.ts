import { postgres } from './postgres';
import { https } from './https';
import wsTransport from './util/wsTransport';

const qs = (sel: string) => document.querySelector(sel)!;
const pgTab = qs('#postgres');
const httpsTab = qs('#https');
const goBtn = qs('#go') as HTMLButtonElement;
const heading = qs('#heading') as HTMLHeadingElement;
const desc = qs('#description');
const logs = qs('#logs');

let urlStr = location.hash.slice(1);
const pg = /\?postgres(ql)?/i.test(location.search);

(pg ? pgTab : httpsTab).classList.add('active');
(pg ? httpsTab : pgTab).classList.remove('active');

if (pg) {
  goBtn.value = 'Ask Postgres the time, live';
  heading.innerHTML = 'A live Postgres query with TLS channel binding, byte by byte';
  desc.innerHTML = 'This page connects to a <a href="https://neon.tech">Neon</a> PostgreSQL instance using <a href="https://www.postgresql.org/docs/current/sasl-authentication.html#SASL-SCRAM-SHA-256">SCRAM-SHA-256-PLUS</a> auth and issues a <span class="q">SELECT now()</span>.';

  if (!urlStr.startsWith('postgres')) urlStr = 'postgresql://frodo:correct-horse-battery-staple@ep-crimson-sound-a8nnh11s-pooler.eastus2.azure.neon.tech/neondb';
} else {
  if (!urlStr.startsWith('https')) urlStr = 'https://bytebybyte.dev';
}

goBtn.addEventListener('click', () => {
  logs.replaceChildren();  // clear
  if (pg) void postgres(urlStr, wsTransport, false);
  else void https(urlStr, 'GET', wsTransport);
});

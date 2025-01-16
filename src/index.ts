import { postgres } from './postgres';
import { https } from './https';
import { log } from './presentation/log';
import wsTransport from './util/wsTransport';
import { LogColours } from './presentation/appearance';
import { textColour } from './presentation/highlights';

const qs = (sel: string) => document.querySelector(sel)!;
const pgTab = qs('#postgres');
const httpsTab = qs('#https');
const goBtn = qs('#go') as HTMLButtonElement;
const heading = qs('#heading') as HTMLHeadingElement;
const desc = qs('#description');
const logs = qs('#logs');

const pg = /\?postgres(ql)?/i.test(location.search);

(pg ? pgTab : httpsTab).classList.add('active');
(pg ? httpsTab : pgTab).classList.remove('active');

if (pg) {
  goBtn.value = 'Ask Postgres the time, live';
  heading.innerHTML = 'Live Postgres query with TLS channel binding, byte by byte';
  desc.innerHTML = 'This page connects to a <a href="https://neon.tech">Neon</a> PostgreSQL instance using <a href="https://www.postgresql.org/docs/current/sasl-authentication.html#SASL-SCRAM-SHA-256">SCRAM-SHA-256-PLUS</a> auth and issues a <span class="q">SELECT now()</span>.';
}

const logAndRethrow = (e: any) => {
  chatty && log(`%cError: ${e.message}%c`, `color: ${LogColours.header}`, textColour);
  throw e;
};

goBtn.addEventListener('click', () => {
  logs.replaceChildren();  // clear
  let urlStr = location.hash.slice(1);

  if (pg) {
    if (!urlStr.startsWith('postgres')) urlStr = 'postgresql://frodo:correct-horse-battery-staple@ep-crimson-sound-a8nnh11s-pooler.eastus2.azure.neon.tech/neondb';
    postgres(urlStr, wsTransport, false).catch(logAndRethrow);

  } else {
    if (!urlStr.startsWith('https')) urlStr = 'https://bytebybyte.dev';
    https(urlStr, 'GET', wsTransport).catch(logAndRethrow);
  }
});

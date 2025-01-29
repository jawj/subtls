import { postgres } from './postgres';
import { https } from './https';
import { log } from './presentation/log';
import wsTransport from './util/wsTransport';
import { LogColours } from './presentation/appearance';
import { textColour } from './presentation/highlights';
import { getRootCertsDatabase } from './util/rootCerts';

const rootCertsPromise = getRootCertsDatabase();

const qs = <E extends Element = Element>(sel: string) => document.querySelector(sel) as E;
const pgTab = qs('#postgres');
const httpsTab = qs('#https');
const h2Para = qs<HTMLParagraphElement>('#http2');
const h2Chk = qs<HTMLInputElement>('#http2 input');
const goBtn = qs<HTMLButtonElement>('#go');
const heading = qs('#heading');
const desc = qs('#description');
const logs = qs('#logs');

const pg = /[?]postgres(ql)?/i.test(location.search);

(pg ? pgTab : httpsTab).classList.add('active');
(pg ? httpsTab : pgTab).classList.remove('active');

if (pg) {
  goBtn.value = 'Ask Postgres the time, byte by byte';
  heading.innerHTML = 'See this page query Postgres, byte by byte, over TLS';
  desc.innerHTML = 'This page connects to a <a href="https://neon.tech">Neon</a> PostgreSQL instance over TLS with <a href="https://www.postgresql.org/docs/current/sasl-authentication.html#SASL-SCRAM-SHA-256">channel binding</a>. Then it runs this query: <span class="q">SELECT now()</span>.';
  h2Para.style.display = 'none';
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
    postgres(urlStr, wsTransport, rootCertsPromise, false).catch(logAndRethrow);

  } else {
    if (!urlStr.startsWith('https')) urlStr = 'https://bytebybyte.dev';
    const protocols = ['http/1.1'];
    if (h2Chk.checked) protocols.unshift('h2');
    https(urlStr, 'GET', wsTransport, rootCertsPromise, { protocols }).catch(logAndRethrow);
  }
});

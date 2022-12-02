
import { postgres } from './postgres';
import { https } from './https';

const urlStr = location.hash.slice(1);
const pg = urlStr && urlStr.startsWith('postgres');
const goBtn = document.getElementById('go')! as HTMLButtonElement;

if (pg) {
  goBtn.value = 'Ask Postgres the time over TLS';
  document.getElementById('extra')!.innerHTML = `
    <b>Postgres version</b> &nbsp; 
    To minimise latency, we pipeline the outgoing Postgres traffic into only three transmissions. 
    The first combines a Postgres SSL request and (without awaiting a reply) a TLS ClientHello. 
    The second combines a Postgres startup message, a password message and a SELECT query. 
    The third simply closes the connection. 
    (You can follow this I/O by opening Chrome’s developer tools, picking the 
    Network tab, and selecting the WebSocket connection: <code>v1?address=...</code>).`
}

goBtn.addEventListener('click', () => {
  if (pg) postgres(urlStr);
  else https('https://subtls.pages.dev');
});

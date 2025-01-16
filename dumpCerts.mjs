#!/usr/bin/env node

// to create cert files:
//   curl 'https://curl.se/ca/cacert.pem' | ./dumpCerts.mjs
// or on a Mac:
//   cat '/etc/ssl/cert.pem' | ./dumpCerts.mjs

import { readFile, writeFile } from 'fs/promises';
import { TrustedCert } from './index.js';

const pem = await readFile('/dev/stdin', { encoding: 'utf8' });
const { index, data } = await TrustedCert.databaseFromPEM(pem);

await writeFile('docs/certs.bin', data);
await writeFile('docs/certs.index.json', JSON.stringify(index), { encoding: 'utf8' });

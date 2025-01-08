#!/usr/bin/env node

// to create cert files:
//   curl 'https://curl.se/ca/cacert.pem' | ./dumpCerts.mjs
// or on a Mac:
//   cat '/etc/ssl/cert.pem' | ./dumpCerts.mjs

import { readFileSync, writeFileSync } from "fs";
import { TrustedCert } from "./index.js";

const pem = readFileSync("/dev/stdin", { encoding: "utf8" });
const { index, data } = TrustedCert.databaseFromPEM(pem);

writeFileSync("docs/certs.bin", data);
writeFileSync("docs/certs.index.json", JSON.stringify(index), {
  encoding: "utf8",
});

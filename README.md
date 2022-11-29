# subtls

A TypeScript TLS 1.3 client of limited scope, built using SubtleCrypto and no other dependencies. Non-compliant with the spec in various ways.

## Current scope

* TLS 1.3 only
* Client only
* Key exchange: NIST P-256 ECDH only (P-384 and P-521 would be easy to add, but there's currently no SubtleCrypto support for Curve25519 and x448)
* Ciphers: TLS_AES_128_GCM_SHA256 only (TLS_AES_256_GCM_SHA384 would be easy to add, but there's currently no SubtleCrypto support for TLS_CHACHA20_POLY1305_SHA256)
* End-user certificate verify: ECDSA (P-256) + SHA256 and RSA_PSS_RSAE_SHA256 only (some others would be easy to add)
* Certificate chain verify: ECDSA (P-256/384) + SHA256/384 and RSASSA_PKCS1-v1_5 + SHA-256 only (some others would be easy to add)
* No cert chain building: each cert must sign the preceding one, leading to a trusted root
* No client certificates
* No session tickets
* No Pre-Shared Keys
* Limited ability to deal with message fragmentation across records
* Never sends alert records, simply throws on error

## Features

* Annotated binary input and output (when built in 'chatty' mode)

## Resources

TLS 1.3

* https://tls13.xargs.org
* https://jvns.ca/blog/2022/03/23/a-toy-version-of-tls/ + https://github.com/jvns/tiny-tls
* https://datatracker.ietf.org/doc/html/rfc8446
* https://en.wikipedia.org/wiki/Transport_Layer_Security#Protocol_details

HKDF

* *ttps://www.ietf.org/rfc/rfc5869.txt
* https://security.stackexchange.com/questions/222687/hkdflabel-in-tls-1-3

SubtleCrypto

* https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
* https://w3c.github.io/webcrypto/

Testing

* https://help.mulesoft.com/s/article/How-to-set-up-a-minimal-SSL-TLS-ser
* https://github.com/tlsfuzzer/tlsfuzzer

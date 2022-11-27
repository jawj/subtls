# subtls

A TypeScript TLS 1.3 client of very limited scope. Built using SubtleCrypto and no other dependencies.


## Current scope

* TLS 1.3 only
* Client only
* Key exchange: SECP256R1 ECDH only (P384 and P521 would be easy to add; there's currently no SubtleCrypto support for  Curve25519 and x448)
* Ciphers: TLS_AES_128_GCM_SHA256 only (TLS_AES_256_GCM_SHA384 would be easy to add; there's currently no SubtleCrypto support for TLS_CHACHA20_POLY1305_SHA256)
* Signature verification (end-user cert and cert chain): ECDSA_SECP256R1_SHA256 and RSA_PSS_RSAE_SHA256 only
* No cert chain building: each cert must sign the preceding one, up to a trusted root
* No client certificates 
* No session tickets
* Limited ability to deal with message fragmentation across records sent or received (this is probably a bug)


## Features

* Annotated binary input/output (when compiled in 'chatty' mode)


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

# subtls

A TypeScript TLS 1.3 client with limited scope.

* Built using the JS [SubtleCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto), with no external dependencies.
* Non-compliant with [the spec](https://www.rfc-editor.org/rfc/rfc8446) in various ways.
* **NOT READY FOR USE IN PRODUCTION.**

## Current scope

* TLS 1.3 only
* Client only
* Key exchange: NIST P-256 ECDH only (P-384 and P-521 would be easy to add; there’s currently no SubtleCrypto support for Curve25519 and x448)
* Ciphers: TLS_AES_128_GCM_SHA256 only (TLS_AES_256_GCM_SHA384 would be easy to add; there’s currently no SubtleCrypto support for TLS_CHACHA20_POLY1305_SHA256)
* End-user certificate verify: ECDSA (P-256) + SHA256 and RSA_PSS_RSAE_SHA256 only (some others would be easy to add)
* Certificate chain verify: ECDSA (P-256/384) + SHA256/384 and RSASSA_PKCS1-v1_5 + SHA-256 only (some others would be easy to add)
* No cert chain building: each cert must sign the preceding one, leading to a trusted root
* No client certificates
* No Pre-Shared Keys
* Ignores session tickets
* Limited ability to deal with message fragmentation across records
* Never sends alert records: simply throws on error

Fundamentally, there’s not much of a state machine here: the code just expects a mostly predictable sequence of messages, and throws if it doesn’t get what it expects.

## Features

* Annotated and indented binary input and output (when built in ‘chatty’ mode)

## How could this ever be useful?

Why would we need a JS implementation of TLS? On Node.js, there’s `tls.connect`. In browsers, TLS-secured connections are easy using WebSockets and the `fetch` API ... and in any case, there’s no TCP!

Well, this library arose out of wanting to speak TCP-based protocols (e.g. Postgres) from V8 isolate-based serverless environments which don’t do TCP.

It’s pretty easy to [tunnel TCP traffic over WebSockets](https://github.com/neondatabase/wsproxy). But if you need that traffic encrypted, **either** you need secure `wss:` WebSockets to the proxy (plus something to keep the onward TCP traffic safe), **or** you need a userspace TLS implementation to encrypt the data before you pass it to the WebSocket and on through the proxy.

This could be that userspace TLS implementation. 

There’s also some potential pedagogical value, which we build on by optionally producing beautifully annotated and indented binary data.

Note: there are some annoying roadblocks to using this in web browsers. From an `https:` page you can’t open an insecure `ws:` WebSocket, and from an `http:` page there’s no access to SubtleCrypto.

## Crypto

Thankfully, almost no actual crypto is implemented here: SubtleCrypto covers almost everything we need. 

The one exception is the HKDF functions in `tls/keys.ts`. SubtleCrypto’s documentation is not very good, but from what I could make out [its HKDF support](https://developer.mozilla.org/en-US/docs/Web/API/HkdfParams) is not quite flexible enough to use here (I may revisit this question in future, because I may be wrong).

Of course, my HKDF implementation leans heavily on HMAC calculations which are themselves punted to SubtleCrypto.

## Testing

This code really needs testing.

## Navigating the code

For an outline of the code, start in `tls/startTls.ts`, which orchestrates most of it.

You’ll notice heavy use of the `Bytes` class (found in `util/bytes.ts`) throughout. This is used for writing and parsing binary data, and is a wrapper around a `Uint8Array` and a `DataView`, offering three key additional features:

* **A cursor** &nbsp; It keeps an `offset` property up to date, making it easy to write a sequence of binary data types.

* **Lengths** &nbsp; It has methods for reading and writing fields that correspond to the lengths of upcoming data. For example, when writing the ClientHello message, we do this:

  ```typescript
  const endCiphers = h.writeLengthUint16();
  h.writeUint16(0x1301);
  endCiphers();
  ```

  The call to `writeLengthUint16` reserves a two-byte slot for a length to be written, and returns a function we can call once we’ve written the data whose length is to be indicated. That function (`endCiphers` here) goes back and ensures that the length of the data written in the meantime gets put into the corresponding slot.

  There are also `writeLength` variants to support protocols that (bizarrely) include the length of the length field itself in the length that’s recorded. For example, when sending a password to Postgres over our TLS connection, we do this:

  ```typescript
  msg.writeUTF8String('p');
  const endPasswordMessage = msg.writeLengthUint32Incl();
  msg.writeUTF8StringNullTerminated(password);
  endPasswordMessage();
  ```

  If `password` here is 10 bytes, then the recorded length will be 15. That’s 4 bytes of length data in addition to 10 bytes of UTF8 and one null byte to terminate the string.

  For each `writeLength` method, there’s a corresponding `expectLength` method we can use when parsing. For example, when parsing certificates from the encrypted server handshake, we do this:

  ```typescript
  const [endCert] = hs.expectLengthUint24();
  const cert = new Cert(hs);
  certs.push(cert);
  endCert();
  ```

  The call to `endCert` here checks that the parsing code inside the `Cert` constructor has read exactly the number of bytes that were indicated in the 3-byte length field (it will throw if not).

  The `writeLength` methods return a tuple of two functions (only the first is used in the example above). We call the first function when we think we should have read the amount of data that was promised. We can call the second for a running tally of how much of the promised data is remaining.

* **Comments and indentation** &nbsp; For debugging purposes, it’s useful to be able to attach comments following sections of binary data, and the `Bytes` class supports this. Sometimes it’s automatic: for instance, `writeUTF8String` automatically adds the quoted string as a comment.

  More often, you specify the comment yourself. This is nice, because the comment then exists **both** in the code **and** in the binary data produced.

    For example, the ClientHello example given above actually looks like this:

  ```typescript
  const endCiphers = h.writeLengthUint16(chatty && 'ciphers');
  h.writeUint16(0x1301, chatty && 'cipher: TLS_AES_128_GCM_SHA256');
  endCiphers();
  ```

  Here, we provide a description of what the `writeLength` method is writing the length of (a list of ciphers), and an explanation of the magic value `0x1301`, so that when logging the result of `commentedString()` we get this:

  ```
  00 02  2 bytes of ciphers follow
  ·· 13 01  cipher: TLS_AES_128_GCM_SHA256
  ```

  Also in evidence here is the other thing the `writeLength` and `expectLength` methods do for us: they maintain an indentation level for the binary data, indicating which parts of the binary data are subordinate to which other parts.

  For example, due to the use of the `writeLength` methods and commenting, the first few bytes of the ClientHello can be logged like so:

  ```
  16  record type: handshake
  03 01  TLS protocol version 1.0
  00 b9  185 bytes follow
  ·· 01  handshake type: client hello
  ·· 00 00 b5  181 bytes follow
  ·· ·· 03 03  TLS version 1.2 (middlebox compatibility)
  ·· ·· 1c 41 11 25 f6 44 55 5d cb b5 88 a7 19 2b 07 db b0 69 10 58 01 67 53 3e 68 34 43 a9 bf b8 d2 8f  client random
  ·· ·· 20  32 bytes of session ID follow
  ·· ·· ·· ec c1 a5 b1 0e e5 4d 4c 44 34 66 71 a4 7e 4a e3 f5 57 dd 38 51 2b ca 8f f0 5d 7a 6c 28 d1 d2 23  session ID (middlebox compatibility)
  ·· ·· 00 02  2 bytes of ciphers follow
  ·· ·· ·· 13 01  cipher: TLS_AES_128_GCM_SHA256
  ```

  You’ll notice that all the comments here are prefixed with a conditional `chatty &&`. That means we can omit these strings from the build as dead code, and save the work of keeping track of them, by setting `chatty` to `0` when we bundle with esbuild. We’re then left with only some residual zeroes.

Finally, there’s also an `ASN1Bytes` subclass of `Bytes` that adds various methods for reading ASN.1-specific data types, as used in X.509 certificates, such as lengths, OIDs, and BitStrings.

## Alternatives

The only alternative JS TLS implementation I’m aware of is [Forge](https://github.com/digitalbazaar/forge). This is pure JS, without SubtleCrypto, making it somewhat slow. More importantly, its TLS parts are not very actively maintained. The main project supports up to TLS 1.1. There’s a fork that supports up to TLS 1.2, but even that supports none of the modern and secure ciphers you’d want to use.

## Name

The name _subtls_ is a play on SubtleCrypto + TLS, and perhaps also conveys the idea that this is _less than_ TLS: an incomplete and non-conformant implementation.

## How to use it

First of all: **don’t**. This code is not ready to be used in production.

Second, there are example uses in `https.ts` and `postgres.ts`. 

Essentially, you call `startTls` with a hostname, one or more PEM-format root certificates, and functions it can use to read and write unencrypted data to and from the network.

It gives you back a `Promise` of two functions, which you can use to read and write data via the TLS connection. Note that the TLS connection will not be fully established until you call one of these.

## Useful resources

TLS 1.3

* https://datatracker.ietf.org/doc/html/rfc8446
* https://www.davidwong.fr/tls13/
* https://tls13.xargs.org
* https://jvns.ca/blog/2022/03/23/a-toy-version-of-tls/ + https://github.com/jvns/tiny-tls
* https://en.wikipedia.org/wiki/Transport_Layer_Security#Protocol_details

HKDF

* https://www.ietf.org/rfc/rfc5869.txt
* https://security.stackexchange.com/questions/222687/hkdflabel-in-tls-1-3

SubtleCrypto

* https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
* https://w3c.github.io/webcrypto/

Testing

* https://help.mulesoft.com/s/article/How-to-set-up-a-minimal-SSL-TLS-ser
* https://github.com/tlsfuzzer/tlsfuzzer
* https://badssl.com (but no TLS 1.3 support yet)

## TODO

Compare client state machine: https://www.rfc-editor.org/rfc/rfc8446#appendix-A.1

## Licence

Copyright &copy; 2022 George MacKerron.

Licenced under the [MIT licence](https://opensource.org/licenses/MIT).

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


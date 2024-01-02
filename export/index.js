var ie=Object.defineProperty;var re=(r,e,t)=>e in r?ie(r,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):
r[e]=t;var u=(r,e,t)=>(re(r,typeof e!="symbol"?e+"":e,t),t);function U(...r){if(r.length===1&&r[0]instanceof Uint8Array)return r[0];let e=r.
reduce((n,c)=>n+c.length,0),t=new Uint8Array(e),i=0;for(let n of r)t.set(n,i),i+=
n.length;return t}function Z(r,e){let t=r.length;if(t!==e.length)return!1;for(let i=0;i<
t;i++)if(r[i]!==e[i])return!1;return!0}var yt=class{constructor(){u(this,"length");u(this,"data");this.length=0,this.data=
new Uint8Array}append(e){let t=e.length;if(this.length+t>this.data.length){let i=this.
data;this.data=new Uint8Array(this.length*2+t),this.data.set(i)}this.data.set(e,
this.length),this.length+=e.length}getData(){return this.data.subarray(0,this.length)}};var ct="\xB7\xB7 ";var Ht=new TextEncoder,se=new TextDecoder,D=class{constructor(e){u(this,"offset");
u(this,"dataView");u(this,"data");u(this,"comments");u(this,"indents");u(this,"i\
ndent");this.offset=0,this.data=typeof e=="number"?new Uint8Array(e):e,this.dataView=
new DataView(this.data.buffer,this.data.byteOffset,this.data.byteLength),this.comments=
{},this.indents={},this.indent=0}extend(e){let t=typeof e=="number"?new Uint8Array(
e):e;this.data=U(this.data,t),this.dataView=new DataView(this.data.buffer,this.data.
byteOffset,this.data.byteLength)}remaining(){return this.data.length-this.offset}subarray(e){
return this.data.subarray(this.offset,this.offset+=e)}skip(e,t){return this.offset+=
e,t&&this.comment(t),this}comment(e,t=this.offset){throw new Error("No comments \
should be emitted outside of chatty mode")}lengthComment(e,t,i=!1){return e===1?
`${e} byte${t?` of ${t}`:""} ${i?"starts here":"follows"}`:`${e===0?"no":e} byte\
s${t?` of ${t}`:""} ${i?"start here":"follow"}`}readBytes(e){return this.data.slice(
this.offset,this.offset+=e)}readUTF8String(e){let t=this.subarray(e);return se.decode(
t)}readUTF8StringNullTerminated(){let e=this.offset;for(;this.data[e]!==0;)e++;let t=this.
readUTF8String(e-this.offset);return this.expectUint8(0,"end of string"),t}readUint8(e){
let t=this.dataView.getUint8(this.offset);return this.offset+=1,t}readUint16(e){
let t=this.dataView.getUint16(this.offset);return this.offset+=2,t}readUint24(e){
let t=this.readUint8(),i=this.readUint16();return(t<<16)+i}readUint32(e){let t=this.
dataView.getUint32(this.offset);return this.offset+=4,t}expectBytes(e,t){let i=this.
readBytes(e.length);if(!Z(i,e))throw new Error("Unexpected bytes")}expectUint8(e,t){
let i=this.readUint8();if(i!==e)throw new Error(`Expected ${e}, got ${i}`)}expectUint16(e,t){
let i=this.readUint16();if(i!==e)throw new Error(`Expected ${e}, got ${i}`)}expectUint24(e,t){
let i=this.readUint24();if(i!==e)throw new Error(`Expected ${e}, got ${i}`)}expectUint32(e,t){
let i=this.readUint32();if(i!==e)throw new Error(`Expected ${e}, got ${i}`)}expectLength(e,t=1){
let i=this.offset,n=i+e;if(n>this.data.length)throw new Error("Expected length e\
xceeds remaining data length");return this.indent+=t,this.indents[i]=this.indent,
[()=>{if(this.indent-=t,this.indents[this.offset]=this.indent,this.offset!==n)throw new Error(
`${e} bytes expected but ${this.offset-i} read`)},()=>n-this.offset]}expectLengthUint8(e){
let t=this.readUint8();return this.expectLength(t)}expectLengthUint16(e){let t=this.
readUint16();return this.expectLength(t)}expectLengthUint24(e){let t=this.readUint24();
return this.expectLength(t)}expectLengthUint32(e){let t=this.readUint32();return this.
expectLength(t)}expectLengthUint8Incl(e){let t=this.readUint8();return this.expectLength(
t-1)}expectLengthUint16Incl(e){let t=this.readUint16();return this.expectLength(
t-2)}expectLengthUint24Incl(e){let t=this.readUint24();return this.expectLength(
t-3)}expectLengthUint32Incl(e){let t=this.readUint32();return this.expectLength(
t-4)}writeBytes(e){return this.data.set(e,this.offset),this.offset+=e.length,this}writeUTF8String(e){
let t=Ht.encode(e);return this.writeBytes(t),this}writeUTF8StringNullTerminated(e){
let t=Ht.encode(e);return this.writeBytes(t),this.writeUint8(0),this}writeUint8(e,t){
return this.dataView.setUint8(this.offset,e),this.offset+=1,this}writeUint16(e,t){
return this.dataView.setUint16(this.offset,e),this.offset+=2,this}writeUint24(e,t){
return this.writeUint8((e&16711680)>>16),this.writeUint16(e&65535,t),this}writeUint32(e,t){
return this.dataView.setUint32(this.offset,e),this.offset+=4,this}_writeLengthGeneric(e,t,i){
let n=this.offset;this.offset+=e;let c=this.offset;return this.indent+=1,this.indents[c]=
this.indent,()=>{let a=this.offset-(t?n:c);if(e===1)this.dataView.setUint8(n,a);else if(e===
2)this.dataView.setUint16(n,a);else if(e===3)this.dataView.setUint8(n,(a&16711680)>>
16),this.dataView.setUint16(n+1,a&65535);else if(e===4)this.dataView.setUint32(n,
a);else throw new Error(`Invalid length for length field: ${e}`);this.indent-=1,
this.indents[this.offset]=this.indent}}writeLengthUint8(e){return this._writeLengthGeneric(
1,!1,e)}writeLengthUint16(e){return this._writeLengthGeneric(2,!1,e)}writeLengthUint24(e){
return this._writeLengthGeneric(3,!1,e)}writeLengthUint32(e){return this._writeLengthGeneric(
4,!1,e)}writeLengthUint8Incl(e){return this._writeLengthGeneric(1,!0,e)}writeLengthUint16Incl(e){
return this._writeLengthGeneric(2,!0,e)}writeLengthUint24Incl(e){return this._writeLengthGeneric(
3,!0,e)}writeLengthUint32Incl(e){return this._writeLengthGeneric(4,!0,e)}array(){
return this.data.subarray(0,this.offset)}commentedString(e=!1){let t=this.indents[0]!==
void 0?ct.repeat(this.indents[0]):"",i=this.indents[0]??0,n=e?this.data.length:this.
offset;for(let c=0;c<n;c++){t+=this.data[c].toString(16).padStart(2,"0")+" ";let a=this.
comments[c+1];this.indents[c+1]!==void 0&&(i=this.indents[c+1]),a&&(t+=` ${a}
${ct.repeat(i)}`)}return t}};function bt(r,e,t,i=!0){let n=new D(1024);n.writeUint8(22,0),n.writeUint16(769,0);
let c=n.writeLengthUint16("TLS record");n.writeUint8(1,0);let a=n.writeLengthUint24();
n.writeUint16(771,0),crypto.getRandomValues(n.subarray(32));let s=n.writeLengthUint8(
0);n.writeBytes(t),s();let o=n.writeLengthUint16(0);n.writeUint16(4865,0),o();let h=n.
writeLengthUint8(0);n.writeUint8(0,0),h();let y=n.writeLengthUint16(0);if(i){n.writeUint16(
0,0);let O=n.writeLengthUint16(0),W=n.writeLengthUint16(0);n.writeUint8(0,0);let V=n.
writeLengthUint16(0);n.writeUTF8String(r),V(),W(),O()}n.writeUint16(11,0);let d=n.
writeLengthUint16(0),m=n.writeLengthUint8(0);n.writeUint8(0,0),m(),d(),n.writeUint16(
10,0);let l=n.writeLengthUint16(0),A=n.writeLengthUint16(0);n.writeUint16(23,0),
A(),l(),n.writeUint16(13,0);let C=n.writeLengthUint16(0),v=n.writeLengthUint16(0);
n.writeUint16(1027,0),n.writeUint16(2052,0),v(),C(),n.writeUint16(43,0);let p=n.
writeLengthUint16(0),b=n.writeLengthUint8(0);n.writeUint16(772,0),b(),p(),n.writeUint16(
51,0);let K=n.writeLengthUint16(0),$=n.writeLengthUint16(0);n.writeUint16(23,0);
let P=n.writeLengthUint16(0);return n.writeBytes(e),P(),$(),K(),y(),a(),c(),n}function z(r){return new Uint8Array(Array.from(r.matchAll(/[0-9a-f]/g)).map(e=>parseInt(
e[0],16)))}function f(r,e=""){return[...r].map(t=>t.toString(16).padStart(2,"0")).
join(e)}function At(r,e){let t,i,[n]=r.expectLength(r.remaining());r.expectUint8(2,0);let[
c]=r.expectLengthUint24(0);r.expectUint16(771,0);let a=r.readBytes(32);if(Z(a,[207,
33,173,116,229,154,97,17,190,29,140,2,30,101,184,145,194,162,17,22,122,187,140,94,
7,158,9,226,200,168,51,156]))throw new Error("Unexpected HelloRetryRequest");r.expectUint8(
e.length,0),r.expectBytes(e,0),r.expectUint16(4865,0),r.expectUint8(0,0);let[s,o]=r.
expectLengthUint16(0);for(;o()>0;){let h=r.readUint16(0),[y]=r.expectLengthUint16(
0);if(h===43)r.expectUint16(772,0),i=!0;else if(h===51){r.expectUint16(23,0);let[
d,m]=r.expectLengthUint16("key share"),l=m();if(l!==65)throw new Error(`Expected\
 65 bytes of key share, but got ${l}`);t=r.readBytes(l),d()}else throw new Error(
`Unexpected extension 0x${f([h])}`);y()}if(s(),c(),n(),i!==!0)throw new Error("N\
o TLS version provided");if(t===void 0)throw new Error("No key provided");return t}var Oe=new RegExp(`  .+|^(${ct})+`,"gm");var at=16384,ce=at+1+255;async function mt(r,e,t=at){let n=await r(5);if(n===void 0)
return;if(n.length<5)throw new Error("TLS record header truncated");let c=new D(
n),a=c.readUint8();if(a<20||a>24)throw new Error(`Illegal TLS record type 0x${a.
toString(16)}`);if(e!==void 0&&a!==e)throw new Error(`Unexpected TLS record type\
 0x${a.toString(16).padStart(2,"0")} (expected 0x${e.toString(16).padStart(2,"0")}\
)`);c.expectUint16(771,"TLS record version 1.2 (middlebox compatibility)");let s=c.
readUint16();if(s>t)throw new Error(`Record too long: ${s} bytes`);let o=await r(
s);if(o===void 0||o.length<s)throw new Error("TLS record content truncated");return{
headerData:n,header:c,type:a,length:s,content:o}}async function gt(r,e,t){let i=await mt(
r,23,ce);if(i===void 0)return;let n=new D(i.content),[c]=n.expectLength(n.remaining());
n.skip(i.length-16,0),n.skip(16,0),c();let a=await e.process(i.content,16,i.headerData),
s=a.length-1;for(;a[s]===0;)s-=1;if(s<0)throw new Error("Decrypted message has n\
o record type indicator (all zeroes)");let o=a[s],h=a.subarray(0,s);if(!(o===21&&
h.length===2&&h[0]===1&&h[1]===0)){if(o===22&&h[0]===4)return gt(r,e,t);if(t!==void 0&&
o!==t)throw new Error(`Unexpected TLS record type 0x${o.toString(16).padStart(2,
"0")} (expected 0x${t.toString(16).padStart(2,"0")})`);return h}}async function ae(r,e,t){
let i=U(r,[t]),n=5,s=i.length+16,o=new D(n+s);o.writeUint8(23,0),o.writeUint16(771,
0),o.writeUint16(s,`${s} bytes follow`);let[h]=o.expectLength(s),y=o.array(),d=await e.
process(i,16,y);return o.writeBytes(d.subarray(0,d.length-16)),o.writeBytes(d.subarray(
d.length-16)),h(),o.array()}async function Ct(r,e,t){let i=Math.ceil(r.length/at),
n=[];for(let c=0;c<i;c++){let a=r.subarray(c*at,(c+1)*at),s=await ae(a,e,t);n.push(
s)}return n}var g=crypto.subtle;var $t=new TextEncoder;async function ut(r,e,t){let i=await g.importKey("raw",r,
{name:"HMAC",hash:{name:`SHA-${t}`}},!1,["sign"]);var n=new Uint8Array(await g.sign(
"HMAC",i,e));return n}async function oe(r,e,t,i){let n=i>>3,c=Math.ceil(t/n),a=new Uint8Array(
c*n),s=await g.importKey("raw",r,{name:"HMAC",hash:{name:`SHA-${i}`}},!1,["sign"]),
o=new Uint8Array(0);for(let h=0;h<c;h++){let y=U(o,e,[h+1]),d=await g.sign("HMAC",
s,y),m=new Uint8Array(d);a.set(m,n*h),o=m}return a.subarray(0,t)}var qt=$t.encode(
"tls13 ");async function I(r,e,t,i,n){let c=$t.encode(e),a=U([(i&65280)>>8,i&255],
[qt.length+c.length],qt,c,[t.length],t);return oe(r,a,i,n)}async function Pt(r,e,t,i,n){let c=i>>>3,a=new Uint8Array(c),s=await g.importKey(
"raw",r,{name:"ECDH",namedCurve:"P-256"},!1,[]),o=await g.deriveBits({name:"ECDH",
public:s},e,256),h=new Uint8Array(o),y=await g.digest("SHA-256",t),d=new Uint8Array(
y),m=await ut(new Uint8Array(1),a,i),l=await g.digest(`SHA-${i}`,new Uint8Array(
0)),A=new Uint8Array(l),C=await I(m,"derived",A,c,i),v=await ut(C,h,i),p=await I(
v,"c hs traffic",d,c,i),b=await I(v,"s hs traffic",d,c,i),K=await I(p,"key",new Uint8Array(
0),n,i),$=await I(b,"key",new Uint8Array(0),n,i),P=await I(p,"iv",new Uint8Array(
0),12,i),O=await I(b,"iv",new Uint8Array(0),12,i);return{serverHandshakeKey:$,serverHandshakeIV:O,
clientHandshakeKey:K,clientHandshakeIV:P,handshakeSecret:v,clientSecret:p,serverSecret:b}}
async function Ot(r,e,t,i){let n=t>>>3,c=new Uint8Array(n),a=await g.digest(`SHA\
-${t}`,new Uint8Array(0)),s=new Uint8Array(a),o=await I(r,"derived",s,n,t),h=await ut(
o,c,t),y=await I(h,"c ap traffic",e,n,t),d=await I(h,"s ap traffic",e,n,t),m=await I(
y,"key",new Uint8Array(0),i,t),l=await I(d,"key",new Uint8Array(0),i,t),A=await I(
y,"iv",new Uint8Array(0),12,t),C=await I(d,"iv",new Uint8Array(0),12,t);return{serverApplicationKey:l,
serverApplicationIV:C,clientApplicationKey:m,clientApplicationIV:A}}var tt=class{constructor(e,t,i){this.mode=e;this.key=t;this.initialIv=i;u(this,"\
recordsProcessed",0n);u(this,"priorPromise",Promise.resolve(new Uint8Array))}async process(e,t,i){
return this.sequence(this.processUnsequenced(e,t,i))}async sequence(e){let t=this.
priorPromise.then(()=>e);return this.priorPromise=t,t}async processUnsequenced(e,t,i){
let n=this.recordsProcessed;this.recordsProcessed+=1n;let c=this.initialIv.slice(),
a=BigInt(c.length),s=a-1n;for(let m=0n;m<a;m++){let l=n>>(m<<3n);if(l===0n)break;
c[Number(s-m)]^=Number(l&0xffn)}let o=t<<3,h={name:"AES-GCM",iv:c,tagLength:o,additionalData:i},
y=await g[this.mode](h,this.key,e);return new Uint8Array(y)}};function he(r){throw new Error(`Invalid base 64 character: ${String.fromCharCode(
r)}`)}function de(r){return r>64&&r<91?r-65:r>96&&r<123?r-71:r>47&&r<58?r+4:r===
43?62:r===47?63:r===61?64:he(r)}function vt(r,e=de,t=!0){let i=r.length;t&&(r+="=".repeat(i%4));let n=0,c=0,a=64,
s=64,o=64,h=64,y=new Uint8Array(i*.75);for(;n<i;)a=e(r.charCodeAt(n++)),s=e(r.charCodeAt(
n++)),o=e(r.charCodeAt(n++)),h=e(r.charCodeAt(n++)),y[c++]=a<<2|s>>4,y[c++]=(s&15)<<
4|o>>2,y[c++]=(o&3)<<6|h;let d=s===64?0:o===64?2:h===64?1:0;return y.subarray(0,
c-d)}var M=class extends D{readASN1Length(e){let t=this.readUint8();if(t<128)return t;
let i=t&127,n=0;if(i===1)return this.readUint8(n);if(i===2)return this.readUint16(
n);if(i===3)return this.readUint24(n);if(i===4)return this.readUint32(n);throw new Error(
`ASN.1 length fields are only supported up to 4 bytes (this one is ${i} bytes)`)}expectASN1Length(e){
let t=this.readASN1Length(e);return this.expectLength(t)}readASN1OID(e){let[t,i]=this.
expectASN1Length(0),n=this.readUint8(),c=`${Math.floor(n/40)}.${n%40}`;for(;i()>
0;){let a=0;for(;;){let s=this.readUint8();if(a<<=7,a+=s&127,s<128)break}c+=`.${a}`}
return t(),c}readASN1Boolean(e){let[t,i]=this.expectASN1Length(0),n=i();if(n!==1)
throw new Error(`Boolean has weird length: ${n}`);let c=this.readUint8(),a;if(c===
255)a=!0;else if(c===0)a=!1;else throw new Error(`Boolean has weird value: 0x${f(
[c])}`);return t(),a}readASN1UTCTime(){let[e,t]=this.expectASN1Length(0),n=this.
readUTF8String(t()).match(/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/);if(!n)throw new Error(
"Unrecognised ASN.1 UTC time format");let[,c,a,s,o,h,y]=n,d=parseInt(c,10),m=d+(d>=
50?1900:2e3),l=new Date(`${m}-${a}-${s}T${o}:${h}:${y}Z`);return e(),l}readASN1GeneralizedTime(){
let[e,t]=this.expectASN1Length(0),n=this.readUTF8String(t()).match(/^([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})?([0-9]{2})?([.][0-9]+)?(Z)?([-+][0-9]+)?$/);
if(!n)throw new Error("Unrecognised ASN.1 generalized time format");let[,c,a,s,o,
h,y,d,m,l]=n;if(y===void 0&&d!==void 0)throw new Error("Invalid ASN.1 generalize\
d time format (fraction without seconds)");if(m!==void 0&&l!==void 0)throw new Error(
"Invalid ASN.1 generalized time format (Z and timezone)");let A=new Date(`${c}-${a}\
-${s}T${o}:${h??"00"}:${y??"00"}${d??""}${l??"Z"}`);return e(),A}readASN1BitString(){
let[e,t]=this.expectASN1Length(0),i=this.readUint8(0),n=t(),c=this.readBytes(n);
if(i>7)throw new Error(`Invalid right pad value: ${i}`);if(i>0){let a=8-i;for(let s=n-
1;s>0;s--)c[s]=255&c[s-1]<<a|c[s]>>>i;c[0]=c[0]>>>i}return e(),c}};var ft=1,it=2,N=48,le=49,et=6,ye=19,me=20,ge=12,ue=22,kt=23,Lt=24,pt=5,G=4,xt=3,
Ft=163,nt=128;var fe={"2.5.4.6":"C","2.5.4.10":"O","2.5.4.11":"OU","2.5.4.3":"CN","2.5.4.7":"L",
"2.5.4.8":"ST","2.5.4.12":"T","2.5.4.42":"GN","2.5.4.43":"I","2.5.4.4":"SN","1.2\
.840.113549.1.9.1":"MAIL","2.5.4.5":"SERIALNUMBER"};function Bt(r){let{length:e}=r;if(e>4)throw new Error(`Bit string length ${e} wo\
uld overflow JS bit operators`);let t=0,i=0;for(let n=r.length-1;n>=0;n--)t|=r[n]<<
i,i+=8;return t}function It(r,e){let t={};r.expectUint8(N,0);let[i,n]=r.expectASN1Length(
0);for(;n()>0;){r.expectUint8(le,0);let[c]=r.expectASN1Length(0);r.expectUint8(N,
0);let[a]=r.expectASN1Length(0);r.expectUint8(et,0);let s=r.readASN1OID(),o=fe[s]??
s,h=r.readUint8();if(h!==ye){if(h!==ge){if(h!==ue){if(h!==me)throw new Error(`Un\
expected item type in certificate ${e}: 0x${f([h])}`)}}}let[y,d]=r.expectASN1Length(
0),m=r.readUTF8String(d());y(),a(),c();let l=t[o];l===void 0?t[o]=m:typeof l=="s\
tring"?t[o]=[l,m]:l.push(m)}return i(),t}function jt(r,e=0){let t=[],[i,n]=r.expectASN1Length(
0);for(;n()>0;){let c=r.readUint8(0),[a,s]=r.expectASN1Length(0),o;c===(e|2)?o=r.
readUTF8String(s()):o=r.readBytes(s()),t.push({name:o,type:c}),a()}return i(),t}
function Mt(r){let e={"1.2.840.113549.1.1.1":{name:"RSAES-PKCS1-v1_5"},"1.2.840.\
113549.1.1.5":{name:"RSASSA-PKCS1-v1_5",hash:{name:"SHA-1"}},"1.2.840.113549.1.1\
.11":{name:"RSASSA-PKCS1-v1_5",hash:{name:"SHA-256"}},"1.2.840.113549.1.1.12":{name:"\
RSASSA-PKCS1-v1_5",hash:{name:"SHA-384"}},"1.2.840.113549.1.1.13":{name:"RSASSA-\
PKCS1-v1_5",hash:{name:"SHA-512"}},"1.2.840.113549.1.1.10":{name:"RSA-PSS"},"1.2\
.840.113549.1.1.7":{name:"RSA-OAEP"},"1.2.840.10045.2.1":{name:"ECDSA",hash:{name:"\
SHA-1"}},"1.2.840.10045.4.1":{name:"ECDSA",hash:{name:"SHA-1"}},"1.2.840.10045.4\
.3.2":{name:"ECDSA",hash:{name:"SHA-256"}},"1.2.840.10045.4.3.3":{name:"ECDSA",hash:{
name:"SHA-384"}},"1.2.840.10045.4.3.4":{name:"ECDSA",hash:{name:"SHA-512"}},"1.3\
.133.16.840.63.0.2":{name:"ECDH",kdf:"SHA-1"},"1.3.132.1.11.1":{name:"ECDH",kdf:"\
SHA-256"},"1.3.132.1.11.2":{name:"ECDH",kdf:"SHA-384"},"1.3.132.1.11.3":{name:"E\
CDH",kdf:"SHA-512"},"2.16.840.1.101.3.4.1.2":{name:"AES-CBC",length:128},"2.16.8\
40.1.101.3.4.1.22":{name:"AES-CBC",length:192},"2.16.840.1.101.3.4.1.42":{name:"\
AES-CBC",length:256},"2.16.840.1.101.3.4.1.6":{name:"AES-GCM",length:128},"2.16.\
840.1.101.3.4.1.26":{name:"AES-GCM",length:192},"2.16.840.1.101.3.4.1.46":{name:"\
AES-GCM",length:256},"2.16.840.1.101.3.4.1.4":{name:"AES-CFB",length:128},"2.16.\
840.1.101.3.4.1.24":{name:"AES-CFB",length:192},"2.16.840.1.101.3.4.1.44":{name:"\
AES-CFB",length:256},"2.16.840.1.101.3.4.1.5":{name:"AES-KW",length:128},"2.16.8\
40.1.101.3.4.1.25":{name:"AES-KW",length:192},"2.16.840.1.101.3.4.1.45":{name:"A\
ES-KW",length:256},"1.2.840.113549.2.7":{name:"HMAC",hash:{name:"SHA-1"}},"1.2.8\
40.113549.2.9":{name:"HMAC",hash:{name:"SHA-256"}},"1.2.840.113549.2.10":{name:"\
HMAC",hash:{name:"SHA-384"}},"1.2.840.113549.2.11":{name:"HMAC",hash:{name:"SHA-\
512"}},"1.2.840.113549.1.9.16.3.5":{name:"DH"},"1.3.14.3.2.26":{name:"SHA-1"},"2\
.16.840.1.101.3.4.2.1":{name:"SHA-256"},"2.16.840.1.101.3.4.2.2":{name:"SHA-384"},
"2.16.840.1.101.3.4.2.3":{name:"SHA-512"},"1.2.840.113549.1.5.12":{name:"PBKDF2"},
"1.2.840.10045.3.1.7":{name:"P-256"},"1.3.132.0.34":{name:"P-384"},"1.3.132.0.35":{
name:"P-521"}}[r];if(e===void 0)throw new Error(`Unsupported algorithm identifie\
r: ${r}`);return e}function Vt(r,e=[]){return Object.values(r).forEach(t=>{typeof t==
"string"?e=[...e,t]:e=Vt(t,e)}),e}function _t(r){return Vt(r).join(" / ")}var pe=["digitalSignature","nonRepudiation","keyEncipherment","dataEncipherment",
"keyAgreement","keyCertSign","cRLSign","encipherOnly","decipherOnly"],rt=class r{constructor(e){
u(this,"serialNumber");u(this,"algorithm");u(this,"issuer");u(this,"validityPeri\
od");u(this,"subject");u(this,"publicKey");u(this,"signature");u(this,"keyUsage");
u(this,"subjectAltNames");u(this,"extKeyUsage");u(this,"authorityKeyIdentifier");
u(this,"subjectKeyIdentifier");u(this,"basicConstraints");u(this,"signedData");if(e instanceof
M||e instanceof Uint8Array){let t=e instanceof M?e:new M(e);t.expectUint8(N,0);let[
i]=t.expectASN1Length(0),n=t.offset;t.expectUint8(N,0);let[c]=t.expectASN1Length(
0);t.expectBytes([160,3,2,1,2],0),t.expectUint8(it,0);let[a,s]=t.expectASN1Length(
0);this.serialNumber=t.subarray(s()),a(),t.expectUint8(N,0);let[o,h]=t.expectASN1Length(
0);t.expectUint8(et,0),this.algorithm=t.readASN1OID(),h()>0&&(t.expectUint8(pt,0),
t.expectUint8(0,0)),o(),this.issuer=It(t,"issuer");let y,d;t.expectUint8(N,0);let[
m]=t.expectASN1Length(0),l=t.readUint8();if(l===kt)y=t.readASN1UTCTime();else if(l===
Lt)y=t.readASN1GeneralizedTime();else throw new Error(`Unexpected validity start\
 type 0x${f([l])}`);let A=t.readUint8();if(A===kt)d=t.readASN1UTCTime();else if(A===
Lt)d=t.readASN1GeneralizedTime();else throw new Error(`Unexpected validity end t\
ype 0x${f([A])}`);this.validityPeriod={notBefore:y,notAfter:d},m(),this.subject=
It(t,"subject");let C=t.offset;t.expectUint8(N,0);let[v]=t.expectASN1Length(0);t.
expectUint8(N,0);let[p,b]=t.expectASN1Length(0),K=[];for(;b()>0;){let J=t.readUint8();
if(J===et){let Y=t.readASN1OID();K.push(Y)}else J===pt&&t.expectUint8(0,0)}p(),t.
expectUint8(xt,0);let $=t.readASN1BitString();this.publicKey={identifiers:K,data:$,
all:t.data.subarray(C,t.offset)},v(),t.expectUint8(Ft,0);let[P]=t.expectASN1Length();
t.expectUint8(N,0);let[O,W]=t.expectASN1Length(0);for(;W()>0;){t.expectUint8(N,0);
let[J,Y]=t.expectASN1Length();t.expectUint8(et,0);let F=t.readASN1OID();if(F==="\
2.5.29.17"){t.expectUint8(G,0);let[k]=t.expectASN1Length(0);t.expectUint8(N,0);let S=jt(
t,nt);this.subjectAltNames=S.filter(L=>L.type===(2|nt)).map(L=>L.name),k()}else if(F===
"2.5.29.15"){let k,S=t.readUint8();if(S===ft&&(k=t.readASN1Boolean(0),S=t.readUint8()),
S!==G)throw new Error(`Expected 0x${f([G])}, got 0x${f([S])}`);let[L]=t.expectASN1Length(
0);t.expectUint8(xt,0);let R=t.readASN1BitString(),w=Bt(R),T=new Set(pe.filter((B,x)=>w&
1<<x));L(),this.keyUsage={critical:k,usages:T}}else if(F==="2.5.29.37"){this.extKeyUsage=
{},t.expectUint8(G,0);let[k]=t.expectASN1Length(0);t.expectUint8(N,0);let[S,L]=t.
expectASN1Length(0);for(;L()>0;){t.expectUint8(et,0);let R=t.readASN1OID();R==="\
1.3.6.1.5.5.7.3.1"&&(this.extKeyUsage.serverTls=!0),R==="1.3.6.1.5.5.7.3.2"&&(this.
extKeyUsage.clientTls=!0)}S(),k()}else if(F==="2.5.29.35"){t.expectUint8(G,0);let[
k]=t.expectASN1Length(0);t.expectUint8(N,0);let[S,L]=t.expectASN1Length(0);for(;L()>
0;){let R=t.readUint8();if(R===(nt|0)){let[w,T]=t.expectASN1Length(0);this.authorityKeyIdentifier=
t.readBytes(T()),w()}else if(R===(nt|1)){let[w,T]=t.expectASN1Length(0);t.skip(T(),
0),w()}else if(R===(nt|2)){let[w,T]=t.expectASN1Length(0);t.skip(T(),0),w()}else if(R===
(nt|33)){let[w,T]=t.expectASN1Length(0);t.skip(T(),0),w()}else throw new Error(`\
Unexpected data type ${R} in authorityKeyIdentifier certificate extension`)}S(),
k()}else if(F==="2.5.29.14"){t.expectUint8(G,0);let[k]=t.expectASN1Length(0);t.expectUint8(
G,0);let[S,L]=t.expectASN1Length(0);this.subjectKeyIdentifier=t.readBytes(L()),S(),
k()}else if(F==="2.5.29.19"){let k,S=t.readUint8();if(S===ft&&(k=t.readASN1Boolean(
0),S=t.readUint8()),S!==G)throw new Error("Unexpected type in certificate basic \
constraints");let[L]=t.expectASN1Length(0);t.expectUint8(N,0);let[R,w]=t.expectASN1Length(),
T;w()>0&&(t.expectUint8(ft,0),T=t.readASN1Boolean(0));let B;if(w()>0){t.expectUint8(
it,0);let x=t.readASN1Length(0);if(B=x===1?t.readUint8():x===2?t.readUint16():x===
3?t.readUint24():void 0,B===void 0)throw new Error("Too many bytes in max path l\
ength in certificate basicConstraints")}R(),L(),this.basicConstraints={critical:k,
ca:T,pathLength:B}}else t.skip(Y(),0);J()}O(),P(),c(),this.signedData=t.data.subarray(
n,t.offset),t.expectUint8(N,0);let[V,X]=t.expectASN1Length(0);t.expectUint8(et,0);
let H=t.readASN1OID(0);if(X()>0&&(t.expectUint8(pt,0),t.expectUint8(0,0)),V(),H!==
this.algorithm)throw new Error(`Certificate specifies different signature algori\
thms inside(${this.algorithm}) and out(${H})`);t.expectUint8(xt,0),this.signature=
t.readASN1BitString(),i()}else this.serialNumber=z(e.serialNumber),this.algorithm=
e.algorithm,this.issuer=e.issuer,this.validityPeriod={notBefore:new Date(e.validityPeriod.
notBefore),notAfter:new Date(e.validityPeriod.notAfter)},this.subject=e.subject,
this.publicKey={identifiers:e.publicKey.identifiers,data:z(e.publicKey.data),all:z(
e.publicKey.all)},this.signature=z(e.signature),this.keyUsage={critical:e.keyUsage.
critical,usages:new Set(e.keyUsage.usages)},this.subjectAltNames=e.subjectAltNames,
this.extKeyUsage=e.extKeyUsage,e.authorityKeyIdentifier&&(this.authorityKeyIdentifier=
z(e.authorityKeyIdentifier)),e.subjectKeyIdentifier&&(this.subjectKeyIdentifier=
z(e.subjectKeyIdentifier)),this.basicConstraints=e.basicConstraints,this.signedData=
z(e.signedData)}static distinguishedNamesAreEqual(e,t){return this.stringFromDistinguishedName(
e)===this.stringFromDistinguishedName(t)}static stringFromDistinguishedName(e){return Object.
entries(e).map(([t,i])=>typeof i=="string"?`${t}=${i.trim().replace(/[\\,]/g,"\\$\
&")}`:i.map(n=>`${t}=${n.trim().replace(/[\\,]/g,"\\$&")}`).join(", ")).join(", ")}subjectAltNameMatchingHost(e){
let t=/[.][^.]+[.][^.]+$/;return(this.subjectAltNames??[]).find(i=>{let n=i,c=e;
if(t.test(e)&&t.test(n)&&n.startsWith("*.")&&(n=n.slice(1),c=c.slice(c.indexOf("\
."))),n===c)return!0})}isValidAtMoment(e=new Date){return e>=this.validityPeriod.
notBefore&&e<=this.validityPeriod.notAfter}description(){return"subject: "+r.stringFromDistinguishedName(
this.subject)+(this.subjectAltNames?`
subject alt names: `+this.subjectAltNames.join(", "):"")+(this.subjectKeyIdentifier?
`
subject key id: ${f(this.subjectKeyIdentifier," ")}`:"")+`
issuer: `+r.stringFromDistinguishedName(this.issuer)+(this.authorityKeyIdentifier?
`
authority key id: ${f(this.authorityKeyIdentifier," ")}`:"")+`
validity: `+this.validityPeriod.notBefore.toISOString()+" \u2013 "+this.validityPeriod.
notAfter.toISOString()+` (${this.isValidAtMoment()?"currently valid":"not valid"}\
)`+(this.keyUsage?`
key usage (${this.keyUsage.critical?"critical":"non-critical"}): `+[...this.keyUsage.
usages].join(", "):"")+(this.extKeyUsage?`
extended key usage: TLS server \u2014\xA0${this.extKeyUsage.serverTls}, TLS clie\
nt \u2014\xA0${this.extKeyUsage.clientTls}`:"")+(this.basicConstraints?`
basic constraints (${this.basicConstraints.critical?"critical":"non-critical"}):\
 CA \u2014\xA0${this.basicConstraints.ca}, path length \u2014 ${this.basicConstraints.
pathLength}`:"")+`
signature algorithm: `+_t(Mt(this.algorithm))}toJSON(){return{serialNumber:f(this.
serialNumber),algorithm:this.algorithm,issuer:this.issuer,validityPeriod:{notBefore:this.
validityPeriod.notBefore.toISOString(),notAfter:this.validityPeriod.notAfter.toISOString()},
subject:this.subject,publicKey:{identifiers:this.publicKey.identifiers,data:f(this.
publicKey.data),all:f(this.publicKey.all)},signature:f(this.signature),keyUsage:{
critical:this.keyUsage?.critical,usages:[...this.keyUsage?.usages??[]]},subjectAltNames:this.
subjectAltNames,extKeyUsage:this.extKeyUsage,authorityKeyIdentifier:this.authorityKeyIdentifier&&
f(this.authorityKeyIdentifier),subjectKeyIdentifier:this.subjectKeyIdentifier&&f(
this.subjectKeyIdentifier),basicConstraints:this.basicConstraints,signedData:f(this.
signedData)}}static uint8ArraysFromPEM(e){let t="[A-Z0-9 ]+",i=new RegExp(`-----\
BEGIN ${t}-----([a-zA-Z0-9=+\\/\\n\\r]+)-----END ${t}-----`,"g"),n=[],c=null;for(;c=
i.exec(e);){let a=c[1].replace(/[\r\n]/g,""),s=vt(a);n.push(s)}return n}static fromPEM(e){
return this.uint8ArraysFromPEM(e).map(t=>new this(t))}},Q=class extends rt{static databaseFromPEM(e){
let t=this.uint8ArraysFromPEM(e),i=[0],n={},c=new yt;for(let s of t){let o=new this(
s),h=i.length-1;o.subjectKeyIdentifier&&(n[f(o.subjectKeyIdentifier)]=h),n[this.
stringFromDistinguishedName(o.subject)]=h,c.append(s),i[i.length]=i[h]+s.length}
let a=c.getData();return{index:{offsets:i,subjects:n},data:a}}static findInDatabase(e,t){
let{index:{subjects:i,offsets:n},data:c}=t,a=typeof e=="string"?e:rt.stringFromDistinguishedName(
e),s=i[a];if(s===void 0)return;let o=n[s],h=n[s+1],y=c.subarray(o,h);return new this(
y)}};async function St(r,e,t,i,n){r.expectUint8(N,0);let[c]=r.expectASN1Length(0);r.expectUint8(
it,0);let[a,s]=r.expectASN1Length(0),o=r.readBytes(s());a(),r.expectUint8(it,0);
let[h,y]=r.expectASN1Length(0),d=r.readBytes(y());h(),c();let m=(p,b)=>p.length>
b?p.subarray(p.length-b):p.length<b?U(new Uint8Array(b-p.length),p):p,l=i==="P-2\
56"?32:48,A=U(m(o,l),m(d,l)),C=await g.importKey("spki",e,{name:"ECDSA",namedCurve:i},
!1,["verify"]);if(await g.verify({name:"ECDSA",hash:n},C,A,t)!==!0)throw new Error(
"ECDSA-SECP256R1-SHA256 certificate verify failed")}async function zt(r,e,t,i=!0,n=!0){for(let h of e);let c=e[0];if(c.subjectAltNameMatchingHost(
r)===void 0)throw new Error(`No matching subjectAltName for ${r}`);if(!c.isValidAtMoment())
throw new Error("End-user certificate is not valid now");if(i&&!c.extKeyUsage?.serverTls)
throw new Error("End-user certificate has no TLS server extKeyUsage");let o=!1;for(let h=0,
y=e.length;h<y;h++){let d=e[h],m=d.authorityKeyIdentifier,l;if(m===void 0?l=Q.findInDatabase(
d.issuer,t):l=Q.findInDatabase(f(m),t),l===void 0&&(l=e[h+1]),l===void 0)throw new Error(
"Ran out of certificates before reaching trusted root");let A=l instanceof Q;if(l.
isValidAtMoment()!==!0)throw new Error("Signing certificate is not valid now");if(n&&
l.keyUsage?.usages.has("digitalSignature")!==!0)throw new Error("Signing certifi\
cate keyUsage does not include digital signatures");if(l.basicConstraints?.ca!==
!0)throw new Error("Signing certificate basicConstraints do not indicate a CA ce\
rtificate");let{pathLength:C}=l.basicConstraints;if(C!==void 0){if(C<h)throw new Error(
"Exceeded certificate pathLength")}if(d.algorithm==="1.2.840.10045.4.3.2"||d.algorithm===
"1.2.840.10045.4.3.3"){let v=d.algorithm==="1.2.840.10045.4.3.2"?"SHA-256":"SHA-\
384",p=l.publicKey.identifiers,b=p.includes("1.2.840.10045.3.1.7")?"P-256":p.includes(
"1.3.132.0.34")?"P-384":void 0;if(b===void 0)throw new Error("Unsupported signin\
g key curve");let K=new M(d.signature);await St(K,l.publicKey.all,d.signedData,b,
v)}else if(d.algorithm==="1.2.840.113549.1.1.11"||d.algorithm==="1.2.840.113549.\
1.1.12"){let v=d.algorithm==="1.2.840.113549.1.1.11"?"SHA-256":"SHA-384",p=await g.
importKey("spki",l.publicKey.all,{name:"RSASSA-PKCS1-v1_5",hash:v},!1,["verify"]);
if(await g.verify({name:"RSASSA-PKCS1-v1_5"},p,d.signature,d.signedData)!==!0)throw new Error(
"RSASSA_PKCS1-v1_5-SHA256 certificate verify failed")}else throw new Error("Unsu\
pported signing algorithm");if(A){o=!0;break}}return o}var xe=new TextEncoder;async function Gt(r,e,t,i,n,c=!0,a=!0){let s=new M(await e());
s.expectUint8(8,0);let[o]=s.expectLengthUint24(),[h,y]=s.expectLengthUint16(0);for(;y()>
0;){let x=s.readUint16(0);if(x===0)s.expectUint16(0,0);else if(x===10){let[q]=s.
expectLengthUint16(0),[j,_]=s.expectLengthUint16(0);for(;_()>0;){let ot=s.readUint16()}
j(),q()}else throw new Error(`Unsupported server encrypted extension type 0x${f(
[x]).padStart(4,"0")}`)}h(),o(),s.remaining()===0&&s.extend(await e());let d=!1,
m=s.readUint8();if(m===13){d=!0;let[x]=s.expectLengthUint24("certificate request\
 data");s.expectUint8(0,0);let[q,j]=s.expectLengthUint16("certificate request ex\
tensions");s.skip(j(),0),q(),x(),s.remaining()===0&&s.extend(await e()),m=s.readUint8()}
if(m!==11)throw new Error(`Unexpected handshake message type 0x${f([m])}`);let[l]=s.
expectLengthUint24(0);s.expectUint8(0,0);let[A,C]=s.expectLengthUint24(0),v=[];for(;C()>
0;){let[x]=s.expectLengthUint24(0),q=new rt(s);v.push(q),x();let[j,_]=s.expectLengthUint16(
"certificate extensions");s.skip(_()),j()}if(A(),l(),v.length===0)throw new Error(
"No certificates supplied");let p=v[0],b=s.data.subarray(0,s.offset),K=U(i,b),$=await g.
digest("SHA-256",K),P=new Uint8Array($),O=U(xe.encode(" ".repeat(64)+"TLS 1.3, s\
erver CertificateVerify"),[0],P);s.remaining()===0&&s.extend(await e()),s.expectUint8(
15,0);let[W]=s.expectLengthUint24(0),V=s.readUint16();if(V===1027){let[x]=s.expectLengthUint16();
await St(s,p.publicKey.all,O,"P-256","SHA-256"),x()}else if(V===2052){let[x,q]=s.
expectLengthUint16(),j=s.subarray(q());x();let _=await g.importKey("spki",p.publicKey.
all,{name:"RSA-PSS",hash:"SHA-256"},!1,["verify"]);if(await g.verify({name:"RSA-\
PSS",saltLength:32},_,j,O)!==!0)throw new Error("RSA-PSS-RSAE-SHA256 certificate\
 verify failed")}else throw new Error(`Unsupported certificate verify signature \
type 0x${f([V]).padStart(4,"0")}`);W();let X=s.data.subarray(0,s.offset),H=U(i,X),
J=await I(t,"finished",new Uint8Array(0),32,256),Y=await g.digest("SHA-256",H),F=await g.
importKey("raw",J,{name:"HMAC",hash:{name:"SHA-256"}},!1,["sign"]),k=await g.sign(
"HMAC",F,Y),S=new Uint8Array(k);s.remaining()===0&&s.extend(await e()),s.expectUint8(
20,0);let[L,R]=s.expectLengthUint24(0),w=s.readBytes(R());if(L(),s.remaining()!==
0)throw new Error("Unexpected extra bytes in server handshake");if(Z(w,S)!==!0)throw new Error(
"Invalid server verify hash");if(!await zt(r,v,n,c,a))throw new Error("Validated\
 certificate chain did not end in a trusted root");return[s.data,d]}async function Se(r,e,t,i,{useSNI:n,requireServerTlsExtKeyUsage:c,requireDigitalSigKeyUsage:a,
writePreData:s,expectPreData:o,commentPreData:h}={}){n??(n=!0),c??(c=!0),a??(a=!0),
typeof e=="string"&&(e=Q.databaseFromPEM(e));let y=await g.generateKey({name:"EC\
DH",namedCurve:"P-256"},!0,["deriveKey","deriveBits"]),d=await g.exportKey("raw",
y.publicKey),m=new Uint8Array(d),l=new Uint8Array(32);crypto.getRandomValues(l);
let C=bt(r,m,l,n).array(),v=s?U(s,C):C;if(i(v),o){let E=await t(o.length);if(!E||
!Z(E,o))throw new Error("Pre data did not match expectation")}let p=await mt(t,22);
if(p===void 0)throw new Error("Connection closed while awaiting server hello");let b=new D(
p.content),K=At(b,l),$=await mt(t,20);if($===void 0)throw new Error("Connection \
closed awaiting server cipher change");let P=new D($.content),[O]=P.expectLength(
1);P.expectUint8(1,0),O();let W=C.subarray(5),V=p.content,X=U(W,V),H=await Pt(K,
y.privateKey,X,256,16),J=await g.importKey("raw",H.serverHandshakeKey,{name:"AES\
-GCM"},!1,["decrypt"]),Y=new tt("decrypt",J,H.serverHandshakeIV),F=await g.importKey(
"raw",H.clientHandshakeKey,{name:"AES-GCM"},!1,["encrypt"]),k=new tt("encrypt",F,
H.clientHandshakeIV),S=async()=>{let E=await gt(t,Y,22);if(E===void 0)throw new Error(
"Premature end of encrypted server handshake");return E},[L,R]=await Gt(r,S,H.serverSecret,
X,e,c,a),w=new D(6);w.writeUint8(20,0),w.writeUint16(771,0);let T=w.writeLengthUint16();
w.writeUint8(1,0),T();let B=w.array(),x=new Uint8Array(0);if(R){let E=new D(8);E.
writeUint8(11,0);let st=E.writeLengthUint24("client certificate data");E.writeUint8(
0,0),E.writeUint24(0,0),st(),x=E.array()}let q=U(X,L,x),j=await g.digest("SHA-25\
6",q),_=new Uint8Array(j),ot=await I(H.clientSecret,"finished",new Uint8Array(0),
32,256),Ut=await g.importKey("raw",ot,{name:"HMAC",hash:{name:"SHA-256"}},!1,["s\
ign"]),Nt=await g.sign("HMAC",Ut,_),Jt=new Uint8Array(Nt),ht=new D(36);ht.writeUint8(
20,0);let Zt=ht.writeLengthUint24(0);ht.writeBytes(Jt),Zt();let Wt=ht.array(),Tt=await Ct(
U(x,Wt),k,22),Dt=_;if(x.length>0){let E=q.subarray(0,q.length-x.length),st=await g.
digest("SHA-256",E);Dt=new Uint8Array(st)}let dt=await Ot(H.handshakeSecret,Dt,256,
16),Xt=await g.importKey("raw",dt.clientApplicationKey,{name:"AES-GCM"},!0,["enc\
rypt"]),Yt=new tt("encrypt",Xt,dt.clientApplicationIV),te=await g.importKey("raw",
dt.serverApplicationKey,{name:"AES-GCM"},!0,["decrypt"]),ee=new tt("decrypt",te,
dt.serverApplicationIV),lt=!1;return[()=>{if(!lt){let E=U(B,...Tt);i(E),lt=!0}return gt(
t,ee)},async E=>{let st=lt;lt=!0;let Kt=await Ct(E,Yt,23),ne=st?U(...Kt):U(B,...Tt,
...Kt);i(ne)}]}var wt=class{constructor(){u(this,"queue");u(this,"outstandingRequest");this.queue=
[]}enqueue(e){this.queue.push(e),this.dequeue()}dequeue(){if(this.outstandingRequest===
void 0)return;let{resolve:e,bytes:t}=this.outstandingRequest,i=this.bytesInQueue();
if(i<t&&this.socketIsNotClosed())return;if(t=Math.min(t,i),t===0)return e(void 0);
this.outstandingRequest=void 0;let n=this.queue[0],c=n.length;if(c===t)return this.
queue.shift(),e(n);if(c>t)return this.queue[0]=n.subarray(t),e(n.subarray(0,t));
{let a=new Uint8Array(t),s=t,o=0;for(;s>0;){let h=this.queue[0],y=h.length;y<=s?
(this.queue.shift(),a.set(h,o),o+=y,s-=y):(this.queue[0]=h.subarray(s),a.set(h.subarray(
0,s),o),s-=s,o+=s)}return e(a)}}bytesInQueue(){return this.queue.reduce((e,t)=>e+
t.length,0)}async read(e){if(this.outstandingRequest!==void 0)throw new Error("C\
an\u2019t read while already awaiting read");return new Promise(t=>{this.outstandingRequest=
{resolve:t,bytes:e},this.dequeue()})}},Rt=class extends wt{constructor(t){super();
this.socket=t;t.addEventListener("message",i=>this.enqueue(new Uint8Array(i.data))),
t.addEventListener("close",()=>this.dequeue())}socketIsNotClosed(){let{socket:t}=this,
{readyState:i}=t;return i<=1}},Et=class extends wt{constructor(t){super();this.socket=
t;t.on("data",i=>this.enqueue(new Uint8Array(i))),t.on("close",()=>this.dequeue())}socketIsNotClosed(){
let{socket:t}=this,{readyState:i}=t;return i==="opening"||i==="open"}};function Qt(r,e=(i,n)=>n,t){return JSON.stringify(r,(n,c)=>e(n,typeof c!="object"||
c===null||Array.isArray(c)?c:Object.fromEntries(Object.entries(c).sort(([a],[s])=>a<
s?-1:a>s?1:0))),t)}export{Et as SocketReadQueue,Q as TrustedCert,Rt as WebSocketReadQueue,vt as base64Decode,
f as hexFromU8,Qt as stableStringify,Se as startTls,z as u8FromHex};

import { TrustedCert } from './cert';

// @ts-ignore
import isrgrootx1 from '../roots/isrg-root-x1.pem';
// @ts-ignore
import isrgrootx2 from '../roots/isrg-root-x2.pem';
// @ts-ignore
import cloudflare from '../roots/cloudflare.pem';
// @ts-ignore
import globalsign from '../roots/globalsign.pem';  // google.com
// @ts-ignore
import globalsignr3 from '../roots/globalsign-r3.pem';  // guardian.co.uk

export function getRootCerts() {
  return TrustedCert.fromPEM(isrgrootx1 + isrgrootx2 + cloudflare + globalsign + globalsignr3);
}

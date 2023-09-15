import { TrustedCert } from './cert';

// @ts-ignore
import isrgrootx1 from '../roots/isrg-root-x1.pem';
// @ts-ignore
import isrgrootx2 from '../roots/isrg-root-x2.pem';
// @ts-ignore
import baltimoreroot from '../roots/baltimore.pem';
// @ts-ignore
import digicertroot from '../roots/digicert-global-root.pem';

export function getRootCerts() {
  const rootCerts = TrustedCert.fromPEM(isrgrootx1 + isrgrootx2 + baltimoreroot + digicertroot);
  return rootCerts;
}

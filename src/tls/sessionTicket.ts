import { Bytes } from '../util/bytes';
import { log } from '../presentation/log';
import { highlightBytes } from '../presentation/highlights';
import { LogColours } from '../presentation/appearance';

export function parseSessionTicket(record: Uint8Array) {
  if (chatty) {
    const ticket = new Bytes(record);
    ticket.expectUint8(0x04, 'session ticket message ([RFC 8846 §4.6.1](https://datatracker.ietf.org/doc/html/rfc8446#section-4.6.1))');

    const [endTicketRecord] = ticket.expectLengthUint24('session ticket message');

    const ticketSeconds = ticket.readUint32();
    ticket.comment(`ticket lifetime in seconds: ${ticketSeconds} = ${ticketSeconds / 3600} hours`)

    ticket.readUint32('ticket age add');

    const [endTicketNonce, ticketNonceRemaining] = ticket.expectLengthUint8('ticket nonce');
    ticket.readBytes(ticketNonceRemaining());
    ticket.comment('ticket nonce');
    endTicketNonce();

    const [endTicket, ticketRemaining] = ticket.expectLengthUint16('ticket');
    ticket.readBytes(ticketRemaining());
    ticket.comment('ticket');
    endTicket();

    const [endTicketExts, ticketExtsRemaining] = ticket.expectLengthUint16('ticket extensions');
    if (ticketExtsRemaining() > 0) {
      ticket.readBytes(ticketExtsRemaining());
      ticket.comment('ticket extensions (ignored)');
    }
    endTicketExts();

    endTicketRecord();
    log(...highlightBytes(ticket.commentedString(), LogColours.server));
  }
}

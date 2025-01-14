import { Bytes } from '../util/bytes';
import { log } from '../presentation/log';
import { highlightBytes } from '../presentation/highlights';
import { LogColours } from '../presentation/appearance';

export async function parseSessionTicket(record: Uint8Array) {
  if (chatty) {
    const ticket = new Bytes(record);
    await ticket.expectUint8(0x04, 'session ticket message, per [RFC 8846 §4.6.1](https://datatracker.ietf.org/doc/html/rfc8446#section-4.6.1) (we do nothing with these)');

    const [endTicketRecord] = await ticket.expectLengthUint24('session ticket message');

    const ticketSeconds = await ticket.readUint32();
    ticket.comment(`ticket lifetime in seconds: ${ticketSeconds} = ${ticketSeconds / 3600} hours`)

    await ticket.readUint32('ticket age add');

    const [endTicketNonce, ticketNonceRemaining] = await ticket.expectLengthUint8('ticket nonce');
    await ticket.readBytes(ticketNonceRemaining());
    ticket.comment('ticket nonce');
    endTicketNonce();

    const [endTicket, ticketRemaining] = await ticket.expectLengthUint16('ticket');
    await ticket.readBytes(ticketRemaining());
    ticket.comment('ticket');
    endTicket();

    const [endTicketExts, ticketExtsRemaining] = await ticket.expectLengthUint16('ticket extensions');
    if (ticketExtsRemaining() > 0) {
      await ticket.readBytes(ticketExtsRemaining());
      ticket.comment('ticket extensions (ignored)');
    }
    endTicketExts();

    endTicketRecord();
    log(...highlightBytes(ticket.commentedString(), LogColours.server));
  }
}

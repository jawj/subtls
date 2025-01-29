import { Bytes } from './util/bytes';

export enum HTTP2FrameType {
  HEADERS = 0x01,
  SETTINGS = 0x04,
  GOAWAY = 0x07,
}

export const HTTP2FrameTypeNames = {
  0x01: 'HEADERS',
  0x04: 'SETTINGS',
  0x07: 'GOAWAY',
} as const;

/*
HTTP Frame {
  Length (24),
  Type (8),
  Flags (8),
  Reserved (1),
  Stream Identifier (31),
  Frame Payload (..),
}
*/

export function writeFrame(request: Bytes, type: HTTP2FrameType, streamId: number, flags = 0) {
  const frameLengthOffset = request.offset;
  request.skipWrite(3);
  request.writeUint8(type, chatty && `frame type: ${HTTP2FrameTypeNames[type]}`);
  request.writeUint8(flags, chatty && 'flag bits');
  request.writeUint32(streamId, chatty && `stream ID: ${streamId}`);
  request.changeIndent(1);
  const frameDataStart = request.offset;

  return () => {
    const frameEnd = request.offset;
    const frameLength = frameEnd - frameDataStart;
    request.offset = frameLengthOffset;
    request.writeUint24(frameLength, chatty && `HTTP/2 frame payload length: ${frameLength}`);
    request.offset = frameEnd;
    request.changeIndent(-1);
  };
}

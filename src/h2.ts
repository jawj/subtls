import { Bytes } from './util/bytes';

export enum HTTP2FrameType {
  DATA = 0x00,
  HEADERS = 0x01,
  PRIORITY = 0x02,
  RST_STREAM = 0x03,
  SETTINGS = 0x04,
  PUSH_PROMISE = 0x05,
  PING = 0x06,
  GOAWAY = 0x07,
  WINDOW_UPDATE = 0x08,
  CONTINUATION = 0x09,
}

export const HTTP2FrameTypeNames = {
  0x00: 'DATA',
  0x01: 'HEADERS',
  0x02: 'PRIORITY',
  0x03: 'RST_STREAM',
  0x04: 'SETTINGS',
  0x05: 'PUSH_PROMISE',
  0x06: 'PING',
  0x07: 'GOAWAY',
  0x08: 'WINDOW_UPDATE',
  0x09: 'CONTINUATION',
} as const;

export enum HTTP2SettingsType {
  SETTINGS_HEADER_TABLE_SIZE = 0x01,
  SETTINGS_ENABLE_PUSH = 0x02,
  SETTINGS_MAX_CONCURRENT_STREAMS = 0x03,
  SETTINGS_INITIAL_WINDOW_SIZE = 0x04,
  SETTINGS_MAX_FRAME_SIZE = 0x05,
  SETTINGS_MAX_HEADER_LIST_SIZE = 0x06,
}

export const HTTP2SettingsTypeNames = {
  0x01: 'SETTINGS_HEADER_TABLE_SIZE',
  0x02: 'SETTINGS_ENABLE_PUSH',
  0x03: 'SETTINGS_MAX_CONCURRENT_STREAMS',
  0x04: 'SETTINGS_INITIAL_WINDOW_SIZE',
  0x05: 'SETTINGS_MAX_FRAME_SIZE',
  0x06: 'SETTINGS_MAX_HEADER_LIST_SIZE',
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

export function writeFrame(request: Bytes, frameType: HTTP2FrameType, streamId: number, flags = 0, flagComments?: string) {
  const payloadLengthOffset = request.offset;
  request.skipWrite(3);
  request.writeUint8(frameType, chatty && `frame type: ${HTTP2FrameTypeNames[frameType]}`);
  request.writeUint8(flags, chatty && `flags: ${flagComments ?? 'none'}`);
  request.writeUint32(streamId, chatty && `stream ID: ${streamId}`);
  request.changeIndent(1);
  const payloadStart = request.offset;

  return () => {
    const frameEnd = request.offset;
    const payloadLength = frameEnd - payloadStart;
    request.offset = payloadLengthOffset;
    request.writeUint24(payloadLength, chatty && `HTTP/2 frame payload length: ${payloadLength} bytes`);
    request.offset = frameEnd;
    request.changeIndent(-1);
  };
}

export async function readFrame(response: Bytes) {
  const payloadLength = await response.readUint24();
  chatty && response.comment(`HTTP/2 frame payload length: ${payloadLength} bytes`);
  const frameType = await response.readUint8() as HTTP2FrameType;
  chatty && response.comment(`frame type: ${HTTP2FrameTypeNames[frameType]}`);
  const flags = await response.readUint8(chatty && 'flags');
  const streamId = await response.readUint32();
  chatty && response.comment(`stream ID: ${streamId}`);
  chatty && streamId === 0 && response.comment('(connection as a whole)');
  response.changeIndent(1);
  const payloadStart = response.offset;
  const payloadEndIndex = payloadStart + payloadLength;
  const payloadEnd = () => {
    if (response.offset !== payloadEndIndex) throw new Error('Not at payload end');
    response.changeIndent(-1);
  };
  const payloadRemaining = () => payloadEndIndex - response.offset;
  return { payloadEnd, payloadRemaining, frameType, flags, streamId };
}

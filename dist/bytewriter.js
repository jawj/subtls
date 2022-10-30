export default class ByteWriter {
    offset;
    arrayBuffer;
    dataView;
    uint8Array;
    constructor(maxBytes) {
        this.offset = 0;
        this.arrayBuffer = new ArrayBuffer(maxBytes);
        this.dataView = new DataView(this.arrayBuffer);
        this.uint8Array = new Uint8Array(this.arrayBuffer);
    }
    array() {
        return this.uint8Array.subarray(0, this.offset);
    }
    writeBytes(bytes) {
        this.uint8Array.set(bytes, this.offset);
        this.offset += bytes.length;
        return this;
    }
    subarray(length) {
        return this.uint8Array.subarray(this.offset, this.offset += length);
    }
    writeUint8(...args) {
        for (const arg of args) {
            this.dataView.setUint8(this.offset, arg);
            this.offset += 1;
        }
        return this;
    }
    writeUint16(...args) {
        for (const arg of args) {
            this.dataView.setUint16(this.offset, arg);
            this.offset += 2;
        }
        return this;
    }
    lengthUint8() {
        const { offset } = this;
        this.offset += 1;
        return () => {
            const length = this.offset - offset;
            this.dataView.setUint8(offset, length);
        };
    }
    lengthUint16() {
        const { offset } = this;
        this.offset += 2;
        return () => {
            const length = this.offset - offset;
            this.dataView.setUint16(offset, length);
        };
    }
    lengthUint24() {
        const { offset } = this;
        this.offset += 3;
        return () => {
            const length = this.offset - offset;
            this.dataView.setUint8(offset, (length & 0xff0000) >> 16);
            this.dataView.setUint16(offset, length & 0xffff);
        };
    }
}

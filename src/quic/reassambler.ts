interface Chunk {
  data: Uint8Array;
  offset: number;
}

export class Reassembler {
  chunks: Chunk[];


  constructor() {
    this.chunks = [];

  }

  addData(data: Uint8Array, offset: number) {

  }

  read() {

  }
}

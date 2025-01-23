const txtDec = new TextDecoder();

async function getFile(name: string) {
  try {
    // when in browser, using http
    const response = await fetch(name);
    const buf = await response.arrayBuffer();
    return buf;
  } catch {
    // when in Node, using filesystem
    const fs = await import('fs/promises');
    const buf = await fs.readFile(`docs/${name}`);
    return buf.buffer;
  }
}

async function getRootCertsIndex() {
  const file = await getFile('certs.index.json');
  const rootCertsIndex = JSON.parse(txtDec.decode(file));
  return rootCertsIndex;
}

async function getRootCertsData() {
  const file = await getFile('certs.binary.txt');
  const rootCertsData = new Uint8Array(file);
  return rootCertsData;
}

export async function getRootCertsDatabase() {
  const [index, data] = await Promise.all([getRootCertsIndex(), getRootCertsData()]);
  return { index, data };
}

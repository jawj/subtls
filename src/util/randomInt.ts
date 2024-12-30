import { getRandomValues } from './cryptoRandom';

const randUint32 = new Uint32Array(1);
const maxUint32 = 2 ** 32 - 1;

export async function randomIntBetween(lowestIncl: number, highestIncl: number) {
  const range = highestIncl - lowestIncl;
  if (range === 0) return lowestIncl;
  if (range < 0) throw new Error('Upper bound cannot be below lower bound');
  if (range > maxUint32) throw new Error(`Range cannot exceed ${maxUint32}`);

  const maxUsable = Math.floor(maxUint32 / range) * range;  // if we use values above this we will bias the output, reducing entropy
  do { await getRandomValues(randUint32); } while (randUint32[0] > maxUsable);

  return lowestIncl + randUint32[0] % (range + 1);
}

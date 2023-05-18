export default function stableStringify(
  x: any,
  replacer: (key: string, value: any) => any = (_, v) => v,
  indent?: string | number
) {

  const deterministicReplacer = (k: string, v: any) => replacer(k,
    typeof v !== 'object' || v === null || Array.isArray(v) ? v :
      Object.fromEntries(Object.entries(v).sort(([ka], [kb]) =>
        ka < kb ? -1 : ka > kb ? 1 : 0))
  );

  return JSON.stringify(x, deterministicReplacer, indent);
}

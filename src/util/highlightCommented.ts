
export default function (s: string, colour: string) {
  const css: string[] = [];
  s = s.replace(/\S  .+/gm, m => {
    css.push(`color: ${colour}`, 'color: inherit');
    return `${m.charAt(0)}%c${m.slice(1)}%c`;
  });
  return [s, ...css];
}
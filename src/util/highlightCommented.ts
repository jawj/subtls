
export default function (s: string, colour: string) {
  const css: string[] = [];
  s = s.replace(/  .+$/gm, m => {
    css.push(`color: ${colour}`, 'color: inherit');
    return `%c${m}%c`;
  });
  return [s, ...css];
}
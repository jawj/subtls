
import { indentChars } from './bytes';

const regex = new RegExp(`  .+|^(${indentChars})+`, 'gm');

export default function (s: string, colour: string) {
  const css: string[] = [];
  s = s.replace(regex, m => {
    css.push(m.startsWith(indentChars) ? `color: #ddd` : `color: ${colour}`, 'color: inherit');
    return `%c${m}%c`;
  });
  return [s, ...css];
}
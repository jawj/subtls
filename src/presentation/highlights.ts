
import { indentChars } from './appearance';

const regex = new RegExp(`  .+|^(${indentChars})+`, 'gm');

export function highlightBytes(s: string, colour: string) {
  const css: string[] = ['color: #111'];
  s = '%c' + s.replace(regex, m => {
    css.push(m.startsWith(indentChars) ? 'color: #ddd' : `color: ${colour}`, 'color: #111');
    return `%c${m}%c`;
  });
  return [s, ...css];
}

export function highlightColonList(s: string) {
  const css: string[] = [];
  s = s.replace(/^[^:]+:.*$/gm, m => {
    const colonIndex = m.indexOf(':');
    css.push('color: #777', 'color: #111');
    return `%c${m.slice(0, colonIndex + 1)}%c${m.slice(colonIndex + 1)}`;
  });
  return [s, ...css];
}
function htmlEscape(s: string, linkUrls = true, abbreviateUrls = true): string {
  const escapes = {  // initialize here, not globally, or this appears in exported output
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  };
  const regexp = new RegExp(
    (linkUrls ? `\\bhttps?:[/][/][^\\s\\u200b"'<>]+[^\\s\\u200b"'<>.),:;?!]\\b|` : '') +
    '[' + Object.keys(escapes).join('') + ']',
    'gi'
  );
  const replaced = s.replace(regexp, match =>
    match.length === 1 ?
      escapes[match as keyof typeof escapes] :
      `<a title="${match}" target="_blank" href="${match}">${htmlEscape(abbreviateUrls ? match.match(/^https?:[/][/]([^/]+([/]([^/]+)))/)![1] : match, false)}</a>`);

  return replaced;
};

function htmlFromLogArgs(...args: string[]) {
  let
    result = '<span>',
    arg: string | undefined,
    matchArr: RegExpExecArray | null,
    separator = '';

  while ((arg = args.shift()) !== undefined) {
    arg = separator + htmlEscape(String(arg));
    separator = ' ';  // omit space only for first arg

    const formatRegExp = /([\s\S]*?)%([csoOidf])|[\s\S]+/g;  // define it here so lastIndex === 0
    while ((matchArr = formatRegExp.exec(arg)) !== null) {
      const [whole, literal, sub] = matchArr;

      if (sub === undefined) {  // last portion
        result += whole;

      } else {
        result += literal;
        if (sub === 'c') {
          result += `</span><span style="${args.shift()!}">`;
        } else if (sub === 's') {
          result += args.shift();
        } else if (sub === 'o' || sub === 'O') {
          result += JSON.stringify(args.shift(), undefined, sub === 'O' ? 2 : undefined);
        } else if (sub === 'i' || sub === 'd' || sub === 'f') {
          // TODO: stop ignoring number formatting for i/d/f
          result += String(args.shift());
        }
      }
    }
  }
  result += '</span>';
  return result;
}

let c = 0;
export function log(...args: any[]) {
  // if (!chatty) throw new Error('No logs should be emitted outside of chatty mode');
  console.log(...args, '\n');
  if (typeof document === 'undefined') return;

  const docEl = document.documentElement;
  const fullyScrolled = docEl.scrollTop >= docEl.scrollHeight - docEl.clientHeight - 1 ||  // the -1 makes this work in Edge
    docEl.clientHeight >= docEl.scrollHeight;

  const element = document.querySelector('#logs')!;  // initialize here, not globally, or this appears in exported output
  element.innerHTML += `<label><input type="checkbox" name="c${c++}" checked="checked"><div class="section">` + htmlFromLogArgs(...args) + `</div></label>`;

  if (fullyScrolled) window.scrollTo({ top: 99999, behavior: 'auto' });
}

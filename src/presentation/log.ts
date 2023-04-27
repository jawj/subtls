
let
  element: Element,
  escapes: Record<string, string>,
  regexp: RegExp;

function htmlEscape(s: string) {
  escapes ??= {  // initialize here, not globally, or this appears in exported output
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  };
  regexp ??= new RegExp('[' + Object.keys(escapes).join('') + ']', 'g');  // ditto
  return s.replace(regexp, match => escapes[match])
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

  element ??= document.querySelector('#logs')!;  // initialize here, not globally, or this appears in exported output
  element.innerHTML += `<label><input type="checkbox" name="c${c++}"><div class="section">` + htmlFromLogArgs(...args) + `</div></label>`;
  // document.body.scrollTo({ top: 999999 });
}

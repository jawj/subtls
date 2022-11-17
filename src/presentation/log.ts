const element = document.querySelector('#logs')!;

function htmlFromLogArgs(...args: string[]) {
  let
    result = '<span>',
    arg: string | undefined,
    matchArr: RegExpExecArray | null;

  while ((arg = args.shift()) !== undefined) {

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

export function log(...args: any[]) {
  console.log(...args);
  element.innerHTML += '<div>' + htmlFromLogArgs(...args) + '</div>';
}
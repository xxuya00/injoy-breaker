// 참가자를 구분하는 값(=id)이자, 로그아웃한 뒤 다시 들어올 때 쓰는 복구 코드.
//
// 예전에는 본명이 곧 id였다. 그러면 동명이인이 서로의 기록을 덮어쓰고, 남의 이름만 알면
// 그 사람 기록으로 들어갈 수도 있다. 그래서 이제 id는 "닉네임#숫자세자리"이고,
// 본명으로는 다시 들어올 수 없다.
//
// 숫자 세 자리는 같은 닉네임을 쓴 사람끼리만 구분하면 되므로 900가지로 충분하다.
// 그래도 겹칠 수 있어서, 등록할 때 시트에 이미 있는 코드면 다시 뽑는다(AppContext).

const SEP = '#';

export function makePlayerCode(nickname: string): string {
  return `${nickname}${SEP}${100 + Math.floor(Math.random() * 900)}`;
}

// 옮겨 적다 보면 공백이 끼거나 #을 -로 바꿔 적는다. 맨 끝 숫자 세 자리 앞의 기호만
// #으로 맞춰주고, 닉네임 안에 들어있는 기호는 건드리지 않는다.
export function normalizePlayerCode(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '')
    .replace(/[#\-–—/]?(\d{3})$/, `${SEP}$1`);
}

// 본명만 적어 넣은 경우를 걸러내, 무엇이 잘못됐는지 알려주기 위한 확인.
export function looksLikePlayerCode(v: string): boolean {
  return /[^#]#\d{3}$/.test(v);
}

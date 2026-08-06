function doGet(e) {
  var action = e.parameter.action;
  if (action === 'leaderboard') return leaderboard_();
  if (action === 'getPlayer') return getPlayer_(e.parameter.id);
  if (action === 'getPrayers') return getPrayers_(e.parameter.group);
  if (action === 'getNotices') return getNotices_();
  if (action === 'getLocks') return getLocks_();
  if (action === 'getTeamScores') return getTeamScores_();
  if (action === 'getTypeResult') return getTypeResult_(e.parameter.playerId);
  return json_({ error: 'unknown action' });
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var action = body.action;
  if (action === 'savePlayer') return savePlayer_(body);
  if (action === 'addPrayer') return addPrayer_(body);
  if (action === 'editPrayer') return editPrayer_(body);
  if (action === 'prayFor') return prayFor_(body);
  if (action === 'saveTypeResult') return saveTypeResult_(body);
  if (action === 'addMessage') return addMessage_(body);
  return json_({ error: 'unknown action' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function nowKST_() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}

// ---------------------------------------------------------------------------
// 시트 접근 공통 — 칸을 "위치"가 아니라 "헤더 이름"으로 찾는다
// ---------------------------------------------------------------------------
// 예전에는 data[i][13] 처럼 몇 번째 칸인지로 읽었다. 그러다 보니 시트에서 칸 하나만
// 지우거나 순서를 바꿔도 뒤가 통째로 밀려서, 겉보기엔 멀쩡한데 값이 어긋나 있었다.
// 이제는 1행(헤더)을 먼저 읽어 이름 → 위치 지도를 만들고 그 지도로만 읽고 쓴다.
// 덕분에 시트에서 칸을 지우든 순서를 바꾸든 관리자가 메모 칸을 끼워 넣든 안 깨진다.

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
  }
  return sh;
}

// 1행을 읽어 { 칸이름: 위치 } 지도를 만든다.
function headerMap_(sh) {
  var width = sh.getLastColumn();
  if (width < 1) return {};
  var names = sh.getRange(1, 1, 1, width).getValues()[0];
  var map = {};
  for (var i = 0; i < names.length; i++) {
    var key = String(names[i]).trim();
    if (key) map[key] = i;
  }
  return map;
}

// 코드가 쓰는 칸 중 시트에 없는 것만 맨 뒤에 덧붙인다.
// 통째로 덮어쓰지 않기 때문에 관리자가 바꿔둔 순서나 직접 추가한 칸이 그대로 살아남는다.
function ensureHeaders_(sh, headers) {
  var map = headerMap_(sh);
  var missing = [];
  for (var i = 0; i < headers.length; i++) {
    if (map[headers[i]] === undefined) missing.push(headers[i]);
  }
  if (missing.length) {
    sh.getRange(1, sh.getLastColumn() + 1, 1, missing.length).setValues([missing]);
    map = headerMap_(sh);
  }
  return map;
}

// 시트 하나를 다룰 때 필요한 것(시트 + 헤더 지도)을 한 번에 준비한다.
function ctx_(name, headers) {
  var sh = sheet_(name, headers);
  return { sh: sh, map: ensureHeaders_(sh, headers) };
}

// 행에서 칸 하나를 이름으로 읽는다. 시트에 그 칸이 없으면 빈 값.
function cell_(row, map, name) {
  var i = map[name];
  return i === undefined ? '' : row[i];
}

// 특정 칸의 값이 일치하는 행을 찾아 시트 행 번호를 돌려준다(없으면 -1).
// 숫자처럼 생긴 id(예: 실명이 숫자)는 시트가 숫자로 저장해버려서 문자열 비교가 어긋난다.
// 그래서 양쪽 모두 문자열로 맞춘 뒤 비교한다.
function findRow_(data, map, name, value) {
  var col = map[name];
  if (col === undefined) return -1;
  var want = String(value);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col]) === want) return i + 1;
  }
  return -1;
}

// values({ 칸이름: 값 })를 그 시트의 현재 칸 순서에 맞춰 저장한다.
// rowIndex가 0 이하면 새 행으로 덧붙인다.
// values에 없는 칸은 기존 값을 그대로 둔다 — 관리자가 손으로 적어둔 메모 칸이 지워지지 않는다.
function saveRow_(sh, map, rowIndex, values, prev) {
  var width = sh.getLastColumn();
  var row = [];
  for (var i = 0; i < width; i++) {
    row[i] = prev && prev[i] !== undefined && prev[i] !== null ? prev[i] : '';
  }
  for (var key in values) {
    if (map[key] !== undefined) row[map[key]] = values[key];
  }
  if (rowIndex > 0) sh.getRange(rowIndex, 1, 1, width).setValues([row]);
  else sh.appendRow(row);
}

// ---------------------------------------------------------------------------
// 시트별 칸 목록
// ---------------------------------------------------------------------------
// 이름으로 찾으므로 여기 순서는 "새 시트를 처음 만들 때의 순서"일 뿐이다.
// 칸을 추가할 때 더 이상 맨 뒤에 붙일 필요도, 기존 시트의 순서를 맞출 필요도 없다.

// vow : 등록할 때 적은 "나의 다짐". 참가자 본인이 여정 화면에서 다시 꺼내 보는 글이고,
//        기기를 바꿔도 따라오도록 여기에 함께 남긴다.
var PLAYERS_HEADERS = ['id', 'nick', 'day', 'opened', 'score', 'updated_at', 'nickname', 'group', 'vow'];
// pray_count : 조원들이 "함께 기도하기"를 누른 횟수. 이름 없이 숫자만 쌓인다
//              (누가 눌렀는지는 기록하지 않고, 중복 방지는 각자 기기에서만 한다).
// author_id  : 남긴 사람의 참가자 id. 본인만 고칠 수 있게 하려고 둔다. 이 칸이 생기기 전에
//              쌓인 행은 비어 있어서, 그때는 실명(nick)이 같은지로 본인을 가린다.
// edited_at  : 고친 시각. 비어 있으면 한 번도 고치지 않은 글이다.
var PRAYERS_HEADERS = ['id', 'group', 'nick', 'text', 'created_at', 'pray_count', 'author_id', 'edited_at'];
var NOTICES_HEADERS = ['id', 'title', 'body', 'created_at'];
var LOCKS_HEADERS = ['id', 'name', 'unlock_at', 'note', 'locked'];
// urgent 칸은 없앴다. "지금 바로 도움이 필요해요"를 스스로 켜고 끄게 두면 급한 일과
// 그렇지 않은 일이 보내는 사람 기준으로 갈려, 정작 급한 신고가 묻힌다.
// 이미 만들어진 시트에 남아 있는 urgent 열은 이제 아무것도 쓰지 않으니 손으로 지우면 된다.
var MESSAGES_HEADERS = ['id', 'playerId', 'nick', 'text', 'created_at'];
// 조별 순위판에 진행자가 직접 얹는 점수. 자물쇠를 깬 만큼 자동으로 오르는 점수 위에 더해진다.
//  · bonus : 더할 점수. 음수를 적으면 깎인다(감점).
//  · note  : 왜 얹었는지(예: "레크리에이션 1위"). 참가자 화면에 그대로 보인다.
var TEAM_SCORES_HEADERS = ['group', 'bonus', 'note'];

// typeResults 칸 읽는 법
//  · walkCode  : 묵상+기도를 하나로 요약한 유형
//                B=쌓는 자(규칙·밖으로) / D=머무는 자(규칙·안으로)
//                F=흐르는 자(흐름·밖으로) / S=스미는 자(흐름·안으로)
//  · medType   : 묵상 유형. 앞이 리듬(R=규칙, S=흐름), 뒤가 방법(W=기록, M=마음)
//  · prayType  : 기도 유형. 앞이 리듬(R=규칙, S=흐름), 뒤가 표현(V=소리, Si=침묵)
//  · medSocial : G=함께 나눌 때, A=혼자일 때 은혜받는 편
//  · prayFocus : O=대부분 나를 위해, B=나와 남을 비슷하게 기도
//  · idolScores : 6개 우상 카테고리 원점수 (1·2위만으로는 분포를 볼 수 없어서 함께 남긴다)
//  · consistency: 같은 주제 안에서 답이 얼마나 모였는지 (0~100)
//  · clarity    : 주제끼리 얼마나 갈렸는지 (0~100). 낮으면 1·2위 차이가 크지 않다는 뜻
//  · flat       : TRUE면 답이 두세 종류뿐이거나 같은 답이 20문항 넘게 이어진 경우
//                 (문항을 읽지 않은 응답일 수 있어, 이 경우 참가자 화면의 신뢰도 색도 최하로 내려간다)
// consistency/clarity/flat은 참가자 화면에 숫자로 보이지 않는다. 인도자만 보는 값이다.
//
// 다른 칸에서 그대로 유도되는 값은 적지 않는다 —
// medTypeName('말씀 저널러')·prayTypeName·walkName('쌓는 자')은 위 코드에서 바로 나오고,
// 게다가 결과 화면에서 칭호를 뺀 뒤로는 참가자가 본 적도 없는 이름이라 오히려 헷갈린다.
// 행마다 붙던 uuid(id)도 playerId가 이미 키라서 쓰이는 데가 없어 뺐다.
//
// 앱이 다시 읽어가는 칸은 playerId·answers·version 세 개뿐이고, 나머지는 전부
// 인도자가 시트에서 바로 보라고 풀어 적은 것이다.
// 여기서 이름을 빼면 그 칸은 더 이상 기록되지 않는다(시트에서만 지우면 다음 저장 때 되살아난다).
var TYPE_RESULTS_HEADERS = [
  'playerId', 'nick',
  'idolPrimary', 'idolSecondary', 'comboName',
  'medType', 'prayType',
  'medTime', 'prayTime', 'created_at', 'answers', 'version',
  'walkCode', 'medSocial', 'prayFocus', 'idolScores',
  'consistency', 'clarity', 'flat',
];

function playersCtx_() {
  return ctx_('players', PLAYERS_HEADERS);
}
function prayersCtx_() {
  return ctx_('prayers', PRAYERS_HEADERS);
}
function noticesCtx_() {
  return ctx_('notices', NOTICES_HEADERS);
}
function locksCtx_() {
  return ctx_('locks', LOCKS_HEADERS);
}
function messagesCtx_() {
  return ctx_('messages', MESSAGES_HEADERS);
}
function typeResultsCtx_() {
  return ctx_('typeResults', TYPE_RESULTS_HEADERS);
}
function teamScoresCtx_() {
  return ctx_('teamScores', TEAM_SCORES_HEADERS);
}

// ---------------------------------------------------------------------------
// 참가자 진행도
// ---------------------------------------------------------------------------

function savePlayer_(body) {
  var c = playersCtx_();
  var data = c.sh.getDataRange().getValues();
  var rowIndex = findRow_(data, c.map, 'id', body.id);
  // 관리자가 이 시트에서 참가자 행을 지웠는데 그 사람 폰에 앱이 켜져 있으면,
  // 다음 진행 저장 때 행이 새로 만들어져 지운 기록이 되살아난다.
  // 그래서 신규 등록(create: true)이 아닌 저장은 기존 행이 있을 때만 반영하고,
  // 행이 없으면 missing을 돌려줘 앱이 스스로 로그아웃하도록 한다.
  if (rowIndex < 0 && !body.create) {
    return json_({ ok: false, missing: true });
  }
  var values = {
    id: body.id,
    nick: body.nick,
    day: body.day,
    opened: JSON.stringify(body.opened || {}),
    score: body.score,
    updated_at: nowKST_(),
  };
  // 닉네임·조·다짐은 값 없이 넘어오면(예: 기존 진행 저장) 기존 값을 지우지 않도록 아예 건드리지 않는다.
  if (body.nickname) values.nickname = body.nickname;
  if (body.group) values.group = body.group;
  if (body.vow) values.vow = body.vow;
  saveRow_(c.sh, c.map, rowIndex, values, rowIndex > 0 ? data[rowIndex - 1] : null);
  return json_({ ok: true });
}

function getPlayer_(id) {
  var c = playersCtx_();
  var data = c.sh.getDataRange().getValues();
  var rowIndex = findRow_(data, c.map, 'id', id);
  if (rowIndex < 0) return json_(null);
  var row = data[rowIndex - 1];
  return json_({
    id: cell_(row, c.map, 'id'),
    nick: cell_(row, c.map, 'nick'),
    day: cell_(row, c.map, 'day'),
    opened: JSON.parse(cell_(row, c.map, 'opened') || '{}'),
    score: cell_(row, c.map, 'score'),
    nickname: cell_(row, c.map, 'nickname') || '',
    group: cell_(row, c.map, 'group') || '',
    vow: cell_(row, c.map, 'vow') || '',
  });
}

function leaderboard_() {
  var c = playersCtx_();
  var data = c.sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    rows.push({
      id: cell_(data[i], c.map, 'id'),
      nick: cell_(data[i], c.map, 'nick'),
      score: Number(cell_(data[i], c.map, 'score')) || 0,
    });
  }
  rows.sort(function (a, b) {
    return b.score - a.score;
  });
  return json_(rows.slice(0, 20));
}

// ---------------------------------------------------------------------------
// 기도제목 · 공지 · 건의함
// ---------------------------------------------------------------------------

function addPrayer_(body) {
  var c = prayersCtx_();
  var id = Utilities.getUuid();
  saveRow_(c.sh, c.map, -1, {
    id: id,
    group: body.group,
    nick: body.nick,
    text: body.text,
    created_at: nowKST_(),
    pray_count: 0,
    author_id: body.authorId || '',
    edited_at: '',
  });
  return json_({ ok: true, id: id });
}

// 본인이 남긴 기도제목의 글만 고친다. 조·이름·올린 시각·함께 기도한 수는 그대로 두고,
// 고친 시각만 따로 적어 목록에서 "고침"으로 알린다.
// 본인 확인은 author_id로 한다. 그 칸이 생기기 전에 쌓인 행은 비어 있으므로,
// 그때만 실명(nick)이 같은지로 갈음한다(같은 조에 동명이인이 있으면 서로의 글도 고칠 수 있다 —
// 이 앱은 로그인이 없어서 여기까지가 한계다).
function editPrayer_(body) {
  var c = prayersCtx_();
  var data = c.sh.getDataRange().getValues();
  var row = findRow_(data, c.map, 'id', body.id);
  if (row < 0) return json_({ error: '기도제목을 찾을 수 없어요' });
  var prev = data[row - 1];
  var owner = String(cell_(prev, c.map, 'author_id') || '');
  var ok = owner ? owner === String(body.authorId || '') : String(cell_(prev, c.map, 'nick')) === String(body.nick);
  if (!ok) return json_({ error: '내가 남긴 기도제목만 고칠 수 있어요' });
  var text = String(body.text || '').trim();
  if (!text) return json_({ error: '내용을 적어주세요' });
  saveRow_(c.sh, c.map, row, { text: text, edited_at: nowKST_() }, prev);
  return json_({ ok: true });
}

// "함께 기도하기"를 누르면 그 행의 숫자만 1 올린다.
// 여러 명이 같은 순간에 누르면 읽은 값이 서로 겹쳐 하나가 사라지므로(읽고→더하고→쓰는 사이),
// 잠금을 걸어 한 번에 한 명씩 처리한다. 잠금을 못 잡으면 올리지 않고 실패를 알린다.
function prayFor_(body) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ error: '잠시 뒤 다시 시도해주세요' });
  try {
    var c = prayersCtx_();
    var data = c.sh.getDataRange().getValues();
    var row = findRow_(data, c.map, 'id', body.id);
    if (row < 0) return json_({ error: '기도제목을 찾을 수 없어요' });
    var col = c.map['pray_count'];
    if (col === undefined) return json_({ error: 'pray_count 칸이 없어요' });
    var next = (Number(data[row - 1][col]) || 0) + 1;
    c.sh.getRange(row, col + 1).setValue(next);
    return json_({ ok: true, prayCount: next });
  } finally {
    lock.releaseLock();
  }
}

function getPrayers_(group) {
  var c = prayersCtx_();
  var data = c.sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    if (String(cell_(data[i], c.map, 'group')) !== String(group)) continue;
    rows.push({
      id: cell_(data[i], c.map, 'id'),
      group: cell_(data[i], c.map, 'group'),
      nick: cell_(data[i], c.map, 'nick'),
      text: cell_(data[i], c.map, 'text'),
      createdAt: cell_(data[i], c.map, 'created_at'),
      prayCount: Number(cell_(data[i], c.map, 'pray_count')) || 0,
      authorId: String(cell_(data[i], c.map, 'author_id') || ''),
      editedAt: String(cell_(data[i], c.map, 'edited_at') || ''),
    });
  }
  rows.reverse();
  return json_(rows);
}

function getNotices_() {
  var c = noticesCtx_();
  var data = c.sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    rows.push({
      id: cell_(data[i], c.map, 'id'),
      title: cell_(data[i], c.map, 'title'),
      body: cell_(data[i], c.map, 'body'),
      createdAt: cell_(data[i], c.map, 'created_at'),
    });
  }
  rows.reverse();
  return json_(rows);
}

// 참가자가 보낸 건의/신고는 앱에서 다시 읽어오지 않고 이 시트에만 쌓인다(관리자 전용).
// 시트 메뉴 "도구 → 알림 규칙"에서 "변경사항이 있을 때 알림"을 켜두면
// 새 메시지가 올 때마다 이메일로 바로 알림을 받을 수 있다(무료, 긴급 대응용).
function addMessage_(body) {
  var c = messagesCtx_();
  var id = Utilities.getUuid();
  saveRow_(c.sh, c.map, -1, {
    id: id,
    playerId: body.playerId,
    nick: body.nick,
    text: body.text,
    created_at: nowKST_(),
  });
  return json_({ ok: true, id: id });
}

// ---------------------------------------------------------------------------
// 자물쇠 개방 조건
// ---------------------------------------------------------------------------

function toKSTIso_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  var s = String(v).trim();
  return s === '' ? null : s;
}

function isTrue_(v) {
  if (v === true) return true;
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return s === 'true' || s === 'y' || s === 'yes' || s === '1' || s === 'o' || s === '잠금';
}

// locks 시트를 읽어 각 자물쇠·구역의 개방 조건을 내려줍니다.
// - unlock_at 에 시각을 적으면 그 시각이 지나야 열립니다.
// - locked 에 TRUE 를 적으면 시각과 무관하게 계속 잠깁니다(수동으로 열 때까지).
// 둘 다 비어있는 행은 제한 없음이므로 응답에서 빠집니다.
// 자물쇠 하나(d1a…)뿐 아니라 하루 전체(day2)나 구역(d2_qr 등) id도 똑같이 여기서 다룹니다.
function getLocks_() {
  var c = locksCtx_();
  var data = c.sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var id = cell_(data[i], c.map, 'id');
    if (!id) continue;
    var unlockAt = toKSTIso_(cell_(data[i], c.map, 'unlock_at'));
    var locked = isTrue_(cell_(data[i], c.map, 'locked'));
    if (unlockAt || locked) rows.push({ id: id, unlockAt: unlockAt, locked: locked });
  }
  return json_(rows);
}

// teamScores 시트를 읽어 조마다 진행자가 얹은 점수를 내려줍니다.
// 자물쇠를 깬 만큼 자동으로 오르는 점수는 그대로 두고, 여기 적은 값을 거기에 더해서 보여줍니다.
// 0이거나 비어 있는 조는 응답에서 빠집니다(메모만 적어둔 줄도 마찬가지).
function getTeamScores_() {
  var c = teamScoresCtx_();
  var data = c.sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var group = String(cell_(data[i], c.map, 'group') || '').trim();
    if (!group) continue;
    var bonus = Number(cell_(data[i], c.map, 'bonus'));
    if (!bonus) continue;
    rows.push({ group: group, bonus: bonus, note: String(cell_(data[i], c.map, 'note') || '').trim() });
  }
  return json_(rows);
}

// ---------------------------------------------------------------------------
// 유형검사 결과
// ---------------------------------------------------------------------------

function saveTypeResult_(body) {
  var c = typeResultsCtx_();
  var data = c.sh.getDataRange().getValues();
  var rowIndex = findRow_(data, c.map, 'playerId', body.playerId);
  var values = {
    playerId: body.playerId,
    nick: body.nick,
    idolPrimary: body.idolPrimary,
    idolSecondary: body.idolSecondary,
    comboName: body.comboName,
    medType: body.medType,
    prayType: body.prayType,
    medTime: body.medTime,
    prayTime: body.prayTime,
    created_at: nowKST_(),
    answers: JSON.stringify(body.answers || {}),
    version: body.version || 0,
    walkCode: body.walkCode || '',
    medSocial: body.medSocial || '',
    prayFocus: body.prayFocus || '',
    idolScores: JSON.stringify(body.idolScores || {}),
    consistency: body.consistency == null ? '' : body.consistency,
    clarity: body.clarity == null ? '' : body.clarity,
    flat: !!body.flat,
  };
  saveRow_(c.sh, c.map, rowIndex, values, rowIndex > 0 ? data[rowIndex - 1] : null);
  return json_({ ok: true });
}

// 검사를 마친 사람이 기기 캐시를 지웠거나 다른 기기로 들어왔을 때,
// 여기 백업해둔 답변으로 결과 화면을 그대로 되살린다.
function getTypeResult_(playerId) {
  var c = typeResultsCtx_();
  var data = c.sh.getDataRange().getValues();
  var rowIndex = findRow_(data, c.map, 'playerId', playerId);
  if (rowIndex < 0) return json_(null);
  var row = data[rowIndex - 1];
  var answers = {};
  try {
    answers = JSON.parse(cell_(row, c.map, 'answers') || '{}');
  } catch (err) {
    answers = {};
  }
  return json_({
    playerId: playerId,
    answers: answers,
    version: Number(cell_(row, c.map, 'version')) || 0,
  });
}

// ---- 관리자용: 시트를 미리 다 만들어두고 싶을 때 한 번 실행(▶ 버튼)하세요 ----
// players/prayers/notices/locks/typeResults/messages 6개 시트를 헤더까지 전부 만들어줍니다.
// typeResults·messages는 원래 누군가 그 기능을 실제로 써야 자동 생성되는데,
// 미리 확인해보고 싶을 때 이 함수로 먼저 만들어둘 수 있습니다.
//
// 이미 있는 시트에 대해서는 "코드가 쓰는데 시트에 없는 칸"만 맨 뒤에 덧붙입니다.
// 칸 순서를 바꿔뒀거나 직접 추가한 칸이 있어도 그대로 보존되니 여러 번 실행해도 안전합니다.
function setupAllSheets() {
  playersCtx_();
  prayersCtx_();
  noticesCtx_();
  locksCtx_();
  typeResultsCtx_();
  messagesCtx_();
  teamScoresCtx_();
}

// ---- 관리자용: 시험 삼아 쌓인 참가자 기록을 비웁니다 (정식 시작 직전에 한 번) ----
// 지우는 것 : players / typeResults / prayers / messages 의 데이터 행
// 남기는 것 : 각 시트의 헤더 1행, 그리고 locks·notices·teamScores
//             (자물쇠 시각·공지·조별 가감점은 관리자가 직접 채운 설정이라 건드리지 않습니다)
//             ⚠️ 시험 삼아 넣어둔 조별 가감점이 있다면 teamScores 시트의 bonus 칸을 직접 비워주세요.
//
// ⚠️ 되돌릴 수 없습니다. 실행 전에 "파일 → 사본 만들기"로 백업해두세요.
// ⚠️ 순위판은 이 시트가 아니라 Firestore를 보고 그립니다.
//    이 함수만 돌리면 순위판에 지운 참가자가 그대로 남습니다.
//    Firebase 콘솔에서 players / missionAnswers / gameTimes_* 컬렉션도 함께 비워주세요.
//
// 실수로 ▶ 를 눌렀을 때를 대비해 확인 창을 먼저 띄웁니다.
// 확인 창을 띄울 수 없는 환경(트리거 등)에서는 아무것도 지우지 않고 멈춥니다.
function clearParticipantData() {
  var ui;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (err) {
    return '스프레드시트에 연결된 편집기에서 실행해주세요 (확인 창을 띄울 수 없어 중단했습니다)';
  }
  var answer = ui.alert(
    '참가자 기록을 모두 지울까요?',
    'players · typeResults · prayers · messages 의 모든 데이터 행이 지워집니다.\n' +
      '자물쇠(locks)와 공지(notices) 설정은 그대로 남습니다.\n\n' +
      '되돌릴 수 없습니다. 백업해두셨나요?',
    ui.ButtonSet.YES_NO,
  );
  if (answer !== ui.Button.YES) return '취소했습니다. 아무것도 지우지 않았습니다.';

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = [];
  ['players', 'typeResults', 'prayers', 'messages'].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      report.push(name + ' : 시트 없음');
      return;
    }
    var last = sh.getLastRow();
    var removed = last > 1 ? last - 1 : 0;
    if (removed > 0) sh.deleteRows(2, removed);
    report.push(name + ' : ' + removed + '행 삭제');
  });
  var summary = report.join('\n');
  ui.alert(
    '정리 완료',
    summary + '\n\n순위판을 비우려면 Firebase 콘솔과 teamScores 시트의 bonus 칸도 확인해주세요.',
    ui.ButtonSet.OK,
  );
  return summary;
}

// ---- 관리자용: Apps Script 편집기에서 이 함수만 딱 한 번 수동 실행(▶ 버튼)하세요 ----
// 미리 하면 좋은 일: 스프레드시트에서 안 쓰이던 'Sheet1' 탭 이름을 'locks'로 바꿔두면
// 그 시트를 그대로 재사용합니다(안 바꿔도 새 시트가 자동 생성됨).
// 실행하면 자물쇠·구역 id가 빈 unlock_at / locked 칸과 함께 채워집니다.
// 이미 있는 id는 건드리지 않으므로, 새 id가 생겼을 때 다시 실행해도 안전합니다.
//
// [여는 시각 정하기] unlock_at 칸에 "2026-08-29 18:00" 처럼 적으면 그 시각이 지나야 열립니다.
// [계속 잠가두기]   locked 칸에 TRUE 를 적으면 시각과 상관없이 계속 잠깁니다.
// [바로 열기]       두 칸을 모두 비우면 언제든 열립니다(과거 시각으로 바꿔도 즉시 열림).
// 앱은 1분마다 이 시트를 다시 읽으므로, 고치면 최대 1분 안에 참가자 화면에 반영됩니다.
//
// id 종류
//  · d1a~d1i, d2a~d2g : 자물쇠(미니게임 / QR 미션) 하나하나
//  · day1 / day2 / day3 : 그 날 탭 전체 (잠그면 그 날로 넘어갈 수 없음)
//  · d2_type  : DAY 2 · IDOL-X 유형 검사
//  · d2_qr    : DAY 2 · QR 스캔(알 깨기)
//  · d2_share : DAY 2 · 유형 나눔
//  · d3_decide: DAY 3 · 마지막 열쇠(결단)
function setupLocksSheet() {
  var c = locksCtx_();
  var ids = [
    ['d1a', '첫 번째 두드림'], ['d1b', '두 번째 두드림'], ['d1c', '세 번째 두드림'],
    ['d1d', '네 번째 두드림'], ['d1e', '다섯 번째 두드림'], ['d1f', '여섯 번째 두드림'],
    ['d1g', '일곱 번째 두드림'], ['d1h', '여덟 번째 두드림'], ['d1i', '아홉 번째 두드림'],
    ['d2a', '쾌락의 자물쇠'], ['d2b', '재물의 자물쇠'], ['d2c', '지혜의 자물쇠'],
    ['d2e', '사람의 자물쇠'], ['d2f', '인정의 자물쇠'], ['d2g', '권력의 자물쇠'],
    // 아래는 자물쇠 하나가 아니라 화면 한 덩어리를 통째로 잠그는 칸이다.
    ['day1', 'DAY 1 전체'], ['day2', 'DAY 2 전체'], ['day3', 'DAY 3 전체'],
    ['d1_intro', 'DAY 1 · 자기소개 나눔'],
    ['d2_type', 'DAY 2 · IDOL-X 유형 검사'],
    ['d2_qr', 'DAY 2 · QR 스캔(알 깨기)'],
    ['d2_share', 'DAY 2 · 유형 나눔'],
    ['d3_decide', 'DAY 3 · 마지막 열쇠(결단)'],
  ];
  var data = c.sh.getDataRange().getValues();
  ids.forEach(function (pair) {
    if (findRow_(data, c.map, 'id', pair[0]) > 0) return;
    saveRow_(c.sh, c.map, -1, { id: pair[0], name: pair[1] });
  });
}

// ---- 관리자용: 이 함수도 편집기에서 딱 한 번 수동 실행(▶ 버튼)하세요 ----
// teamScores 시트에 조 이름이 한 줄씩 깔립니다. 이미 있는 조는 건드리지 않으니
// 조가 늘었을 때 다시 실행해도 안전합니다.
//
// [쓰는 법] bonus 칸에 숫자를 적으면 조별 순위판 점수에 그대로 더해집니다.
//   · 레크리에이션 1등에게 5점 → bonus 칸에 5
//   · 벌점으로 2점 깎기       → bonus 칸에 -2
//   · 되돌리기                → 칸을 비우거나 0
// note 칸에 적은 말("레크리에이션 1위" 등)은 참가자 순위판에 그대로 보입니다. 비워둬도 됩니다.
//
// 자물쇠를 깨서 자동으로 오르는 점수는 그대로 살아 있고, 여기 적은 값이 거기에 얹힙니다.
// 앱은 1분마다 이 시트를 다시 읽으므로 고치면 최대 1분 안에 순위판에 반영됩니다.
//
// ⚠️ 조 이름은 앱의 조 목록(src/data/prayerGroups.ts)과 글자까지 똑같아야 합니다.
//    이름이 다르면 그 줄은 어느 조에도 붙지 않고 조용히 무시됩니다.
function setupTeamScoresSheet() {
  var c = teamScoresCtx_();
  var groups = ['1조', '2조', '3조', '4조', '5조', '6조', '7조', '8조'];
  var data = c.sh.getDataRange().getValues();
  groups.forEach(function (group) {
    if (findRow_(data, c.map, 'group', group) > 0) return;
    saveRow_(c.sh, c.map, -1, { group: group, bonus: '', note: '' });
  });
}

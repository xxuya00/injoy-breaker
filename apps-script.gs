function doGet(e) {
  var action = e.parameter.action;
  if (action === 'leaderboard') return leaderboard_();
  if (action === 'getPlayer') return getPlayer_(e.parameter.id);
  if (action === 'getPrayers') return getPrayers_(e.parameter.group);
  if (action === 'getNotices') return getNotices_();
  if (action === 'getLocks') return getLocks_();
  return json_({ error: 'unknown action' });
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var action = body.action;
  if (action === 'savePlayer') return savePlayer_(body);
  if (action === 'addPrayer') return addPrayer_(body);
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

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
  }
  return sh;
}

function playersSheet_() {
  return sheet_('players', ['id', 'nick', 'day', 'opened', 'score', 'updated_at', 'nickname', 'group']);
}

function prayersSheet_() {
  return sheet_('prayers', ['id', 'group', 'nick', 'text', 'created_at']);
}

function noticesSheet_() {
  return sheet_('notices', ['id', 'title', 'body', 'created_at']);
}

function locksSheet_() {
  return sheet_('locks', ['id', 'name', 'unlock_at', 'note']);
}

function messagesSheet_() {
  return sheet_('messages', ['id', 'playerId', 'nick', 'text', 'urgent', 'created_at']);
}

function typeResultsSheet_() {
  return sheet_('typeResults', [
    'id', 'playerId', 'nick',
    'idolPrimary', 'idolSecondary', 'comboName',
    'medType', 'medTypeName', 'prayType', 'prayTypeName',
    'medTime', 'prayTime', 'created_at',
  ]);
}

function savePlayer_(body) {
  var sh = playersSheet_();
  var data = sh.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === body.id) {
      rowIndex = i + 1;
      break;
    }
  }
  // 닉네임/조는 값이 없이(예: 기존 진행 저장) 넘어오면 기존 값을 지우지 않도록 이어서 채운다.
  var prevNickname = rowIndex > 0 ? data[rowIndex - 1][6] : '';
  var prevGroup = rowIndex > 0 ? data[rowIndex - 1][7] : '';
  var row = [
    body.id,
    body.nick,
    body.day,
    JSON.stringify(body.opened || {}),
    body.score,
    nowKST_(),
    body.nickname || prevNickname || '',
    body.group || prevGroup || '',
  ];
  if (rowIndex > 0) {
    sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  return json_({ ok: true });
}

function getPlayer_(id) {
  var sh = playersSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      return json_({
        id: data[i][0],
        nick: data[i][1],
        day: data[i][2],
        opened: JSON.parse(data[i][3] || '{}'),
        score: data[i][4],
        nickname: data[i][6] || '',
        group: data[i][7] || '',
      });
    }
  }
  return json_(null);
}

function leaderboard_() {
  var sh = playersSheet_();
  var data = sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    rows.push({ id: data[i][0], nick: data[i][1], score: Number(data[i][4]) || 0 });
  }
  rows.sort(function (a, b) {
    return b.score - a.score;
  });
  return json_(rows.slice(0, 20));
}

function addPrayer_(body) {
  var sh = prayersSheet_();
  var id = Utilities.getUuid();
  sh.appendRow([id, body.group, body.nick, body.text, nowKST_()]);
  return json_({ ok: true, id: id });
}

function getPrayers_(group) {
  var sh = prayersSheet_();
  var data = sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === group) {
      rows.push({ id: data[i][0], group: data[i][1], nick: data[i][2], text: data[i][3], createdAt: data[i][4] });
    }
  }
  rows.reverse();
  return json_(rows);
}

function getNotices_() {
  var sh = noticesSheet_();
  var data = sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    rows.push({ id: data[i][0], title: data[i][1], body: data[i][2], createdAt: data[i][3] });
  }
  rows.reverse();
  return json_(rows);
}

// 참가자가 보낸 건의/신고는 앱에서 다시 읽어오지 않고 이 시트에만 쌓인다(관리자 전용).
// 시트 메뉴 "도구 → 알림 규칙"에서 "변경사항이 있을 때 알림"을 켜두면
// 새 메시지가 올 때마다 이메일로 바로 알림을 받을 수 있다(무료, 긴급 대응용).
function addMessage_(body) {
  var sh = messagesSheet_();
  var id = Utilities.getUuid();
  sh.appendRow([id, body.playerId, body.nick, body.text, !!body.urgent, nowKST_()]);
  return json_({ ok: true, id: id });
}

function toKSTIso_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  var s = String(v).trim();
  return s === '' ? null : s;
}

// locks 시트의 unlock_at 칸을 읽어 각 자물쇠의 개방 시각을 내려줍니다.
// unlock_at이 비어있으면 시간 제한 없음(응답 목록에서 제외)으로 취급됩니다.
function getLocks_() {
  var sh = locksSheet_();
  var data = sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var id = data[i][0];
    if (!id) continue;
    var unlockAt = toKSTIso_(data[i][2]);
    if (unlockAt) rows.push({ id: id, unlockAt: unlockAt });
  }
  return json_(rows);
}

function saveTypeResult_(body) {
  var sh = typeResultsSheet_();
  var data = sh.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === body.playerId) {
      rowIndex = i + 1;
      break;
    }
  }
  var row = [
    Utilities.getUuid(), body.playerId, body.nick,
    body.idolPrimary, body.idolSecondary, body.comboName,
    body.medType, body.medTypeName, body.prayType, body.prayTypeName,
    body.medTime, body.prayTime, nowKST_(),
  ];
  if (rowIndex > 0) {
    row[0] = data[rowIndex - 1][0]; // 기존 id 유지 (재검사 시 덮어쓰기)
    sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  return json_({ ok: true });
}

// ---- 관리자용: 시트를 미리 다 만들어두고 싶을 때 한 번 실행(▶ 버튼)하세요 ----
// players/prayers/notices/locks/typeResults/messages 6개 시트를 헤더까지 전부 만들어줍니다.
// typeResults·messages는 원래 누군가 그 기능을 실제로 써야 자동 생성되는데,
// 미리 확인해보고 싶을 때 이 함수로 먼저 만들어둘 수 있습니다.
function setupAllSheets() {
  playersSheet_();
  prayersSheet_();
  noticesSheet_();
  locksSheet_();
  typeResultsSheet_();
  messagesSheet_();
}

// ---- 관리자용: Apps Script 편집기에서 이 함수만 딱 한 번 수동 실행(▶ 버튼)하세요 ----
// 미리 하면 좋은 일: 스프레드시트에서 안 쓰이던 'Sheet1' 탭 이름을 'locks'로 바꿔두면
// 그 시트를 그대로 재사용합니다(안 바꿔도 새 시트가 자동 생성됨).
// 실행하면 자물쇠 id/이름이 빈 unlock_at 칸과 함께 채워집니다.
// unlock_at 칸에 "2026-08-29 18:00" 처럼 열리는 시각을 적으면, 그 시각이 지나야
// 앱에서 해당 자물쇠를 풀 수 있습니다. 비워두면 지금처럼 언제든 풀 수 있어요.
// 시각을 지우거나 과거 시각으로 바꾸면 즉시 열 수도 있습니다(수동 조정).
function setupLocksSheet() {
  var sh = locksSheet_();
  if (sh.getLastRow() === 0) {
    sh.appendRow(['id', 'name', 'unlock_at', 'note']);
  }
  var ids = [
    ['d1a', '첫 번째 두드림'], ['d1b', '두 번째 두드림'], ['d1c', '세 번째 두드림'],
    ['d1d', '네 번째 두드림'], ['d1e', '다섯 번째 두드림'], ['d1f', '여섯 번째 두드림'],
    ['d1g', '일곱 번째 두드림'], ['d1h', '여덟 번째 두드림'], ['d1i', '아홉 번째 두드림'],
    ['d2a', '쾌락의 자물쇠'], ['d2b', '재물의 자물쇠'], ['d2c', '지혜의 자물쇠'],
    ['d2e', '사람의 자물쇠'], ['d2f', '인정의 자물쇠'], ['d2g', '권력의 자물쇠'],
  ];
  var existing = sh.getDataRange().getValues();
  var existingIds = {};
  for (var i = 1; i < existing.length; i++) existingIds[existing[i][0]] = true;
  ids.forEach(function (pair) {
    if (!existingIds[pair[0]]) sh.appendRow([pair[0], pair[1], '', '']);
  });
}

function doGet(e) {
  var action = e.parameter.action;
  if (action === 'leaderboard') return leaderboard_();
  if (action === 'getPlayer') return getPlayer_(e.parameter.id);
  if (action === 'getPrayers') return getPrayers_(e.parameter.group);
  return json_({ error: 'unknown action' });
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var action = body.action;
  if (action === 'savePlayer') return savePlayer_(body);
  if (action === 'addPrayer') return addPrayer_(body);
  return json_({ error: 'unknown action' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
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
  return sheet_('players', ['id', 'nick', 'day', 'opened', 'score', 'updated_at']);
}

function prayersSheet_() {
  return sheet_('prayers', ['id', 'group', 'nick', 'text', 'created_at']);
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
  var row = [body.id, body.nick, body.day, JSON.stringify(body.opened || {}), body.score, new Date().toISOString()];
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
  sh.appendRow([id, body.group, body.nick, body.text, new Date().toISOString()]);
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

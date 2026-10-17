/**
 * 追加変更記録アプリ 承認用スクリプト（Google Apps Script）
 *
 * 役割:
 *  - 利用者が申請したら、スプレッドシートの「利用者」シートに1行追加する
 *  - 管理者(このスクリプトの持ち主)にメールを送る。メールの「承認する／却下する」を押すだけで決定できる
 *  - アプリが「この端末は承認済みか」を問い合わせたときに答える
 *
 * 写真や記録の内容はここには送られません（利用者のスマホの中だけに保存されます）。
 * ここに残るのは、申請者の「氏名・会社名・端末ID・状態」だけです。
 */

// 申請の一覧を入れるスプレッドシートのID（URLの /d/ と /edit の間の文字列）
var SPREADSHEET_ID = '1Aul83tA7Y5TkNBRWjEio-pnU3Lwx0I9zHEYcUYOT3w4';
var SHEET_NAME = '利用者';
var FEEDBACK_SHEET = '意見';
var STATUS_PENDING = '申請中';
var STATUS_OK = '承認';
var STATUS_NG = '却下';

/**
 * 最初に1回だけ、エディタ上で「setup」を選んで実行してください。
 * 「利用者」シートの作成と、メール送信・スプレッドシートの権限の許可(承認画面)が行われます。
 */
function setup() {
  sheet_();
  secret_();
  MailApp.getRemainingDailyQuota();
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'apply') return json_(apply_(p));
    if (p.action === 'status') return json_(status_(p));
    if (p.action === 'decide') return decide_(p);
    if (p.action === 'commit') return commit_(p);
    if (p.action === 'feedback') return json_(feedback_(p));
    return json_({ ok: false, error: 'bad_action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['ID', '申請日時', '氏名', '会社名', '状態', '決定日時', '備考']);
    sh.setFrozenRows(1);
    sh.getRange('E2:E1000').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList([STATUS_PENDING, STATUS_OK, STATUS_NG], true).build()
    );
  }
  return sh;
}

// アプリの「ご意見・ご要望」。承認済みの端末だけ受け付け、「意見」シートに1行追加する
function feedback_(p) {
  if (!validId_(p.id)) return { ok: false, error: 'bad_id' };
  var text = clean_(p.text, 250);
  if (!text) return { ok: false, error: 'no_text' };
  var sh0 = sheet_();
  var row = findRow_(sh0, p.id);
  if (!row || toCode_(sh0.getRange(row, 5).getValue()) !== 'approved') return { ok: false, error: 'not_approved' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(FEEDBACK_SHEET);
    if (!sh) {
      sh = ss.insertSheet(FEEDBACK_SHEET);
      sh.appendRow(['受付日時', '種類', 'ご意見', '氏名', '会社名', 'バージョン', '端末ID']);
      sh.setFrozenRows(1);
    }
    sh.appendRow([new Date(), clean_(p.cat, 20), text, clean_(p.name, 40), clean_(p.company, 60), clean_(p.v, 20), p.id]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

function findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return i + 2;
  }
  return 0;
}

function toCode_(label) {
  if (label === STATUS_OK) return 'approved';
  if (label === STATUS_NG) return 'rejected';
  return 'pending';
}

function validId_(id) {
  return /^[A-Za-z0-9-]{8,64}$/.test(String(id || ''));
}

function clean_(s, max) {
  // 先頭が = + - @ の文字はスプレッドシートの数式として動かないよう、先頭に空白を足して文字として扱わせる
  var t = String(s || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(t) ? ' ' + t : t;
}

function apply_(p) {
  if (!validId_(p.id)) return { ok: false, error: 'bad_id' };
  var name = clean_(p.name, 40);
  var company = clean_(p.company, 60);
  if (!name) return { ok: false, error: 'no_name' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_();
    var row = findRow_(sh, p.id);
    if (row) return { ok: true, status: toCode_(sh.getRange(row, 5).getValue()) };
    var same = sameName_(sh, name);
    sh.appendRow([p.id, new Date(), name, company, STATUS_PENDING, '', same.note]);
    if (same.count) {
      var r = sh.getLastRow();
      sh.getRange(r, 1, 1, 7).setBackground('#fef08a'); // 同じ氏名の申請が既にある行は黄色
      if (!sh.getRange(1, 7).getValue()) sh.getRange(1, 7).setValue('備考');
    }
  } finally {
    lock.releaseLock();
  }
  notify_(p.id, name, company, same.note);
  return { ok: true, status: 'pending' };
}

// 氏名の空白(全角・半角)を除いて比べる
function normName_(s) {
  return String(s || '').replace(/[\s\u3000]+/g, '').toLowerCase();
}

// 同じ氏名の既存の申請を数える。ホーム画面に追加したアプリは保存場所が別になり、
// 同じ人が別の端末番号で申請し直すことがあるため、管理者が見分けられるようにする
function sameName_(sh, name) {
  var last = sh.getLastRow();
  var res = { count: 0, ok: 0, pending: 0, ng: 0, note: '' };
  if (last < 2) return res;
  var key = normName_(name);
  var vals = sh.getRange(2, 3, last - 1, 3).getValues(); // 氏名, 会社名, 状態
  for (var i = 0; i < vals.length; i++) {
    if (normName_(vals[i][0]) !== key) continue;
    res.count++;
    if (vals[i][2] === STATUS_OK) res.ok++;
    else if (vals[i][2] === STATUS_NG) res.ng++;
    else res.pending++;
  }
  if (res.count) {
    res.note = '同じ氏名の申請が既に' + res.count + '件（承認' + res.ok + '・申請中' + res.pending + '・却下' + res.ng + '）。同じ方の再申請の可能性';
  }
  return res;
}

function status_(p) {
  if (!validId_(p.id)) return { ok: false, error: 'bad_id' };
  var sh = sheet_();
  var row = findRow_(sh, p.id);
  if (!row) return { ok: true, status: 'none' };
  return { ok: true, status: toCode_(sh.getRange(row, 5).getValue()) };
}

/* ---- 管理者へのメール(承認/却下リンク付き) ---- */

function secret_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('SECRET');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SECRET', s);
  }
  return s;
}

function sign_(id, decision) {
  var bytes = Utilities.computeHmacSha256Signature(id + '|' + decision, secret_());
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function notify_(id, name, company, note) {
  // 申請が大量に来てもメールが止まらないよう、6時間あたり20通までにする
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('mailN') || 0);
  if (n >= 20) return;
  cache.put('mailN', String(n + 1), 21600);

  var base = ScriptApp.getService().getUrl();
  var ok = base + '?action=decide&d=approve&id=' + encodeURIComponent(id) + '&sig=' + sign_(id, 'approve');
  var ng = base + '?action=decide&d=reject&id=' + encodeURIComponent(id) + '&sig=' + sign_(id, 'reject');
  var html =
    '<p>追加変更記録アプリの利用申請が届きました。</p>' +
    '<p>氏名: <b>' + esc_(name) + '</b><br>会社名: <b>' + esc_(company) + '</b></p>' +
    (note ? '<p style="background:#fef9c3;border:1px solid #eab308;padding:10px;border-radius:8px"><b>ご確認ください:</b> ' + esc_(note) +
      '。ホーム画面に追加したアプリから申請し直した場合などに、同じ方でも別の申請として届きます。同じ方なら「承認する」を押してください。</p>' : '') +
    '<p><a href="' + ok + '" style="display:inline-block;padding:12px 20px;background:#166534;color:#fff;text-decoration:none;border-radius:8px">承認する</a>　' +
    '<a href="' + ng + '" style="display:inline-block;padding:12px 20px;background:#b91c1c;color:#fff;text-decoration:none;border-radius:8px">却下する</a></p>' +
    '<p style="color:#666">心当たりのない申請は「却下する」を押してください。後からスプレッドシートの「状態」欄でも変更できます。</p>';
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: '【追加変更記録】利用申請' + (note ? '（再申請の可能性）' : '') + ': ' + name + '（' + company + '）',
    htmlBody: html
  });
}

function esc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// メールのリンクを開いたときは「確認ページ」を出すだけで、まだ決定しない。
// (メールの安全機能がリンクを自動で開いても、勝手に承認・却下されないようにするため)
// ページのボタンを押すと、はじめて決定(commit)される。
function decide_(p) {
  var d = p.d === 'approve' ? 'approve' : p.d === 'reject' ? 'reject' : '';
  if (!d || !validId_(p.id) || String(p.sig || '') !== sign_(p.id, d)) {
    return page_('このリンクは無効です。');
  }
  var sh = sheet_();
  var row = findRow_(sh, p.id);
  if (!row) return page_('申請が見つかりません。');
  var who = esc_(sh.getRange(row, 3).getValue());
  var comp = esc_(sh.getRange(row, 4).getValue());
  var label = d === 'approve' ? '承認' : '却下';
  var url = ScriptApp.getService().getUrl() + '?action=commit&d=' + d + '&id=' + encodeURIComponent(p.id) + '&sig=' + p.sig;
  return page_(
    '<p>' + who + ' さん（' + comp + '）を<b>' + label + '</b>しますか？</p>' +
    '<button id="go" style="font-size:20px;padding:14px 28px;border-radius:10px;border:0;color:#fff;background:' +
    (d === 'approve' ? '#166534' : '#b91c1c') + '">' + label + 'する</button>' +
    '<script>document.getElementById("go").onclick=function(){window.top.location.href=' + JSON.stringify(url) + ';};</script>'
  );
}

function commit_(p) {
  var d = p.d === 'approve' ? 'approve' : p.d === 'reject' ? 'reject' : '';
  if (!d || !validId_(p.id) || String(p.sig || '') !== sign_(p.id, d)) {
    return page_('このリンクは無効です。');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_();
    var row = findRow_(sh, p.id);
    if (!row) return page_('申請が見つかりません。');
    sh.getRange(row, 5).setValue(d === 'approve' ? STATUS_OK : STATUS_NG);
    sh.getRange(row, 6).setValue(new Date());
    var who = sh.getRange(row, 3).getValue();
    return page_(esc_(who) + ' さんを「' + (d === 'approve' ? '承認' : '却下') + '」しました。');
  } finally {
    lock.releaseLock();
  }
}

function page_(msg) {
  return HtmlService.createHtmlOutput(
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<body style="font-family:sans-serif;padding:32px;font-size:18px">' + msg + '</body>'
  );
}

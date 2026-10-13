// Paste into Extensions → Apps Script in your Google Sheet.
// After replacing, redeploy: Deploy → Manage deployments → Edit → Version: New version → Deploy.
function tab_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); }
  return sh;
}
const notes_ = () => tab_('notes', ['course_id', 'course', 'what_i_did', 'updated_at']);
const scores_ = () => tab_('scores', ['test_id', 'test', 'score', 'total', 'taken_at']);

function doGet() {
  const notes = {};
  notes_().getDataRange().getValues().slice(1).forEach(r => { if (r[0]) notes[r[0]] = String(r[2]); });
  const best = {};
  scores_().getDataRange().getValues().slice(1).forEach(r => {
    const id = r[0]; if (!id) return;
    const s = Number(r[2]), t = Number(r[3]), at = new Date(r[4]).getTime();
    if (!best[id] || s > best[id].score) best[id] = { score: s, total: t, at: at };
  });
  return ContentService.createTextOutput(JSON.stringify({ notes: notes, best: best }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.type === 'score') {
    scores_().appendRow([d.id, d.test, d.score, d.total, new Date(d.at)]);
    return ContentService.createTextOutput('ok');
  }
  const sh = notes_();
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => r[0]);
  const i = ids.indexOf(d.id);
  const row = [d.id, d.course, d.note, new Date()];
  if (i > 0) sh.getRange(i + 1, 1, 1, 4).setValues([row]); else sh.appendRow(row);
  return ContentService.createTextOutput('ok');
}

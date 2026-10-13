// Paste this into Extensions → Apps Script in your Google Sheet, then Deploy → New deployment → Web app (access: Anyone).
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('notes');
  if (!sh) { sh = ss.insertSheet('notes'); sh.appendRow(['course_id', 'course', 'what_i_did', 'updated_at']); }
  return sh;
}
function doGet() {
  const out = {};
  sheet_().getDataRange().getValues().slice(1).forEach(r => { if (r[0]) out[r[0]] = String(r[2]); });
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const sh = sheet_();
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => r[0]);
  const i = ids.indexOf(d.id);
  const row = [d.id, d.course, d.note, new Date()];
  if (i > 0) sh.getRange(i + 1, 1, 1, 4).setValues([row]); else sh.appendRow(row);
  return ContentService.createTextOutput('ok');
}

/**
 * MANNORR — website database
 * Google Apps Script bound to the "MANNORR Database" Google Sheet.
 *
 * What it does
 *  - Receives every form on mannorr.com (POST) and adds one row to the right tab:
 *      Design    design project enquiries
 *      Ministry  bookings to minister in song or teach
 *      Students  people applying to learn design with you
 *      Updates   people asking to hear when In You is out
 *  - Gives each row a reference (DE-0001, MB-0001, ST-0001, UP-0001) and a Status you update.
 *  - Emails NOTIFY_EMAIL for each new enquiry, booking or student, with a one-tap WhatsApp button.
 *  - Optionally emails the person a short confirmation.
 *
 * Setup: see apps-script/README.md. Run `setup` once, then deploy as a Web app.
 */

const CONFIG = {
  NOTIFY_EMAIL: "hellomannorr@gmail.com",
  OWNER_NAME: "Nifemi Adeniran (MANNORR)",
  SEND_CONFIRMATION: true,          // thank-you email to the person, when they give an email
  DEFAULT_COUNTRY_CODE: "234",      // turns 0803… into 234803… for WhatsApp
  DUPLICATE_WINDOW_SECONDS: 120,    // same email + same form within this window = same submission
  MIN_FILL_MS: 2500,                // forms sent faster than this are treated as bots
  MAX_PER_10_MIN: 30,               // site-wide cap, protects your inbox and email quota
  CONFIRM_ONCE_PER_EMAIL_HOURS: 6,  // an address gets at most one confirmation per 6 hours
  RESERVE_EMAIL_QUOTA: 10           // keep this many daily emails for your own notifications
};

/* Each form: tab name, reference prefix, statuses, columns [Header, field], required fields. */
const FORMS = {
  design: {
    sheet: "Design", prefix: "DE-", label: "Design enquiry", notify: true,
    statuses: ["New", "Replied", "Call booked", "Proposal sent", "Won", "Lost"],
    required: ["name", "email"],
    columns: [["Reference","ref"],["Received","received"],["Status","status"],["Name","name"],["Email","email"],
              ["Phone","phone"],["WhatsApp","wa"],["Company","company"],["Project","project"],["Budget","budget"],
              ["Timeline","timeline"],["Message","message"],["Page","page"],["Notes","notes"]]
  },
  ministry: {
    sheet: "Ministry", prefix: "MB-", label: "Ministry booking", notify: true,
    statuses: ["New", "Replied", "Confirmed", "Done", "Declined"],
    required: ["name", "email", "phone"],
    columns: [["Reference","ref"],["Received","received"],["Status","status"],["Name","name"],["Email","email"],
              ["Phone","phone"],["WhatsApp","wa"],["Organisation","org"],["Event","event"],["Date","date"],
              ["City","city"],["Request","request"],["Message","message"],["Page","page"],["Notes","notes"]]
  },
  learn: {
    sheet: "Students", prefix: "ST-", label: "Student application", notify: true,
    statuses: ["New", "Contacted", "Accepted", "Paid", "In progress", "Completed", "Declined"],
    required: ["name", "email", "phone"],
    columns: [["Reference","ref"],["Received","received"],["Status","status"],["Name","name"],["Email","email"],
              ["Phone","phone"],["WhatsApp","wa"],["City","city"],["Level","level"],["Focus","focus"],
              ["Format","format"],["Laptop","laptop"],["Start","start"],["Goals","message"],["Page","page"],["Notes","notes"]]
  },
  updates: {
    sheet: "Updates", prefix: "UP-", label: "Updates sign-up", notify: false,
    statuses: ["Subscribed", "Unsubscribed"],
    required: ["email"],
    columns: [["Reference","ref"],["Received","received"],["Status","status"],["Name","name"],["Email","email"],
              ["Interest","interest"],["Page","page"],["Notes","notes"]]
  }
};

const STATUS_COLOURS = {
  "New": "#FAD4CF", "Replied": "#D9E7F5", "Contacted": "#D9E7F5", "Call booked": "#E9DDF4",
  "Proposal sent": "#FCEBC4", "Confirmed": "#FCEBC4", "Accepted": "#E9DDF4", "Paid": "#FCEBC4",
  "In progress": "#FCEBC4", "Won": "#D3EBD9", "Done": "#D3EBD9", "Completed": "#D3EBD9",
  "Subscribed": "#D3EBD9", "Lost": "#E4E4E4", "Declined": "#E4E4E4", "Unsubscribed": "#E4E4E4"
};

/* ---------- one-time setup: run this from the editor ---------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(FORMS).forEach((key, i) => {
    const f = FORMS[key];
    let sh = ss.getSheetByName(f.sheet);
    if (!sh) sh = ss.insertSheet(f.sheet, i);
    const headers = f.columns.map(c => c[0]);
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight("bold").setFontColor("#F2F0EC").setBackground("#111111").setVerticalAlignment("middle");
    sh.setFrozenRows(1);
    sh.setRowHeight(1, 34);
    headers.forEach((h, c) => {
      const w = { Reference: 90, Received: 140, Status: 120, Message: 320, Goals: 320, Notes: 240, Email: 210 }[h] || 150;
      sh.setColumnWidth(c + 1, w);
    });
    const rc = headers.indexOf("Received") + 1;
    sh.getRange(2, rc, sh.getMaxRows() - 1, 1).setNumberFormat("dd mmm yyyy, hh:mm");
    ["Message", "Goals", "Notes"].forEach(h => {
      const c = headers.indexOf(h) + 1;
      if (c) sh.getRange(2, c, sh.getMaxRows() - 1, 1).setWrap(true);
    });
    const sc = headers.indexOf("Status") + 1;
    const statusRange = sh.getRange(2, sc, sh.getMaxRows() - 1, 1);
    statusRange.setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(f.statuses, true).setAllowInvalid(false).build());
    sh.setConditionalFormatRules(f.statuses.filter(s => STATUS_COLOURS[s]).map(s =>
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s).setBackground(STATUS_COLOURS[s]).setRanges([statusRange]).build()));
  });
  const def = ss.getSheetByName("Sheet1");
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  ss.toast("Design, Ministry, Students and Updates tabs are ready.", "MANNORR");
}

/* ---------- web app ---------- */
function doGet() {
  return json({ ok: true, service: "MANNORR database" });
}

function doPost(e) {
  const p = (e && e.parameter) || {};

  // Spam traps: real people never fill the hidden "website" field, and take more than a moment.
  if (p.website) return json({ ok: true, ref: "" });
  if (p.t && Number(p.t) < CONFIG.MIN_FILL_MS) return json({ ok: true, ref: "" });

  const form = FORMS[clean(p.form, 20)];
  if (!form) return json({ ok: false, error: "Unknown form." });
  const formKey = clean(p.form, 20);

  const d = {};
  form.columns.forEach(c => { d[c[1]] = clean(p[c[1]], c[1] === "message" ? 2000 : 300); });
  d.email = d.email.toLowerCase();

  const missing = form.required.filter(k => !d[k]);
  if (missing.length) return json({ ok: false, error: "Please fill in your " + missing.join(", ") + "." });
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return json({ ok: false, error: "Please check your email address." });

  let phone = "";
  if (d.phone) {
    phone = intlPhone(d.phone);
    if (phone.length < 10) return json({ ok: false, error: "Please check your phone number." });
    d.phone = "'+" + phone;   // keep the + as text
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cache = CacheService.getScriptCache();
    const dupKey = "dup_" + formKey + "_" + Utilities.base64EncodeWebSafe(d.email || phone);
    const seen = cache.get(dupKey);
    if (seen) return json({ ok: true, ref: seen, duplicate: true });

    const bucket = "rate_" + Math.floor(Date.now() / 600000);
    const count = Number(cache.get(bucket) || 0) + 1;
    cache.put(bucket, String(count), 700);
    if (count > CONFIG.MAX_PER_10_MIN) {
      return json({ ok: false, error: "A lot of messages are coming in right now. Please email " + CONFIG.NOTIFY_EMAIL + " instead." });
    }

    const sh = sheetFor(form);
    d.ref = nextRef(form);
    d.received = new Date();
    d.status = form.statuses[0];
    d.notes = "";
    const waText = `Hello ${firstName(d.name)}, this is Nifemi (MANNORR). Thank you for your ${form.label.toLowerCase()} (${d.ref}).`;
    const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(waText)}` : "";
    d.wa = waUrl ? `=HYPERLINK("${waUrl}","WhatsApp")` : "";

    sh.appendRow(form.columns.map(c => d[c[1]] === undefined ? "" : d[c[1]]));
    cache.put(dupKey, d.ref, CONFIG.DUPLICATE_WINDOW_SECONDS);

    if (form.notify) { try { notifyOwner(form, d, waUrl); } catch (err) { console.error("notify", err); } }

    const emKey = "em_" + Utilities.base64EncodeWebSafe(d.email || "none");
    if (CONFIG.SEND_CONFIRMATION && form.notify && d.email && !cache.get(emKey)
        && MailApp.getRemainingDailyQuota() > CONFIG.RESERVE_EMAIL_QUOTA) {
      try {
        confirmPerson(form, d);
        cache.put(emKey, "1", Math.min(21600, CONFIG.CONFIRM_ONCE_PER_EMAIL_HOURS * 3600));
      } catch (err) { console.error("confirm", err); }
    }
    return json({ ok: true, ref: d.ref });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- emails ---------- */
function notifyOwner(form, d, waUrl) {
  const rows = form.columns
    .filter(c => !["ref", "received", "status", "wa", "notes", "name"].includes(c[1]) && d[c[1]])
    .map(c => `<tr><td style="padding:8px 16px 8px 0;color:#E4291C;font:11px Arial;letter-spacing:1px;vertical-align:top;white-space:nowrap">${c[0]}</td><td style="padding:8px 0;font:15px Arial;color:#111">${esc(d[c[1]])}</td></tr>`)
    .join("");
  const btn = (href, label, bg, fg) => `<a href="${href}" style="display:inline-block;padding:12px 20px;margin:0 8px 8px 0;background:${bg};color:${fg};font:bold 13px Arial;text-decoration:none;border-radius:999px">${label}</a>`;
  const html = `
  <div style="background:#EBEAE8;padding:28px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff">
      <div style="background:#111111;padding:20px 28px;color:#F2F0EC;font:12px Arial;letter-spacing:1px">// MANNORR · ${form.label} · ${d.ref}</div>
      <div style="padding:28px">
        <div style="font:600 28px Arial;letter-spacing:-1px;color:#111">${esc(d.name || d.email)}</div>
        <div style="margin:18px 0 6px">${waUrl ? btn(waUrl, "WhatsApp", "#111111", "#F2F0EC") : ""}${d.email ? btn("mailto:" + d.email, "Reply by email", "#E4291C", "#ffffff") : ""}</div>
        <table style="border-collapse:collapse;margin-top:12px;width:100%">${rows}</table>
        <p style="font:12px Arial;color:#5F5B56;margin-top:24px">Update the Status of ${d.ref} in the ${form.sheet} tab once you have been in touch.</p>
      </div>
    </div>
  </div>`;
  MailApp.sendEmail({
    to: CONFIG.NOTIFY_EMAIL,
    subject: `${form.label} ${d.ref} · ${d.name || d.email}`,
    htmlBody: html,
    body: `${form.label} ${d.ref}\n${d.name}\n${d.email}\n${waUrl ? "WhatsApp: " + waUrl + "\n" : ""}${d.message || ""}`,
    replyTo: d.email || CONFIG.NOTIFY_EMAIL,
    name: "mannorr.com"
  });
}

function confirmPerson(form, d) {
  const what = { design: "your design enquiry", ministry: "your booking request", learn: "your application to learn design" }[
    Object.keys(FORMS).find(k => FORMS[k] === form)] || "your message";
  const html = `
  <div style="background:#EBEAE8;padding:28px">
    <div style="max-width:520px;margin:0 auto;background:#111111;color:#F2F0EC;padding:36px 32px">
      <div style="font:12px Arial;letter-spacing:1px;color:#E4291C">// MANNORR · ${d.ref}</div>
      <div style="font:600 30px Arial;letter-spacing:-1px;margin:18px 0 14px">Thank you, ${esc(firstName(d.name))}.</div>
      <p style="font:15px/1.6 Arial;color:#CFCBC5">I have received ${what}. I'll get back to you personally${d.phone ? " by WhatsApp or email" : " by email"} soon.</p>
      <p style="font:15px/1.6 Arial;color:#CFCBC5">Please keep your reference, ${d.ref}, for any questions.</p>
      <p style="font:15px/1.6 Arial;color:#CFCBC5;margin-top:24px">Nifemi Adeniran<br><span style="color:#8F8B85">Designer, preacher, songwriter · mannorr.com</span></p>
    </div>
  </div>`;
  MailApp.sendEmail({
    to: d.email,
    subject: `Received · ${d.ref}`,
    htmlBody: html,
    body: `Thank you, ${firstName(d.name)}. I have received ${what} (${d.ref}) and will get back to you soon. Nifemi Adeniran, mannorr.com`,
    replyTo: CONFIG.NOTIFY_EMAIL,
    name: CONFIG.OWNER_NAME
  });
}

/* ---------- helpers ---------- */
function sheetFor(form) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(form.sheet);
  if (!sh) throw new Error("Run setup() first.");
  return sh;
}

function nextRef(form) {
  const props = PropertiesService.getScriptProperties();
  const key = "lastRef_" + form.prefix;
  let n = Number(props.getProperty(key) || 0);
  if (!n) n = Math.max(0, sheetFor(form).getLastRow() - 1);
  n += 1;
  props.setProperty(key, String(n));
  return form.prefix + String(n).padStart(4, "0");
}

// Trim, cap length, and stop spreadsheet formula injection.
function clean(v, max) {
  if (v === undefined || v === null) return "";
  let s = String(v).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function intlPhone(raw) {
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = CONFIG.DEFAULT_COUNTRY_CODE + d.slice(1);
  if (d.length === 10 && !d.startsWith(CONFIG.DEFAULT_COUNTRY_CODE)) d = CONFIG.DEFAULT_COUNTRY_CODE + d;
  return d;
}

function firstName(n) { return String(n || "").split(" ")[0] || "there"; }

function esc(s) {
  return String(s).replace(/^'/, "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- optional: send yourself a test from the editor ---------- */
function testStudent() {
  const res = doPost({ parameter: {
    form: "learn", name: "Test Student", email: "test@example.com", phone: "08030000000", city: "Lagos",
    level: "Complete beginner", focus: "Social and marketing graphics", format: "In person, Lagos",
    laptop: "Yes, with Photoshop", start: "As soon as possible", message: "This is a test from the script editor.", page: "editor"
  }});
  console.log(res.getContent());
}

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
  OWNER_NAME: "Nifemi Adeniran · MANNORR",
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
    sheet: "Updates", prefix: "UP-", label: "Waitlist sign-up", notify: true,
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
// Table-based, inline-styled HTML so it renders cleanly in Gmail, Outlook and Apple Mail.

const BRAND = {
  ink: "#111111", paper: "#F2F0EC", grey: "#EBEAE8", muted: "#6B6660", line: "#E4E1DC", red: "#E4291C",
  font: "'Helvetica Neue',Helvetica,Arial,sans-serif", mono: "'SFMono-Regular',Menlo,Consolas,monospace",
  site: "https://mannorr.com", instagram: "https://www.instagram.com/_mannorr/"
};

const COPY = {
  design: {
    kicker: "Design enquiry",
    title: "Your project enquiry is in.",
    intro: "Thank you for thinking of me for your project. I read every brief myself, and I'll come back to you with questions or a time to talk.",
    steps: ["I review your brief", "A short discovery call", "A proposal, timeline and next steps"],
    alert: "New design enquiry"
  },
  ministry: {
    kicker: "Ministry booking",
    title: "Your booking request is in.",
    intro: "Thank you for inviting me. I'll pray over it, check the date, and get back to you to confirm the details.",
    steps: ["I check the date and pray over it", "We confirm the brief and logistics", "The ministration"],
    alert: "New ministry booking"
  },
  learn: {
    kicker: "Student application",
    title: "Your application is in.",
    intro: "Thank you for wanting to learn design with me. I'll go through your application and reach out on WhatsApp about the next steps.",
    steps: ["I review your application", "A short call on WhatsApp", "We confirm your place and schedule"],
    alert: "New student application"
  },
  updates: {
    kicker: "In You · Waitlist",
    title: "You're on the list.",
    intro: "Thank you for wanting to hear In You. It has been almost seven years in the making, and I can't wait to share it with you. You'll be among the first to know when it's out.",
    steps: ["You get one email the day In You is released", "Listen, share it, and sing along"],
    alert: "New waitlist sign-up"
  }
};

function formKeyOf(form) { return Object.keys(FORMS).find(k => FORMS[k] === form); }

function shell(preheader, inner) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>MANNORR</title></head>
<body style="margin:0;padding:0;background:${BRAND.grey}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.grey}" style="background:${BRAND.grey}">
<tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
${inner}
<tr><td style="padding:24px 8px 0;font:12px/1.6 ${BRAND.font};color:${BRAND.muted};text-align:center">
<a href="${BRAND.site}" style="color:${BRAND.muted};text-decoration:none">mannorr.com</a> &nbsp;·&nbsp;
<a href="${BRAND.instagram}" style="color:${BRAND.muted};text-decoration:none">Instagram @_mannorr</a> &nbsp;·&nbsp;
<a href="mailto:${CONFIG.NOTIFY_EMAIL}" style="color:${BRAND.muted};text-decoration:none">${CONFIG.NOTIFY_EMAIL}</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

function header(kicker, ref) {
  return `<tr><td bgcolor="${BRAND.ink}" style="background:${BRAND.ink};padding:22px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font:600 14px ${BRAND.font};letter-spacing:4px;color:${BRAND.paper}">MANNORR</td>
<td align="right" style="font:12px ${BRAND.mono};color:${BRAND.red}">// ${esc(kicker)}${ref ? " · " + esc(ref) : ""}</td>
</tr></table></td></tr>
<tr><td bgcolor="${BRAND.red}" style="background:${BRAND.red};height:3px;line-height:3px;font-size:0">&nbsp;</td></tr>`;
}

function button(href, label, dark) {
  const bg = dark ? BRAND.ink : BRAND.red;
  return `<td style="padding:0 8px 8px 0"><a href="${href}" style="display:inline-block;background:${bg};color:#ffffff;font:600 14px ${BRAND.font};text-decoration:none;padding:13px 22px;border-radius:999px">${label}</a></td>`;
}

function detailRows(form, d, skip) {
  return form.columns
    .filter(c => !skip.includes(c[1]) && d[c[1]])
    .map(c => `<tr>
<td valign="top" style="padding:12px 16px 12px 0;border-top:1px solid ${BRAND.line};font:12px ${BRAND.mono};color:${BRAND.muted};white-space:nowrap;width:120px">${esc(c[0])}</td>
<td valign="top" style="padding:12px 0;border-top:1px solid ${BRAND.line};font:15px/1.5 ${BRAND.font};color:${BRAND.ink}">${esc(d[c[1]])}</td></tr>`)
    .join("");
}

function notifyOwner(form, d, waUrl) {
  const key = formKeyOf(form), c = COPY[key] || { kicker: form.label, alert: form.label };
  const when = Utilities.formatDate(d.received, "Africa/Lagos", "EEE d MMM yyyy, h:mm a");
  let sheetUrl = "";
  try { sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl() + "#gid=" + sheetFor(form).getSheetId(); } catch (e) {}
  const msg = d.message ? `<tr><td style="padding:8px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border-left:3px solid ${BRAND.red};padding:4px 0 4px 16px;font:16px/1.6 ${BRAND.font};color:${BRAND.ink}">${esc(d.message)}</td></tr></table></td></tr>` : "";
  const inner = header(c.kicker, d.ref) + `
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:32px 32px 8px">
<div style="font:12px ${BRAND.mono};color:${BRAND.muted}">${esc(c.alert)} · ${esc(when)}</div>
<div style="font:600 34px/1.05 ${BRAND.font};letter-spacing:-1px;color:${BRAND.ink};margin-top:10px">${esc(d.name || d.email)}</div>
${d.org || d.company ? `<div style="font:16px ${BRAND.font};color:${BRAND.muted};margin-top:6px">${esc(d.org || d.company)}</div>` : ""}
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:20px 32px 8px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
${waUrl ? button(waUrl, "WhatsApp", true) : ""}${d.email ? button("mailto:" + d.email + "?subject=" + encodeURIComponent("Re: " + d.ref), "Reply by email", false) : ""}
</tr></table></td></tr>
${msg ? msg.replace('<tr><td style="padding:8px 32px 0">', `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:16px 32px 0">`) : ""}
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:20px 32px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${detailRows(form, d, ["ref", "received", "status", "wa", "notes", "name", "message", "page"])}
</table></td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:16px 32px 32px;font:13px/1.6 ${BRAND.font};color:${BRAND.muted}">
${sheetUrl ? `<a href="${sheetUrl}" style="color:${BRAND.ink};font-weight:600">Open the ${esc(form.sheet)} tab</a> and move ${esc(d.ref)} along once you've been in touch.` : `Update ${esc(d.ref)} in the ${esc(form.sheet)} tab once you've been in touch.`}
</td></tr>`;
  MailApp.sendEmail({
    to: CONFIG.NOTIFY_EMAIL,
    subject: `${c.alert} · ${d.name || d.email} · ${d.ref}`,
    htmlBody: shell(`${d.name || d.email}: ${d.message || c.alert}`, inner),
    body: `${c.alert} ${d.ref}\n${d.name}\n${d.email}\n${waUrl ? "WhatsApp: " + waUrl + "\n" : ""}\n${d.message || ""}`,
    replyTo: d.email || CONFIG.NOTIFY_EMAIL,
    name: "mannorr.com"
  });
}

function confirmPerson(form, d) {
  const key = formKeyOf(form), c = COPY[key];
  if (!c) return;
  const steps = c.steps.map((s, i) => `<tr>
<td valign="top" style="padding:12px 14px 12px 0;border-top:1px solid ${BRAND.line};font:12px ${BRAND.mono};color:${BRAND.red};width:28px">0${i + 1}</td>
<td valign="top" style="padding:12px 0;border-top:1px solid ${BRAND.line};font:15px ${BRAND.font};color:${BRAND.ink}">${esc(s)}</td></tr>`).join("");
  const inner = header(c.kicker, d.ref) + `
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:40px 32px 8px">
<div style="font:600 36px/1.05 ${BRAND.font};letter-spacing:-1.2px;color:${BRAND.ink}">Thank you${d.name ? ", " + esc(firstName(d.name)) : ""}.</div>
<div style="font:600 36px/1.05 ${BRAND.font};letter-spacing:-1.2px;color:${BRAND.red}">${esc(c.title)}</div>
<p style="font:16px/1.65 ${BRAND.font};color:#3d3a36;margin:20px 0 0">${esc(c.intro)}</p>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:28px 32px 4px">
<div style="font:12px ${BRAND.mono};color:${BRAND.red};padding-bottom:10px">// What happens next</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${steps}</table>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:28px 32px 4px">
<div style="font:12px ${BRAND.mono};color:${BRAND.red};padding-bottom:10px">// What you sent</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${detailRows(form, d, ["ref", "received", "status", "wa", "notes", "page", "phone"])}
</table></td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:28px 32px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.grey}" style="background:${BRAND.grey};border-radius:14px"><tr>
<td style="padding:18px 20px;font:13px/1.6 ${BRAND.font};color:${BRAND.muted}">Your reference is <strong style="color:${BRAND.ink};font-family:${BRAND.mono}">${esc(d.ref)}</strong>. Reply to this email any time and it comes straight to me.</td>
</tr></table>
<p style="font:15px/1.6 ${BRAND.font};color:${BRAND.ink};margin:28px 0 0">Nifemi Adeniran<br><span style="color:${BRAND.muted}">Designer · Preacher · Songwriter</span></p>
</td></tr>`;
  MailApp.sendEmail({
    to: d.email,
    subject: `${c.title.replace(/\.$/, "")} · ${d.ref}`,
    htmlBody: shell(`${c.title} Reference ${d.ref}.`, inner),
    body: `Thank you${d.name ? ", " + firstName(d.name) : ""}. ${c.title}\n\n${c.intro}\n\nWhat happens next:\n${c.steps.map((s, i) => (i + 1) + ". " + s).join("\n")}\n\nReference: ${d.ref}\n\nNifemi Adeniran\nmannorr.com`,
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

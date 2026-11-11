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
  setupOrders();
  ss.toast("Design, Ministry, Students, Updates and Orders tabs are ready.", "MANNORR");
}

/* ---------- web app ---------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === "read") return json(readBook(p.code));
  return json({ ok: true, service: "MANNORR database" });
}

function doPost(e) {
  // Flutterwave webhook (JSON body). Checked against Flutterwave with your secret key before anything is marked paid.
  if (e && e.postData && /json/.test(e.postData.type || "")) {
    try {
      const body = JSON.parse(e.postData.contents || "{}");
      const id = body && body.data && body.data.id;
      if (id) confirmOrder("", String(id), "successful");
    } catch (err) { console.error("webhook", err); }
    return json({ ok: true });
  }
  const p = (e && e.parameter) || {};
  if (p.form === "order-start") return json(startOrder(p));
  if (p.form === "order-confirm") return json(confirmOrder(clean(p.ref, 20), clean(p.transaction_id, 20).replace(/\D/g, ""), clean(p.status, 20)));
  if (p.form === "order-resend") return json(resendReading(clean(p.email, 200).toLowerCase()));

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

/* =====================================================================
   BOOK SALES: Our Space (digital reader + paperback, paid through Flutterwave payment links)
   Script properties needed (Project Settings → Script properties):
     FLW_SECRET_KEY   your Flutterwave secret key (never put it in the website)
     BOOK_FILE_ID     the Google Drive file ID of the book PDF (keep the file private)
   ===================================================================== */

const BOOK = {
  title: "Our Space",
  subtitle: "Building a Godly Long Distance Relationship",
  currency: "NGN",
  prices: { digital: 7000, paperback: 13000 },   // paperback price includes delivery anywhere in Nigeria
  links: {                                         // Flutterwave payment links (set each link's Redirect URL to https://mannorr.com/thank-you)
    digital: "https://flutterwave.com/pay/qlnbvtyva9gp",
    paperback: "https://flutterwave.com/pay/wmu0epx7tldq"
  },
  readerUrl: "https://mannorr.com/read",
  sheet: "Orders", prefix: "OR-",
  statuses: ["Pending", "Check payment", "Paid", "Shipped", "Delivered", "Failed", "Refunded"],
  columns: [["Reference","ref"],["Created","created"],["Status","status"],["Format","format"],["Name","name"],["Email","email"],
            ["Phone","phone"],["WhatsApp","wa"],["State","state"],["City","city"],["Address","address"],["Book (₦)","price"],
            ["Delivery (₦)","fee"],["Total (₦)","total"],["Payment ref","tx_ref"],["Flutterwave ID","flw_id"],["Paid at","paid"],
            ["Reader code","code"],["Opens","opens"],["Notes","notes"]]
};
const PAID = ["Paid", "Shipped", "Delivered"];
const NG_STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti",
  "Enugu","FCT Abuja","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo",
  "Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];

function setupOrders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(BOOK.sheet);
  if (!sh) sh = ss.insertSheet(BOOK.sheet);
  const headers = BOOK.columns.map(c => c[0]);
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight("bold").setFontColor("#F2F0EC").setBackground("#111111");
  sh.setFrozenRows(1);
  const sc = headers.indexOf("Status") + 1;
  const rng = sh.getRange(2, sc, sh.getMaxRows() - 1, 1);
  rng.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(BOOK.statuses, true).setAllowInvalid(false).build());
  const colours = { Pending: "#E4E4E4", "Check payment": "#FCEBC4", Paid: "#FAD4CF", Shipped: "#E9DDF4", Delivered: "#D3EBD9", Failed: "#E4E4E4", Refunded: "#E4E4E4" };
  sh.setConditionalFormatRules(Object.keys(colours).map(k =>
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(k).setBackground(colours[k]).setRanges([rng]).build()));
  sh.getRange(2, headers.indexOf("Created") + 1, sh.getMaxRows() - 1, 1).setNumberFormat("dd mmm yyyy, hh:mm");
  sh.getRange(2, headers.indexOf("Paid at") + 1, sh.getMaxRows() - 1, 1).setNumberFormat("dd mmm yyyy, hh:mm");
  // Lets you confirm a payment by hand: set Status to Paid and the buyer gets their book.
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === "onOrderEdit"))
    ScriptApp.newTrigger("onOrderEdit").forSpreadsheet(ss).onEdit().create();
}

function ordersSheet() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BOOK.sheet);
  if (!sh) throw new Error("Run setup() first.");
  return sh;
}
function col(name) { return BOOK.columns.findIndex(c => c[1] === name) + 1; }
function rowObj(data, row) { const o = { _row: row }; BOOK.columns.forEach((c, j) => { o[c[1]] = data[j]; }); return o; }
function allOrders() {
  const sh = ordersSheet(), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, BOOK.columns.length).getValues().map((r, i) => rowObj(r, i + 2));
}

function findOrder(field, value) {
  if (!value) return null;
  const list = allOrders();
  for (let i = list.length - 1; i >= 0; i--) if (String(list[i][field]) === String(value)) return list[i];
  return null;
}
function setCells(row, obj) {
  const sh = ordersSheet();
  Object.keys(obj).forEach(k => { const c = col(k); if (c) sh.getRange(row, c).setValue(obj[k]); });
}

function priceFor(format) {
  return format === "digital" ? { price: BOOK.prices.digital, fee: 0 } : { price: BOOK.prices.paperback, fee: 0 };
}

// Saves the order, then the site sends the buyer to the Flutterwave payment link.
function startOrder(p) {
  const format = p.format === "paperback" ? "paperback" : "digital";
  const d = {
    format: format, name: clean(p.name, 120), email: clean(p.email, 200).toLowerCase(), phone: "",
    state: clean(p.state, 40), city: clean(p.city, 80), address: clean(p.address, 400)
  };
  if (!d.name || !d.email) return { ok: false, error: "Please add your name and email." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return { ok: false, error: "Please check your email address." };
  let phone = "";
  if (p.phone) { phone = intlPhone(p.phone); if (phone.length >= 10) d.phone = "'+" + phone; }
  if (format === "paperback") {
    if (NG_STATES.indexOf(d.state) < 0) return { ok: false, error: "Please choose your state." };
    if (!d.city || !d.address || !phone) return { ok: false, error: "Please add your phone number, city and delivery address." };
  }
  const pr = priceFor(format);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    const n = Number(props.getProperty("lastRef_" + BOOK.prefix) || Math.max(0, ordersSheet().getLastRow() - 1)) + 1;
    props.setProperty("lastRef_" + BOOK.prefix, String(n));
    d.ref = BOOK.prefix + String(n).padStart(4, "0");
    d.tx_ref = ""; d.created = new Date(); d.status = "Pending";
    d.price = pr.price; d.fee = pr.fee; d.total = pr.price + pr.fee;
    d.wa = phone ? `=HYPERLINK("https://wa.me/${phone}","WhatsApp")` : "";
    d.flw_id = ""; d.paid = ""; d.code = ""; d.opens = 0; d.notes = "";
    ordersSheet().appendRow(BOOK.columns.map(c => d[c[1]] === undefined ? "" : d[c[1]]));
  } finally { lock.releaseLock(); }
  return { ok: true, ref: d.ref, amount: d.total, pay_url: BOOK.links[format] };
}

// Asks Flutterwave about one transaction. Returns its details only if it really succeeded in naira.
function verifyTransaction(id) {
  const key = PropertiesService.getScriptProperties().getProperty("FLW_SECRET_KEY");
  if (!key || !id) return null;
  const res = UrlFetchApp.fetch("https://api.flutterwave.com/v3/transactions/" + encodeURIComponent(id) + "/verify",
    { headers: { Authorization: "Bearer " + key }, muteHttpExceptions: true });
  const j = JSON.parse(res.getContentText() || "{}"), t = j && j.data;
  if (j.status !== "success" || !t || t.status !== "successful" || t.currency !== BOOK.currency) return null;
  return t;
}

// Marks an order paid, gives digital buyers their reading code, and sends the emails.
function markPaid(o, t) {
  const code = o.format === "digital" ? (o.code || Utilities.getUuid().replace(/-/g, "")) : "";
  const upd = { status: "Paid", paid: new Date(), code: code };
  if (t) { upd.flw_id = t.id; upd.tx_ref = t.tx_ref || ""; }
  setCells(o._row, upd);
  Object.assign(o, upd);
  try { orderEmails(o); } catch (err) { console.error("order email", err); }
  return { ok: true, ref: o.ref, format: o.format, code: code };
}

// Called by the thank-you page after Flutterwave sends the buyer back, and by the webhook. Safe to call twice.
//   ref:  our order reference (OR-0001), when the buyer comes back in the same browser
//   id:   Flutterwave transaction_id
function confirmOrder(ref, id, status) {
  if (status && status !== "successful" && status !== "completed") return { ok: false, cancelled: true, error: "The payment wasn't completed." };
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const used = id ? findOrder("flw_id", id) : null;
    if (used) return PAID.indexOf(used.status) > -1 ? { ok: true, ref: used.ref, format: used.format, code: used.code } : { ok: false, pending: true, ref: used.ref };
    let o = ref ? findOrder("ref", ref) : null;
    if (o && PAID.indexOf(o.status) > -1) return { ok: true, ref: o.ref, format: o.format, code: o.code };

    const t = verifyTransaction(id);
    if (t) {
      const email = String((t.customer && t.customer.email) || "").toLowerCase(), amount = Number(t.amount);
      if (!o) {   // buyer came back on another device, or this is the webhook: match by email and amount
        const open = allOrders().filter(x => (x.status === "Pending" || x.status === "Check payment") && x.email === email && Number(x.total) === amount);
        o = open.length ? open[open.length - 1] : null;
      }
      if (!o) {   // paid, but we have no order on file (e.g. paid straight from the link): tell the owner
        notifyUnmatched(t);
        return { ok: false, pending: true, error: "We received your payment and will email you shortly." };
      }
      if (amount < Number(o.total)) return { ok: false, pending: true, ref: o.ref, error: "The amount paid doesn't match this order." };
      return markPaid(o, t);
    }

    // No secret key set (or Flutterwave didn't confirm yet): flag it for a manual check.
    if (o && id && o.status === "Pending") {
      setCells(o._row, { status: "Check payment", flw_id: id, notes: "Returned from Flutterwave " + new Date().toLocaleString() });
      Object.assign(o, { status: "Check payment", flw_id: id });
      try { checkPaymentEmail(o); } catch (err) { console.error("check email", err); }
    }
    return { ok: false, pending: true, ref: o ? o.ref : "" };
  } finally { lock.releaseLock(); }
}

// Installable trigger (created by setup): when you set an order's Status to Paid by hand, the buyer gets their book.
function onOrderEdit(e) {
  const r = e && e.range;
  if (!r || r.getSheet().getName() !== BOOK.sheet || r.getColumn() !== col("status") || r.getRow() < 2 || r.getNumRows() > 1) return;
  if (String(e.value) !== "Paid") return;
  const row = r.getRow(), o = rowObj(ordersSheet().getRange(row, 1, 1, BOOK.columns.length).getValues()[0], row);
  if (o.paid) return;   // already handled
  markPaid(o, null);
}

function checkPaymentEmail(o) {
  const url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const inner = header("Check a payment", o.ref) + `
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:32px">
<div style="font:600 30px/1.1 ${BRAND.font};letter-spacing:-1px;color:${BRAND.ink}">${esc(o.name)} says they paid ${esc(naira(o.total))}.</div>
<p style="font:15px/1.6 ${BRAND.font};color:#3d3a36;margin:16px 0 0">Find Flutterwave transaction <strong>${esc(String(o.flw_id))}</strong> in your Flutterwave dashboard. If it's there, set the Status of ${esc(o.ref)} to <strong>Paid</strong> in the Orders tab and the buyer gets ${o.format === "digital" ? "their reading link" : "their confirmation"} straight away.</p>
<p style="font:13px/1.6 ${BRAND.font};color:${BRAND.muted};margin:14px 0 0">Add FLW_SECRET_KEY in Apps Script and this check happens automatically.</p>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:0 32px 32px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${button(url, "Open the Orders tab", true)}</tr></table></td></tr>`;
  MailApp.sendEmail({ to: CONFIG.NOTIFY_EMAIL, subject: `Check payment · ${o.name} · ${naira(o.total)} · ${o.ref}`,
    htmlBody: shell("Confirm a book payment", inner), body: `${o.ref}: ${o.name} (${o.email}) returned from Flutterwave, transaction ${o.flw_id}. Set Status to Paid once you've seen it.`, name: "mannorr.com" });
}

function notifyUnmatched(t) {
  const c = t.customer || {};
  MailApp.sendEmail({ to: CONFIG.NOTIFY_EMAIL, subject: `Book payment with no order · ${naira(t.amount)} · ${c.email || ""}`,
    body: `A payment came in through a book payment link but didn't match an order on the site.\n\nName: ${c.name || ""}\nEmail: ${c.email || ""}\nPhone: ${c.phone_number || ""}\nAmount: ${naira(t.amount)}\nFlutterwave ID: ${t.id}\n\nAdd a row in the Orders tab for them (Format, Name, Email, Total) and set Status to Paid to send the book.`,
    name: "mannorr.com" });
}

// The reader asks for the book with a code. Returns the PDF only for paid digital orders.
function readBook(code) {
  code = String(code || "").replace(/[^a-f0-9]/gi, "");
  if (code.length < 20) return { ok: false, error: "This reading link isn't valid." };
  const o = findOrder("code", code);
  if (!o || PAID.indexOf(o.status) < 0) return { ok: false, error: "This reading link isn't valid." };
  const id = PropertiesService.getScriptProperties().getProperty("BOOK_FILE_ID");
  if (!id) return { ok: false, error: "The book isn't available yet. Please try again later." };
  setCells(o._row, { opens: Number(o.opens || 0) + 1 });
  const blob = DriveApp.getFileById(id).getBlob();
  return { ok: true, name: firstName(o.name), email: o.email, data: Utilities.base64Encode(blob.getBytes()) };
}

// "Lost your link?" on the reader page. Always answers the same way so it can't be used to check emails.
function resendReading(email) {
  const answer = { ok: true, message: "If that email bought the digital edition, a fresh reading link is on its way." };
  if (!email) return answer;
  const cache = CacheService.getScriptCache(), k = "resend_" + Utilities.base64EncodeWebSafe(email);
  if (cache.get(k)) return answer;
  cache.put(k, "1", 600);
  const sh = ordersSheet(), last = sh.getLastRow();
  if (last < 2) return answer;
  const rows = sh.getRange(2, 1, last - 1, BOOK.columns.length).getValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    const o = {}; BOOK.columns.forEach((c, j) => { o[c[1]] = rows[i][j]; });
    if (o.email === email && o.format === "digital" && o.code && ["Paid", "Shipped", "Delivered"].indexOf(o.status) > -1) {
      sendBookEmail(o, true);
      break;
    }
  }
  return answer;
}

function naira(n) { return "₦" + Number(n || 0).toLocaleString("en-NG"); }

function pairRows(pairs) {
  return pairs.filter(p => p[1]).map(p => `<tr>
<td valign="top" style="padding:12px 16px 12px 0;border-top:1px solid ${BRAND.line};font:12px ${BRAND.mono};color:${BRAND.muted};white-space:nowrap;width:120px">${esc(p[0])}</td>
<td valign="top" style="padding:12px 0;border-top:1px solid ${BRAND.line};font:15px/1.5 ${BRAND.font};color:${BRAND.ink}">${esc(p[1])}</td></tr>`).join("");
}

function orderEmails(o) {
  sendBookEmail(o, false);
  const isPaper = o.format === "paperback";
  const phone = String(o.phone || "").replace(/^'/, "").replace(/\D/g, "");
  const wa = phone ? `https://wa.me/${phone}?text=${encodeURIComponent("Hello " + firstName(o.name) + ", this is Nifemi (MANNORR). Thank you for ordering Our Space (" + o.ref + ").")}` : "";
  const inner = header(isPaper ? "Paperback order" : "E-book sale", o.ref) + `
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:32px 32px 8px">
<div style="font:12px ${BRAND.mono};color:${BRAND.muted}">Our Space · ${isPaper ? "Paperback to deliver" : "Digital edition"} · paid ${esc(naira(o.total))}</div>
<div style="font:600 34px/1.05 ${BRAND.font};letter-spacing:-1px;color:${BRAND.ink};margin-top:10px">${esc(o.name)}</div>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:20px 32px 8px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
${wa ? button(wa, "WhatsApp", true) : ""}${button("mailto:" + o.email + "?subject=" + encodeURIComponent("Your Our Space order " + o.ref), "Email buyer", false)}
</tr></table></td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:20px 32px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${pairRows([["Email", o.email], ["Phone", String(o.phone || "").replace(/^'/, "")], ["Deliver to", isPaper ? [o.address, o.city, o.state].filter(Boolean).join(", ") : ""],
  ["Book", naira(o.price)], ["Delivery", isPaper ? "Included" : ""], ["Total paid", naira(o.total)], ["Flutterwave ID", String(o.flw_id || "Confirmed by hand")]])}
</table>
<p style="font:13px/1.6 ${BRAND.font};color:${BRAND.muted};margin:20px 0 0">${isPaper ? "Ship it, then set the Status of " + esc(o.ref) + " to Shipped in the Orders tab." : "The buyer has been sent their reading link."}</p>
</td></tr>`;
  MailApp.sendEmail({
    to: CONFIG.NOTIFY_EMAIL,
    subject: `${isPaper ? "Paperback order" : "E-book sale"} · ${o.name} · ${naira(o.total)} · ${o.ref}`,
    htmlBody: shell(`${o.name} bought Our Space (${isPaper ? "paperback" : "digital"})`, inner),
    body: `${o.ref} ${o.name} ${o.email} ${naira(o.total)} ${isPaper ? [o.address, o.city, o.state].join(", ") : "digital"}`,
    replyTo: o.email, name: "mannorr.com"
  });
}

function sendBookEmail(o, isResend) {
  const isPaper = o.format === "paperback";
  const link = BOOK.readerUrl + "?code=" + o.code;
  const steps = isPaper
    ? ["We pack your copy", "We send it to the address below", "You'll get a message when it's on its way"]
    : ["Tap Start reading below", "Read on any phone, tablet or computer", "Keep this email: your link opens the book any time"];
  const stepRows = steps.map((s, i) => `<tr>
<td valign="top" style="padding:12px 14px 12px 0;border-top:1px solid ${BRAND.line};font:12px ${BRAND.mono};color:${BRAND.red};width:28px">0${i + 1}</td>
<td valign="top" style="padding:12px 0;border-top:1px solid ${BRAND.line};font:15px ${BRAND.font};color:${BRAND.ink}">${esc(s)}</td></tr>`).join("");
  const inner = header("Our Space", o.ref) + `
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:40px 32px 8px">
<div style="font:600 36px/1.05 ${BRAND.font};letter-spacing:-1.2px;color:${BRAND.ink}">${isResend ? "Here's your book" : "Thank you, " + esc(firstName(o.name)) + "."}</div>
<div style="font:600 36px/1.05 ${BRAND.font};letter-spacing:-1.2px;color:${BRAND.red}">${isPaper ? "Your copy is on its way." : "Your book is ready to read."}</div>
<p style="font:16px/1.65 ${BRAND.font};color:#3d3a36;margin:20px 0 0">${isPaper
    ? "Thank you for ordering Our Space: Building a Godly Long Distance Relationship. I pray it strengthens your relationship and keeps Christ at the centre of it."
    : "Thank you for getting Our Space: Building a Godly Long Distance Relationship. I pray it strengthens your relationship and keeps Christ at the centre of it."}</p>
</td></tr>
${isPaper ? "" : `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:24px 32px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${button(link, "Start reading →", false)}</tr></table>
<p style="font:12px/1.6 ${BRAND.font};color:${BRAND.muted};margin:8px 0 0">This link is yours. Please don't share it.</p></td></tr>`}
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:28px 32px 4px">
<div style="font:12px ${BRAND.mono};color:${BRAND.red};padding-bottom:10px">// What happens next</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${stepRows}</table></td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:28px 32px 4px">
<div style="font:12px ${BRAND.mono};color:${BRAND.red};padding-bottom:10px">// Your order</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${pairRows([["Book", "Our Space · " + (isPaper ? "Paperback" : "Digital edition")], ["Deliver to", isPaper ? [o.address, o.city, o.state].filter(Boolean).join(", ") : ""],
  ["Book price", naira(o.price)], ["Delivery", isPaper ? "Included" : ""], ["Total paid", naira(o.total)]])}
</table></td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:28px 32px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.grey}" style="background:${BRAND.grey};border-radius:14px"><tr>
<td style="padding:18px 20px;font:13px/1.6 ${BRAND.font};color:${BRAND.muted}">Your order reference is <strong style="color:${BRAND.ink};font-family:${BRAND.mono}">${esc(o.ref)}</strong>. Reply to this email any time and it comes straight to me.</td>
</tr></table>
<p style="font:15px/1.6 ${BRAND.font};color:${BRAND.ink};margin:28px 0 0">Nifemi Adeniran<br><span style="color:${BRAND.muted}">Author, Our Space</span></p>
</td></tr>`;
  MailApp.sendEmail({
    to: o.email,
    subject: isPaper ? `Your Our Space order is confirmed · ${o.ref}` : `Your copy of Our Space · ${o.ref}`,
    htmlBody: shell(isPaper ? "Your paperback is on its way." : "Your book is ready to read.", inner),
    body: isPaper ? `Thank you, ${firstName(o.name)}. Your Our Space paperback order ${o.ref} is confirmed and will be delivered to ${[o.address, o.city, o.state].join(", ")}.`
                  : `Thank you, ${firstName(o.name)}. Start reading Our Space here: ${link}\n\nReference: ${o.ref}`,
    replyTo: CONFIG.NOTIFY_EMAIL, name: CONFIG.OWNER_NAME
  });
}

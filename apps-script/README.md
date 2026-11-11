# mannorr.com forms → Google Sheet

Every form on mannorr.com sends to one Google Sheet that you own, through Google Apps Script. No paid service or outside database.

| Tab | What lands there | Reference |
|---|---|---|
| Design | Design project enquiries (Work With Me → Design) | DE-0001 |
| Ministry | Bookings to minister in song or teach (Work With Me → Ministry) | MB-0001 |
| Students | Applications to learn design (Work With Me → Learn) | ST-0001 |
| Updates | "Tell me when In You is out" sign-ups | UP-0001 |

## One-time setup (about 10 minutes)

Do this signed in to **hellomannorr@gmail.com**, the official site address. The account that deploys the script is the one that owns the sheet and sends the emails.

1. **Create the sheet.** Go to sheets.new and name it `MANNORR Database`.
2. **Open Apps Script.** In the sheet: *Extensions → Apps Script*.
3. **Paste the code.** Delete everything in `Code.gs`, paste the full contents of [`Code.gs`](Code.gs), and click **Save**.
4. **Build the tabs.** Choose `setup` in the function menu and click **Run**. Approve the permission prompt (*Advanced → Go to project → Allow*). Four tabs appear with headers, Status dropdowns and colours.
5. **Deploy.** *Deploy → New deployment →* gear icon *→ Web app*.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
6. **Connect the site.** In `index.html`, paste the URL into:
   ```js
   var DB_ENDPOINT = 'https://script.google.com/macros/s/……/exec';
   ```
   Commit and push. Until this is set, the forms fall back to the existing Formspree form, so nothing is lost in the meantime.
7. **Test.** Send a form on the live site. A row should appear in the right tab, and an email should arrive at hellomannorr@gmail.com.

Optional: run `testStudent` in the editor to add a test row without using the site.

## Day to day

- Each submission gets a reference and the first Status (New, or Subscribed for Updates).
- Tap **WhatsApp** in the email or the sheet to reply with a ready greeting.
- Move the Status along as you go, and use **Notes** for anything else.
- Students: New → Contacted → Accepted → Paid → In progress → Completed.

## Changing the code later

Edit `Code.gs`, then *Deploy → Manage deployments → Edit → Version: New version → Deploy*. The URL stays the same.

## Protection

Hidden spam field, a minimum fill time, duplicate protection (same email and form within 2 minutes), a site-wide cap of 30 submissions per 10 minutes, at most one confirmation email per address every 6 hours, and formula-like values stored as plain text. Keep the sheet private.

A free Gmail account can send about 100 script emails a day. Each enquiry, booking or application uses one or two; Updates sign-ups send none.

## Book sales: Our Space (/our-space and /read)

Buyers fill in their details on mannorr.com, which saves the order in an **Orders** tab. They are then sent to your Flutterwave payment link:
- Digital ₦7,000: https://flutterwave.com/pay/qlnbvtyva9gp
- Paperback ₦13,000, delivery included: https://flutterwave.com/pay/wmu0epx7tldq

After paying, Flutterwave sends them back to mannorr.com/thank-you. The script checks the payment, then:
- **Digital:** emails a private reading link (mannorr.com/read?code=…). The reader only opens the book for paid codes and shows the buyer's email faintly on every page.
- **Paperback:** emails the buyer a confirmation and sends you the delivery address. Set Status to Shipped and then Delivered as you go.

Prices live in `BOOK` in `Code.gs` and `BOOK` in `assets/site.js`. They must match the amounts on the payment links.

### Setup

1. **Redirect URL on both links.** Flutterwave dashboard → Payment links → open each link → Edit → Redirect URL = `https://mannorr.com/thank-you`. Save. Without this, buyers aren't brought back to confirm.
2. **Book file.** Upload `Our-Space.pdf` to Google Drive on hellomannorr@gmail.com. Keep it private (do not share it). Open it and copy the ID from the address: `drive.google.com/file/d/`**`THIS-PART`**`/view`.
3. **Script properties.** In Apps Script: *Project Settings (gear) → Script properties → Add*:
   - `BOOK_FILE_ID` = the ID from step 2
   - `FLW_CLIENT_ID` and `FLW_CLIENT_SECRET` = from Flutterwave → Settings → API keys → **Live API keys** (the v4 keys). If your account shows an older secret key starting `FLWSECK-` instead, add it as `FLW_SECRET_KEY`. Keys stay inside Apps Script, never in the website. With them, payments are confirmed and books delivered automatically.
   - To check the keys: open `testPayment` in the editor, paste a real transaction ID from Flutterwave → Transactions, run it and read the log.
4. **Update the code.** Paste the new `Code.gs`, Save, run `setup` once (approve the new permissions), then *Deploy → Manage deployments → Edit → New version → Deploy*.
5. **Webhook (recommended).** Flutterwave → Settings → Webhooks → URL = your Apps Script `/exec` URL, tick *JSON format*. This confirms orders even when a buyer closes the page before coming back.
6. **Test.** Buy the digital edition yourself, check the Orders tab, the emails and the reader.

### Without the secret key

When a buyer comes back from Flutterwave, the order turns **Check payment** and you get an email. Find the transaction in Flutterwave. If it's there, set Status to **Paid** and the buyer gets their book or confirmation straight away. The same works for anyone who pays some other way, such as a bank transfer: add or find their row, then set it to Paid.

### The swipe reader (text edition)

mannorr.com/read opens the book as swipeable pages that fit any screen, with contents, search, text size, Paper/Sepia/Night themes, and resume. The book text is on the site only in encrypted form (`assets/book/our-space.bin`). The key to open it lives in Apps Script and is handed only to paid reading links.

Setup: Apps Script → Project Settings → Script properties → add `BOOK_TEXT_KEY` with the key Claude gave you. Until it is set, the reader falls back to the PDF from `BOOK_FILE_ID`.

Changing the book text: edit `main.tex` in Overleaf, then run
`BOOK_TEXT_KEY=<the same key> python3 tools/build-ebook.py path/to/main.tex`
and bump `?v=` on `BOOK_URL` in `assets/ereader.js`. Keep the key the same, or every reader needs the new one.

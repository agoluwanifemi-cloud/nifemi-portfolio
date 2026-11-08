# mannorr.com forms → Google Sheet

Every form on mannorr.com sends to one Google Sheet that you own, through Google Apps Script. No paid service or outside database.

| Tab | What lands there | Reference |
|---|---|---|
| Design | Design project enquiries (Work With Me → Design) | DE-0001 |
| Ministry | Bookings to minister in song or teach (Work With Me → Ministry) | MB-0001 |
| Students | Applications to learn design (Work With Me → Learn) | ST-0001 |
| Updates | "Tell me when In You is out" sign-ups | UP-0001 |

## One-time setup (about 10 minutes)

Do this signed in to **ag.oluwanifemi@gmail.com**.

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
7. **Test.** Send a form on the live site. A row should appear in the right tab, and an email should arrive at ag.oluwanifemi@gmail.com.

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

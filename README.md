# MANNORR — Portfolio Template

**A complete portfolio system for designers.** Not just a website — a working business tool with portfolio management, service packages, client intake, invoice generation, and digital signatures.

---

## What's Included

| File | Purpose |
|------|---------|
| `index.html` | Homepage — hero, portfolio preview (5–6 random works), about, experience, contact form |
| `portfolio.html` | Full portfolio — scattered/artistic layout, randomised on every visit, lightbox view |
| `work-with-me.html` | Service packages + custom project builder, multi-currency pricing, client intake form |
| `invoice.html` | Auto-generated invoice with payment details, 60% deposit split, digital signature |
| `admin.html` | Content management — upload/reorder/delete portfolio images, manage data |
| `hero.png` | Hero background image |

---

## 🚀 Setup Guide (15 minutes)

You need three free accounts. No coding required after setup.

### Step 1: Create a Cloudinary Account (image hosting)

1. Go to **[cloudinary.com](https://cloudinary.com)** → Sign up (free tier = 25GB storage)
2. From your **Dashboard**, copy your **Cloud Name** (e.g. `dxyz123abc`)
3. Go to **Settings → Upload** tab
4. Scroll to **Upload presets** → Click **Add upload preset**
5. Configure:
   - **Preset name**: `nifemi_portfolio` (or your own name)
   - **Signing Mode**: **Unsigned** ← important
   - **Folder**: `portfolio` (optional but recommended)
6. Click **Save**
7. Go to **Settings → Security** tab → Enable **"Resource list"** → Save

### Step 2: Create a JSONBin Account (portfolio data storage)

1. Go to **[jsonbin.io](https://jsonbin.io)** → Sign up (free)
2. Click **Create a Bin**
3. Paste this as the initial content:
   ```json
   { "images": [] }
   ```
4. Click **Create**
5. Copy the **Bin ID** from the URL (looks like `65a1b2c3d4e5f6...`)
6. Go to **API Keys** in your dashboard → Copy your **X-Master-Key**

### Step 3: Create a Formspree Account (contact & invoice forms)

1. Go to **[formspree.io](https://formspree.io)** → Sign up (free)
2. Click **New Form** → Give it a name like "Portfolio Contact"
3. Copy the **Form ID** from the endpoint URL (looks like `mldqqvra`)

### Step 4: Update Your Files

**In `admin.html`**, find and update these lines:

```js
const CLOUD_NAME = 'YOUR_CLOUD_NAME';        // From Cloudinary dashboard
const UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET';   // The preset name you created
const ADMIN_PASSWORD = 'YOUR_PASSWORD';       // Pick a strong password
```

Also update the JSONBin credentials when prompted in the admin panel — or find these lines:

```js
const JSONBIN_API = 'https://api.jsonbin.io/v3/b';
const JSONBIN_BIN_ID = 'YOUR_BIN_ID';        // From Step 2
const JSONBIN_KEY = 'YOUR_X_MASTER_KEY';      // From Step 2
```

**In `index.html`**, update:

```js
const JSONBIN_BIN_ID = 'YOUR_BIN_ID';        // Same Bin ID as admin
```

And update the Formspree form action:

```html
<form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
```

**In `portfolio.html`**, update:

```js
const JSONBIN_BIN_ID = 'YOUR_BIN_ID';        // Same Bin ID
```

**In `work-with-me.html`**, update the Formspree endpoint:

```js
fetch('https://formspree.io/f/YOUR_FORM_ID', ...
```

**In `invoice.html`**, update the Formspree endpoint for signature notifications:

```js
fetch('https://formspree.io/f/YOUR_FORM_ID', ...
```

### Step 5: Personalise Your Content

Open each file and update your personal information:

**`index.html`:**
- Your name in the nav logo and hero
- Hero title, subtitle, and tagline
- About section bio, stats, and photo
- Experience timeline entries
- Social links (LinkedIn, Instagram, etc.)
- Footer text

**`work-with-me.html`:**
- Package names, descriptions, and pricing
- Service list and pricing in the custom builder
- Currency exchange rates (if needed)

**`invoice.html`:**
- Your name and business address in the "From" section
- Payment details for each currency tab (bank details, PayPal, etc.)

### Step 6: Deploy

**Option A — GitHub Pages (free)**
1. Create a GitHub repository
2. Push all files to the repo
3. Go to repo **Settings → Pages** → Set source to `main` branch
4. Your site is live at `yourusername.github.io/reponame`

**Option B — Netlify (free)**
1. Go to [netlify.com](https://netlify.com) → drag your project folder onto the page
2. Site is live instantly with a random URL
3. Add your custom domain in site settings

**Option C — Vercel (free)**
1. Push to GitHub
2. Import the repo at [vercel.com](https://vercel.com)
3. Deploy — done

---

## 🎨 Managing Your Portfolio

### Adding Work

1. Go to `yoursite.com/admin.html`
2. Enter your admin password
3. Type a project title and select a category
4. Drag & drop images or click to select
5. Click **Upload**
6. Images appear on your live site immediately — no redeployment needed

### Reordering Work

- In the admin panel, drag and drop portfolio items to reorder
- Changes save automatically to JSONBin

### Deleting Work

- Click the delete button on any item in the admin panel
- The image is removed from JSONBin (to also free Cloudinary storage, delete from the Cloudinary Media Library)

---

## 💰 How the Client Flow Works

This is the full client journey built into your site:

```
Client visits your site
        ↓
Browses portfolio (index.html → portfolio.html)
        ↓
Clicks "Work With Me"
        ↓
Chooses a Package OR builds a custom project
  • Picks currency (EUR / USD / GBP)
  • Sees live pricing with 60% deposit calculation
        ↓
Fills in their details (name, email, company, brief)
        ↓
Clicks "Generate Invoice"
  → You receive an email notification via Formspree
  → Client is redirected to invoice.html
        ↓
Client reviews the invoice
  • Sees all services, total, deposit amount
  • Sees your payment details (bank / PayPal)
  • Invoice valid for 7 days
        ↓
Client signs digitally
  • Types their full name
  • Checks the agreement box
  • Clicks "Sign & Confirm"
  → You receive a signature notification via Formspree
        ↓
Client pays the 60% deposit using your payment details
        ↓
You begin work
```

---

## 📁 File Structure

```
├── index.html          ← Homepage with portfolio preview
├── portfolio.html      ← Full portfolio gallery
├── work-with-me.html   ← Service picker & client intake
├── invoice.html        ← Auto-generated invoice + signature
├── admin.html          ← Portfolio management (password-protected)
├── hero.png            ← Hero background image
└── README.md           ← This file
```

---

## 🎛 Customisation Reference

### Changing the Theme Accent Colour

Each page uses CSS variables. Find the `[data-theme="dark"]` block and change:

```css
--accent: #c8ff00;   /* Change this to any colour */
```

For light mode, find `[data-theme="light"]` and change:

```css
--accent: #5a00e6;   /* Change this to any colour */
```

### Changing Fonts

The template uses three fonts loaded from Google Fonts:

- **Syne** — Display/headlines
- **DM Mono** — Body text, labels, UI
- **Instrument Serif** — Italic accents, taglines

To change them, update the Google Fonts `<link>` tag in the `<head>` and the CSS variables:

```css
--serif: 'Instrument Serif', serif;
--mono: 'DM Mono', monospace;
--display: 'Syne', sans-serif;
```

### Adding/Editing Services & Packages

In `work-with-me.html`, packages are defined in two places:

1. **The HTML** — the visible cards with descriptions and pricing
2. **The JavaScript `pkgData` object** — used for calculations and invoice generation

Make sure both match when editing.

### Changing Payment Details

In `invoice.html`, find the payment tabs section and update your:

- EUR bank details (IBAN, BIC, bank name)
- USD bank details
- GBP bank details
- NGN bank details
- PayPal email

### Changing Currency Exchange Rates

In `work-with-me.html`, find:

```js
const rate = { EUR: 1, USD: 1.086, GBP: 0.86 };
```

Update the rates as needed. EUR is the base currency.

---

## 🔒 Security Notes

- The admin password is client-side — it deters casual access but isn't encrypted
- Cloudinary upload presets are unsigned — this is fine for portfolios
- JSONBin data is accessible via API key — don't share your X-Master-Key
- Invoice data passes through localStorage between pages — cleared on next visit
- Formspree handles form spam filtering automatically
- For production use, bookmark `yoursite.com/admin.html` — don't link it publicly

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Images not loading | Check that your JSONBin Bin ID is the same in index.html, portfolio.html, and admin.html |
| Upload failing | Verify Cloudinary Cloud Name and Upload Preset are correct. Preset must be **Unsigned**. |
| Contact form not sending | Check your Formspree Form ID is correct in the form `action` attribute |
| Invoice page is blank | Make sure you arrived from work-with-me.html (it passes data via localStorage) |
| Signature email not arriving | Check Formspree Form ID in invoice.html matches your account |
| Portfolio not randomising | Hard refresh (Ctrl+Shift+R) — browsers sometimes cache |
| Dark/light toggle not saving | Check that localStorage is not blocked by your browser |
| Admin won't connect to JSONBin | Make sure "Resource list" is enabled in Cloudinary Security settings |

---

## 🛠 Tech Stack

- **HTML/CSS/JS** — No frameworks, no build tools, no dependencies
- **Cloudinary** — Image hosting & optimisation (free tier)
- **JSONBin** — Portfolio data storage (free tier)
- **Formspree** — Form submissions without a backend (free tier)
- **Google Fonts** — Syne, DM Mono, Instrument Serif
- **Hosting** — Any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages)

**Total ongoing cost: €0**

---

## 📄 License

This template is for personal/commercial use by the buyer. Do not resell or redistribute the template files. You may use it for as many of your own sites as you like.

---

Built by **MANNORR** — Adeniran Oluwanifemi

## Site structure (mannorr.com)

Each page is its own file; they share one stylesheet and one script, which browsers cache.

| URL | File |
|---|---|
| / | index.html |
| /about | about.html |
| /works | works.html |
| /music | music.html (In You) |
| /design | design.html |
| /apologetics | apologetics.html |
| /viral-church | viral-church.html |
| /work-with-me | work-with-me.html (Design, Ministry, Learn: /work-with-me#learn) |
| /thank-you | thank-you.html |
| /portfolio | portfolio.html (driven by /admin) |
| /packages | packages.html (packages and pricing, leads to /invoice) |

Shared: `assets/site.css`, `assets/site.js`. The navbar and footer are repeated in each page, so a change there goes in every file.
When you change site.css or site.js, bump the `?v=` number in each page so visitors get the new version.
Form endpoint (Google Apps Script) is at the top of `assets/site.js`.

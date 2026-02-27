# ADENIRAN OLUWANIFEMI — Portfolio

Avant-garde scattered-layout portfolio powered by Cloudinary cloud storage.

---

## 🚀 SETUP GUIDE (10 minutes)

### Step 1: Create a Cloudinary Account (FREE)

1. Go to **[cloudinary.com](https://cloudinary.com)** and sign up (free tier = 25GB)
2. Once logged in, go to your **Dashboard**
3. Copy your **Cloud Name** (looks like `dxyz123abc`)

### Step 2: Create an Upload Preset

This lets your admin panel upload images without exposing secret keys:

1. In Cloudinary, go to **Settings** → **Upload** tab
2. Scroll down to **Upload presets**
3. Click **Add upload preset**
4. Set these options:
   - **Upload preset name**: `nifemi_portfolio` (or whatever you like)
   - **Signing Mode**: **Unsigned** ← IMPORTANT!
   - **Folder**: `portfolio` (optional, keeps things organized)
   - **Tags**: `portfolio` ← IMPORTANT! This is how your site finds images
5. Click **Save**

### Step 3: Enable the Resource List API

This allows the portfolio to fetch images by tag:

1. In Cloudinary, go to **Settings** → **Security** tab
2. Find **"Resource list"** and make sure it's **enabled**
3. Save

### Step 4: Update Your Code

Open **index.html** and find this line near the top of the `<script>`:
```js
const CLOUD_NAME = 'YOUR_CLOUD_NAME';
```
Replace `YOUR_CLOUD_NAME` with your actual cloud name.

Open **admin.html** and update these lines:
```js
const CLOUD_NAME = 'YOUR_CLOUD_NAME';
const UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET';    // e.g. 'nifemi_portfolio'
const ADMIN_PASSWORD = 'YOUR_PASSWORD_HERE';    // Pick a secret password!
```

### Step 5: Deploy

1. Push your code to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Deploy — done!

---

## 🎨 HOW TO ADD DESIGNS

1. Go to `yoursite.com/admin.html`
2. Enter your admin password
3. Type a project title
4. Drag & drop or select your images
5. Click **Upload to Portfolio**
6. Images appear on your live site within seconds — no redeployment needed!

---

## 📁 File Structure
```
├── index.html     ← Public portfolio (pulls images from Cloudinary)
├── admin.html     ← Secret admin panel (password-protected upload)
└── README.md      ← This file
```

---

## 💡 Tips

- **Image quality**: Upload high-res images — Cloudinary auto-optimizes them
- **Titles**: Add descriptive titles when uploading — they show on hover
- **The scatter**: Images randomly reposition on each page load — this is the art!
- **Admin URL**: Bookmark `yoursite.com/admin.html` — only you know it exists
- **Delete images**: Use the Cloudinary dashboard (cloudinary.com → Media Library) to remove images

---

## 🔒 Security Notes

- The admin password is client-side — it's a basic deterrent, not bank-level security
- Since the upload preset is unsigned, someone could technically upload if they found your cloud name + preset name
- For a personal portfolio this is totally fine — if you want more security later, we can add a serverless API

---

Built with ♠ for Nifemi.

# ADENIRAN OLUWANIFEMI — Portfolio

Avant-garde, scattered-layout portfolio. Designs are randomly positioned across the canvas for that experimental, gallery-wall feel.

---

## 🚀 Deploy (5 minutes)

### 1. Create GitHub Repo
- Go to [github.com/new](https://github.com/new)
- Name it something like `nifemi-portfolio`
- Make it **Public**
- Click **Create repository**

### 2. Push Your Code
```bash
cd /path/to/this/folder
git init
git add .
git commit -m "Initial portfolio"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nifemi-portfolio.git
git push -u origin main
```

### 3. Deploy on Vercel
- Go to [vercel.com](https://vercel.com) and sign in with GitHub
- Click **"Add New Project"**
- Import your `nifemi-portfolio` repo
- Click **Deploy** — that's it!
- Vercel gives you a live URL instantly (e.g. `nifemi-portfolio.vercel.app`)

---

## 🎨 How to Add Your Designs

This is the only thing you'll ever need to do going forward:

### Step 1: Add images to the `/designs` folder
Drop your `.jpg`, `.png`, or `.webp` files in the `designs/` folder.

### Step 2: Update `designs.json`
Open `designs.json` and add your images:

```json
[
  { "file": "my-brand-project.jpg", "title": "Brand Identity — ClientName" },
  { "file": "campaign-poster.png", "title": "Summer Campaign 2025" },
  { "file": "logo-system.jpg", "title": "Logo System — StartupX" }
]
```

- `file` → exact filename (must match what's in the `/designs` folder)
- `title` → shows on hover as a label

### Step 3: Push to GitHub
```bash
git add .
git commit -m "Added new designs"
git push
```

Vercel auto-deploys within ~30 seconds. Done!

---

## 📁 File Structure
```
├── index.html          ← The portfolio site
├── designs.json        ← Your design manifest (edit this!)
├── designs/            ← Your images go here
│   ├── project-01.jpg
│   ├── project-02.png
│   └── ...
└── README.md
```

---

## 💡 Tips
- **Image sizes**: Use high-quality images (1200–2400px wide). They'll be auto-cropped to fit scattered frames.
- **Naming**: Use descriptive filenames like `fintech-rebrand.jpg` not `IMG_4032.jpg`.
- **Scatter behavior**: Images scatter randomly on each page load — this is intentional! It creates a unique gallery experience every visit.
- **Click to expand**: Visitors can click any scattered image to see it full-screen.

---

## ✏️ Customization
All colors, fonts, and content are in `index.html`. Key CSS variables at the top:

```css
--bg: #0a0a0a;       /* Background */
--fg: #e8e4df;        /* Text */
--accent: #c8ff00;    /* Accent (lime green) */
--muted: #5a5651;     /* Subtle text */
```

---

Built with ♠ for Nifemi.
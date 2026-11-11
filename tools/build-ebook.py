"""Build the Our Space e-reader text from the Overleaf source.

Usage:  BOOK_TEXT_KEY=<key from Apps Script> python3 tools/build-ebook.py path/to/main.tex
Needs:  pip install pillow cryptography
"""
import re, json, sys, html
src = open(sys.argv[1], encoding='utf-8').read()
st = re.search(r'^\\begin\{document\}', src, re.M).end(); body = src[st: re.search(r'^\\end\{document\}', src, re.M).start()]
# strip comments (unescaped %)
body = '\n'.join(re.sub(r'(?<!\\)%.*$', '', l) for l in body.split('\n'))

def braced(s, i):
    """s[i] == '{' ; return (content, index after closing brace)"""
    depth = 0
    for j in range(i, len(s)):
        if s[j] == '{': depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0: return s[i+1:j], j+1
    raise ValueError('unbalanced')

def inline(t):
    t = html.escape(t, quote=False)
    out = ''; i = 0
    while i < len(t):
        m = re.match(r'\\(textbf|textit|emph|url|href)\{', t[i:])
        if m:
            arg, j = braced(t, i + len(m.group(0)) - 1)
            cmd = m.group(1)
            if cmd == 'textbf': out += '<strong>' + inline_raw(arg) + '</strong>'
            elif cmd in ('textit', 'emph'): out += '<em>' + inline_raw(arg) + '</em>'
            elif cmd == 'url': out += '<a href="' + arg + '" target="_blank" rel="noopener">' + arg + '</a>'
            i = j; continue
        out += t[i]; i += 1
    out = out.replace('\\\\', '<br>').replace('~', '\u00a0').replace('\\&amp;', '&amp;').replace('\\%', '%').replace('\\$', '$').replace('\\_', '_').replace('\\#', '#')
    out = out.replace('``', '“').replace("''", '”').replace('---', '–').replace('--', '–')
    out = re.sub(r'\\[a-zA-Z]+\*?', '', out)
    out = re.sub(r'\s+', ' ', out).strip()
    return out
def inline_raw(t):  # already escaped
    return inline(html.unescape(t))

blocks = []; chap = 0; pending_img = None
def para_blocks(text, kind='p'):
    for p in re.split(r'\n\s*\n', text):
        p = p.strip()
        if p: blocks.append({'t': kind, 'h': inline(p), 'c': chap})

i = 0; buf = ''
tok = re.compile(r'\\(chapterimage|chapter\*?|section\*?|subsection\*?|makecover)\{|\\begin\{(quote|itemize|enumerate)\}|\\(tableofcontents|cleardoublepage|clearpage|setpagetexture\{[^}]*\}|applypagetexture|newpage)')
while i < len(body):
    m = tok.search(body, i)
    if not m:
        buf += body[i:]; break
    buf += body[i:m.start()]
    para_blocks(buf); buf = ''
    if m.group(1):
        cmd = m.group(1).rstrip('*'); arg, j = braced(body, m.end() - 1); i = j
        if cmd == 'chapterimage': pending_img = arg
        elif cmd == 'chapter':
            chap += 1
            if pending_img: blocks.append({'t': 'img', 'src': pending_img, 'c': chap}); pending_img = None
            blocks.append({'t': 'h1', 'n': chap, 'h': inline(arg), 'c': chap})
        elif cmd == 'section': blocks.append({'t': 'h2', 'h': inline(arg), 'c': chap})
        elif cmd == 'subsection': blocks.append({'t': 'h3', 'h': inline(arg), 'c': chap})
        elif cmd == 'makecover': blocks.append({'t': 'cover', 'src': arg, 'c': chap})
    elif m.group(2):
        env = m.group(2); end = body.index('\\end{' + env + '}', m.end())
        inner = body[m.end():end]; i = end + len('\\end{' + env + '}')
        if env == 'quote':
            txt = inline(inner)
            plain = re.sub('<[^>]+>', '', txt).lstrip('“"\' ')
            kind = 'prayer' if re.match(r'(Prayer)', plain) else 'journal' if re.match(r'Journal', plain) else 'quote'
            blocks.append({'t': 'q', 'k': kind, 'h': txt, 'c': chap})
        else:
            items = [inline(x) for x in re.split(r'\\item', inner)[1:]]
            blocks.append({'t': 'ol' if env == 'enumerate' else 'ul', 'items': [x for x in items if x], 'c': chap})
    else:
        i = m.end()
para_blocks(buf)
book = {'title': 'Our Space', 'subtitle': 'Building a Godly Long Distance Relationship', 'author': 'Adeniran Oluwanifemi', 'blocks': blocks}

# tidy prayer / journal boxes, export chapter images
import os, base64, secrets
from PIL import Image
srcdir = os.path.dirname(os.path.abspath(sys.argv[1])) + '/'
site = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
for b in blocks:
    if b['t'] == 'q':
        h = re.sub(r'^<em>(.*)</em>$', r'\1', b['h'].strip()).strip().lstrip('“"').rstrip('”"').strip()
        m = re.match(r'(Prayer Point|Prayer|Journal Prompt|Journal)\s*:\s*', h)
        if m: b['l'] = m.group(1); h = h[m.end():]
        b['h'] = h[:1].upper() + h[1:]
    if b['t'] in ('img', 'cover'):
        name = os.path.splitext(os.path.basename(b['src']))[0] + '.jpg'
        out = os.path.join(site, 'images', 'book', name); os.makedirs(os.path.dirname(out), exist_ok=True)
        im = Image.open(srcdir + b['src']).convert('RGB'); im.thumbnail((1000, 1420)); im.save(out, quality=80, optimize=True, progressive=True)
        b['src'] = '/images/book/' + name; b['w'], b['h2'] = im.size

# encrypt with the key stored in Apps Script (BOOK_TEXT_KEY)
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
key = base64.b64decode(os.environ['BOOK_TEXT_KEY'])
iv = secrets.token_bytes(12)
ct = AESGCM(key).encrypt(iv, json.dumps(book, ensure_ascii=False).encode('utf-8'), None)
open(os.path.join(site, 'assets', 'book', 'our-space.bin'), 'wb').write(iv + ct)
print('Encrypted', len(blocks), 'blocks. Bump ?v= on BOOK_URL in assets/ereader.js so readers get the new text.')

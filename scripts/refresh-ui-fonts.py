"""Download pinned, self-hosted UI fonts. Normal builds use the included files."""
import hashlib
import json
import re
import runpy
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / 'public/fonts/ui'
LICENSES = ROOT / 'docs/licenses'
AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

def download(url):
    with urlopen(Request(url, headers={'User-Agent': AGENT}), timeout=45) as response:
        return response.read()

def refresh():
    FONTS.mkdir(parents=True, exist_ok=True)
    LICENSES.mkdir(parents=True, exist_ok=True)
    names = sorted(set(json.loads((ROOT / 'scripts/ui-icons.json').read_text())))
    symbols = ('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:'
               'opsz,wght,FILL,GRAD@20..48,100..700,0,0&icon_names=' + ','.join(names) + '&display=block')
    text = ('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900'
            '&family=Overpass:ital,wght@0,100..900;1,100..900&display=swap')
    records = {}
    styles = []
    for label, url in [('symbols', symbols), ('text', text)]:
        css = download(url).decode()
        sources = re.findall(r'url\((https://[^)]+)\)', css)
        for source in dict.fromkeys(sources):
            data = download(source)
            suffix = '.woff2' if data[:4] == b'wOF2' else '.woff' if data[:4] == b'wOFF' else '.ttf'
            filename = label + '.' + hashlib.sha256(data).hexdigest()[:16] + suffix
            (FONTS / filename).write_bytes(data)
            records[filename] = {'source': source, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
            css = css.replace(source, '../fonts/ui/' + filename)
        styles.append('/* '+label+' UI font faces, self-hosted from Google Fonts. */\n'+css)
    licenses = {
        'Inter-OFL.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt',
        'Overpass-OFL.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/overpass/OFL.txt',
        'Material-Symbols-APACHE.txt': 'https://raw.githubusercontent.com/google/material-design-icons/master/LICENSE',
    }
    for filename, source in licenses.items():
        (LICENSES / filename).write_bytes(download(source))
    (ROOT / 'public/css/ui-fonts.css').write_text('\n'.join(styles))
    manifest = {'iconNames': names, 'symbolRequest': symbols, 'textRequest': text, 'files': records}
    (ROOT / 'scripts/ui-fonts.json').write_text(json.dumps(manifest, indent=2)+'\n')
    runpy.run_path(str(ROOT / 'scripts/verify-ui-icons.py'), run_name='__main__')
    print(f'Saved {len(records)} UI font files; {len(names)} icon names; {sum(r["bytes"] for r in records.values()):,} bytes total.')

if __name__ == '__main__':
    refresh()

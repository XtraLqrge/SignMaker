"""Verify the actual font ligatures after refreshing the UI font subset.

Optional maintenance dependency: fonttools. Node provides a Brotli fallback.
Normal builds use the checked-in certificate and need only Node.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import types

try:
    import brotli
except ImportError:
    brotli = types.ModuleType('brotli')
    def decompress(data):
        return subprocess.run([
            'node', '-e',
            "process.stdout.write(require('node:zlib').brotliDecompressSync(require('node:fs').readFileSync(0)))"
        ], input=data, capture_output=True, check=True).stdout
    brotli.decompress = decompress
    sys.modules['brotli'] = brotli

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent

def verify():
    manifest = json.loads((ROOT / 'scripts/ui-fonts.json').read_text())
    filenames = [name for name in manifest['files'] if name.startswith('symbols.')]
    if len(filenames) != 1:
        raise ValueError('Expected exactly one Material Symbols font')
    filename = filenames[0]
    file = ROOT / 'public/fonts/ui' / filename
    font = TTFont(file)
    characters = {glyph: chr(code) for code, glyph in font.getBestCmap().items() if code < 128}
    ligatures = set()
    for lookup in font['GSUB'].table.LookupList.Lookup:
        for table in lookup.SubTable:
            while hasattr(table, 'ExtSubTable'):
                table = table.ExtSubTable
            for first, entries in getattr(table, 'ligatures', {}).items():
                for entry in entries:
                    components = [first, *entry.Component]
                    if all(glyph in characters for glyph in components):
                        ligatures.add(''.join(characters[glyph] for glyph in components))
    missing = set(manifest['iconNames']) - ligatures
    if missing:
        raise ValueError('Font is missing requested icons: ' + ', '.join(sorted(missing)))
    data = file.read_bytes()
    certificate = {
        'file': filename,
        'sha256': hashlib.sha256(data).hexdigest(),
        'bytes': len(data),
        'glyphCount': len(font.getGlyphOrder()),
        'verifiedIconNames': sorted(ligatures),
        'axes': [{'tag': axis.axisTag, 'min': axis.minValue, 'max': axis.maxValue}
                 for axis in font['fvar'].axes],
    }
    (ROOT / 'scripts/ui-icon-coverage.json').write_text(json.dumps(certificate, indent=2)+'\n')
    print(f'Verified all {len(manifest["iconNames"])} requested icons in {len(data):,} bytes.')
    return certificate

if __name__ == '__main__':
    verify()

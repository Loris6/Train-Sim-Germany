#!/usr/bin/env python3
"""Baut die Flaticon-UIcons für die Seite.

Durchsucht index.html und assets/js/*.js nach Icon-Klassen wie fi-rr-home,
fi-sr-star oder fi-brands-discord, schneidet die UIcons-Schriften auf genau
diese Icons zu und schreibt:

  assets/css/uicons.css
  assets/fonts/uicons-*.woff2

Neues Icon: Namen auf https://www.flaticon.com/uicons suchen, die Klasse im
HTML/JS verwenden (z. B. <i class="fi fi-rr-ticket ic"></i>) und dieses Skript
erneut ausführen.

Voraussetzungen:
  npm install --no-save @flaticon/flaticon-uicons
  pip install fonttools brotli

Aufruf:
  python3 tools/build_icons.py [Pfad/zu/@flaticon/flaticon-uicons/css]
"""
import pathlib
import re
import sys

from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
PKG = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'node_modules/@flaticon/flaticon-uicons/css'

# Kürzel -> (CSS-Datei im Paket, Schriftfamilie)
STYLES = {
    'rr': ('regular/rounded.css', 'uicons-regular-rounded'),
    'sr': ('solid/rounded.css', 'uicons-solid-rounded'),
    'brands': ('brands/all.css', 'uicons-brands'),
}


def main():
    if not PKG.is_dir():
        sys.exit(f'UIcons-Paket nicht gefunden: {PKG}\nZuerst: npm install --no-save @flaticon/flaticon-uicons')

    used = {style: set() for style in STYLES}
    for path in [ROOT / 'index.html', *sorted((ROOT / 'assets/js').glob('*.js'))]:
        for style, name in re.findall(r'fi-(rr|sr|brands)-([a-z0-9]+(?:-[a-z0-9]+)*)', path.read_text(encoding='utf-8')):
            used[style].add(name)

    blocks = ['/* Flaticon UIcons (https://www.flaticon.com/uicons) – nur die genutzten Icons.\n'
              '   Automatisch erzeugt mit tools/build_icons.py, nicht von Hand bearbeiten. */']
    for style, names in used.items():
        if not names:
            continue
        css_file, family = STYLES[style]
        css = (PKG / css_file).read_text(encoding='utf-8')
        font = next(PKG.glob(f'{family}-*.woff2'))

        rules, codes = [], []
        for name in sorted(names):
            m = re.search(r'\.fi-%s-%s:before\{content:"\\([0-9a-f]+)"\}' % (style, re.escape(name)), css)
            if not m:
                sys.exit(f'Icon nicht gefunden: fi-{style}-{name}')
            codes.append(int(m.group(1), 16))
            rules.append(f'.fi-{style}-{name}:before{{content:"\\{m.group(1)}"}}')
        base = re.search(r'i\[class\^=fi-%s-\]:before[^{]*\{[^}]*\}' % style, css).group(0)

        out_font = ROOT / 'assets/fonts' / f'{family}.woff2'
        options = subset.Options()
        options.flavor = 'woff2'
        options.layout_features = ['*']
        ttf = subset.load_font(str(font), options)
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=codes)
        subsetter.subset(ttf)
        subset.save_font(ttf, str(out_font), options)

        blocks.append(
            f'@font-face{{font-family:{family};src:url(../fonts/{family}.woff2) format("woff2");font-display:block}}\n'
            + base + '\n' + '\n'.join(rules)
        )
        print(f'{family}: {len(names)} Icons, {out_font.stat().st_size / 1024:.1f} KB')

    (ROOT / 'assets/css/uicons.css').write_text('\n\n'.join(blocks) + '\n', encoding='utf-8')
    print('assets/css/uicons.css geschrieben')


if __name__ == '__main__':
    main()

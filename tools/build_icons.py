"""Train Sim Germany – Symbol-Schriften bauen

Symbole: Phosphor Icons (https://phosphoricons.com, MIT) in zwei Stärken, Marken: Simple Icons
(https://simpleicons.org, CC0). Das Skript durchsucht alle .html-Seiten, assets/js/*.js und backend/*.js (Knöpfe der Bots)
nach den Klassen

    ph-<name>    Phosphor „regular“ (Linien)     z. B. ph-house, ph-train-regional
    phf-<name>   Phosphor „fill“ (gefüllt)       z. B. phf-play, phf-bell-ringing
    si-<name>    Simple Icons (Marken)           z. B. si-discord, si-roblox

und schreibt daraus kleine Schriften mit genau diesen Symbolen nach assets/fonts/ und die Klassen nach
assets/css/icons.css.

Benutzung (einmalig die Pakete holen):

    npm install --prefix /tmp/icons @phosphor-icons/web simple-icons-font
    python3 tools/build_icons.py /tmp/icons/node_modules

Braucht fontTools (pip install fonttools brotli).
"""
import pathlib
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODS = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'node_modules'
FAMILIES = {
    'ph': ('TSG Phosphor', MODS / '@phosphor-icons/web/src/regular/style.css', r'\.ph\.ph-([a-z0-9-]+):before', MODS / '@phosphor-icons/web/src/regular/Phosphor.woff2', 'phosphor-regular'),
    'phf': ('TSG Phosphor Fill', MODS / '@phosphor-icons/web/src/fill/style.css', r'\.ph-fill\.ph-([a-z0-9-]+):before', MODS / '@phosphor-icons/web/src/fill/Phosphor-Fill.woff2', 'phosphor-fill'),
    'si': ('TSG Brands', MODS / 'simple-icons-font/font/simple-icons.css', r'\.si-([a-z0-9-]+)::before', MODS / 'simple-icons-font/font/SimpleIcons.woff2', 'simple-icons'),
}
USE = re.compile(r'(?<![\w-])(ph|phf|si)-([a-z0-9]+(?:-[a-z0-9]+)*)')


def codepoints(css, pattern):
    text = css.read_text()
    out = {}
    for m in re.finditer(pattern + r'\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"', text):
        out.setdefault(m.group(1), int(m.group(2), 16))
    return out


def main():
    used = {k: set() for k in FAMILIES}
    files = [*sorted(ROOT.glob('*.html')), *sorted((ROOT / 'assets/js').glob('*.js')), *sorted((ROOT / 'backend').glob('*.js'))]
    for path in files:
        for prefix, name in USE.findall(path.read_text()):
            used[prefix].add(name)
    css = ['/* Symbole: Phosphor Icons (MIT, phosphoricons.com) und Simple Icons (CC0, simpleicons.org) – erzeugt von tools/build_icons.py */']
    missing = []
    for prefix, (family, css_path, pattern, font_path, out_name) in FAMILIES.items():
        names = sorted(used[prefix])
        if not names:
            continue
        cps = codepoints(css_path, pattern)
        for n in names:
            if n not in cps:
                missing.append(f'{prefix}-{n}')
        names = [n for n in names if n in cps]
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = []
        opts.notdef_outline = True
        opts.name_IDs = ['*']
        font = subset.load_font(str(font_path), opts)
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=[cps[n] for n in names])
        sub.subset(font)
        out = ROOT / 'assets/fonts' / f'{out_name}.woff2'
        subset.save_font(font, str(out), opts)
        css.append(f'@font-face{{font-family:"{family}";src:url("../fonts/{out_name}.woff2") format("woff2");font-weight:normal;font-style:normal;font-display:block}}')
        css.append(','.join(f'.{prefix}-{n}' for n in names) + f'{{font-family:"{family}"!important}}')
        css.extend(f'.{prefix}-{n}:before{{content:"\\{cps[n]:x}"}}' for n in names)
        print(f'{family}: {len(names)} Symbole, {out.stat().st_size / 1024:.1f} KB')
    css.insert(1, '.i{display:inline-block;font-style:normal;font-weight:normal;font-variant:normal;line-height:1;text-transform:none;speak:never;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}')
    (ROOT / 'assets/css/icons.css').write_text('\n'.join(css) + '\n')
    print('assets/css/icons.css geschrieben')
    if missing:
        print('Nicht gefunden:', ', '.join(missing))
        sys.exit(1)


if __name__ == '__main__':
    main()

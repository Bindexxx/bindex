#!/usr/bin/env python3
"""Prepara il sito per la pubblicazione su GitHub Pages (V6, 2026-10-12).

Lo usa la GitHub Action .github/workflows/pubblica-sito.yml a ogni push su main:

  1. copia il repository nella cartella di uscita (senza .git, .github, tools);
  2. in ogni pagina .html aggiunge ?v=<impronta del contenuto> a ogni
     <script src="..."> e <link href="..."> che punta a un file del sito.
     Un file cambiato ha un indirizzo nuovo: il browser lo riscarica subito,
     invece di tenerne una copia vecchia fino a 10 minuti (cache di GitHub
     Pages) mescolata ai file nuovi — causa di pagine rotte subito dopo un
     aggiornamento. I file non cambiati restano in cache;
  3. scrive in sw.js la versione del sito (impronta di tutti i file), così il
     service worker sa che c'è una versione nuova e butta la cache vecchia.

I file nel repository NON vengono toccati: le versioni esistono solo nella
copia pubblicata. Uso: python3 tools/versiona_file.py <cartella_uscita>
"""
import hashlib
import os
import re
import shutil
import sys

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESCLUSI_IN_RADICE = {'.git', '.github', 'tools', 'node_modules'}
TAG = re.compile(r'(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"]+)(")', re.IGNORECASE)
SEGNAPOSTO_SW = '__VERSIONE_SITO__'


def impronta(percorso):
    with open(percorso, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:10]


def indirizzo_locale(url):
    u = url.strip()
    return bool(u) and not re.match(r'^([a-z][a-z0-9+.-]*:|//|#)', u, re.IGNORECASE)


def main():
    if len(sys.argv) != 2:
        sys.exit('uso: python3 tools/versiona_file.py <cartella_uscita>')
    uscita = os.path.abspath(sys.argv[1])
    # Mai la radice del repo o una cartella che la contiene (verrebbe cancellata).
    # Una sottocartella diretta (es. _site) va bene: è esclusa dalla copia.
    if uscita == RADICE or RADICE.startswith(uscita + os.sep):
        sys.exit('cartella di uscita non valida: ' + uscita)
    if os.path.exists(uscita):
        shutil.rmtree(uscita)
    nome_uscita = os.path.basename(uscita)

    def ignora(cartella, nomi):
        if os.path.abspath(cartella) == RADICE:
            return [n for n in nomi if n in ESCLUSI_IN_RADICE or n == nome_uscita]
        return []

    shutil.copytree(RADICE, uscita, ignore=ignora)

    impronte_sito = []
    pagine = []
    for cartella, _, file in os.walk(uscita):
        for nome in sorted(file):
            percorso = os.path.join(cartella, nome)
            if nome != 'sw.js':
                impronte_sito.append(os.path.relpath(percorso, uscita) + ':' + impronta(percorso))
            if nome.lower().endswith('.html'):
                pagine.append(percorso)

    totale = 0
    for pagina in sorted(pagine):
        with open(pagina, encoding='utf-8') as f:
            testo = f.read()
        base = os.path.dirname(pagina)
        mancanti = []

        def sostituisci(m):
            nonlocal totale
            url = m.group(2)
            if not indirizzo_locale(url):
                return m.group(0)
            pulito = url.split('#')[0].split('?')[0]
            file_vero = os.path.normpath(os.path.join(base, pulito))
            if not file_vero.startswith(uscita) or not os.path.isfile(file_vero):
                mancanti.append(url)
                return m.group(0)
            totale += 1
            return m.group(1) + pulito + '?v=' + impronta(file_vero) + m.group(3)

        nuovo = TAG.sub(sostituisci, testo)
        with open(pagina, 'w', encoding='utf-8') as f:
            f.write(nuovo)
        rel = os.path.relpath(pagina, uscita)
        print(f'{rel}: versioni aggiunte' + (f' — file non trovati (lasciati com\'erano): {mancanti}' if mancanti else ''))

    versione = hashlib.sha256('\n'.join(sorted(impronte_sito)).encode()).hexdigest()[:12]
    sw = os.path.join(uscita, 'sw.js')
    if os.path.isfile(sw):
        with open(sw, encoding='utf-8') as f:
            testo = f.read()
        if SEGNAPOSTO_SW not in testo:
            sys.exit('sw.js: segnaposto della versione non trovato')
        with open(sw, 'w', encoding='utf-8') as f:
            f.write(testo.replace(SEGNAPOSTO_SW, versione))
    print(f'riferimenti versionati: {totale}; versione del sito (sw.js): {versione}')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Backup settimanale di Bindex (S2, 2026-10-12): scarica i file dei bucket Storage.

Uso:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 scarica_storage.py CARTELLA bucket1 bucket2 ...

Per ogni bucket scarica TUTTI i file (anche nelle sottocartelle) in
CARTELLA/<bucket>/<percorso> e scrive CARTELLA/manifest.json con la
configurazione dei bucket e l'elenco dei file (percorso, dimensione, tipo):
serve a ripristina_storage.py. Solo libreria standard di Python.

Non stampa mai nomi di file né contenuti (i log delle Actions li vede chi ha
accesso al repository): solo conteggi per bucket. Esce con errore se anche un
solo file non si scarica, così la Action fallisce e GitHub manda l'email.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
CHIAVE = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
PAGINA = 1000


def _richiesta(metodo, percorso, corpo=None, tentativi=4):
    dati = json.dumps(corpo).encode('utf-8') if corpo is not None else None
    intestazioni = {'Authorization': 'Bearer ' + CHIAVE, 'apikey': CHIAVE}
    if dati is not None:
        intestazioni['Content-Type'] = 'application/json'
    for tentativo in range(tentativi):
        req = urllib.request.Request(URL + percorso, data=dati, method=metodo, headers=intestazioni)
        try:
            with urllib.request.urlopen(req, timeout=120) as risposta:
                return risposta.read()
        except urllib.error.HTTPError as e:
            if e.code < 500 and e.code != 429:
                raise
            if tentativo == tentativi - 1:
                raise
        except urllib.error.URLError:
            if tentativo == tentativi - 1:
                raise
        time.sleep(3 * (tentativo + 1))
    return b''


def _percorso_sicuro(percorso):
    parti = percorso.split('/')
    return bool(percorso) and not percorso.startswith('/') and all(p not in ('', '.', '..') for p in parti)


def elenca(bucket, cartella=''):
    """Tutti i file del bucket sotto 'cartella' (ricorsivo)."""
    trovati = []
    offset = 0
    while True:
        voci = json.loads(_richiesta('POST', '/storage/v1/object/list/' + urllib.parse.quote(bucket, safe=''), {
            'prefix': cartella, 'limit': PAGINA, 'offset': offset,
            'sortBy': {'column': 'name', 'order': 'asc'},
        }) or b'[]')
        for voce in voci:
            nome = voce.get('name') or ''
            percorso = (cartella + '/' + nome) if cartella else nome
            if voce.get('id') is None:          # cartella: si scende
                trovati.extend(elenca(bucket, percorso))
            else:
                meta = voce.get('metadata') or {}
                trovati.append({'path': percorso, 'size': meta.get('size'), 'mimetype': meta.get('mimetype')})
        if len(voci) < PAGINA:
            break
        offset += PAGINA
    return trovati


def main():
    if not URL or not CHIAVE or len(sys.argv) < 3:
        print('uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... scarica_storage.py CARTELLA bucket...', file=sys.stderr)
        return 2
    cartella_uscita = sys.argv[1]
    bucket_scelti = sys.argv[2:]
    os.makedirs(cartella_uscita, exist_ok=True)

    tutti = {b.get('id'): b for b in json.loads(_richiesta('GET', '/storage/v1/bucket') or b'[]')}
    manifest = {'creato_il': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'bucket': {}}
    errori = 0
    for bucket in bucket_scelti:
        info = tutti.get(bucket)
        if info is None:
            print(f'{bucket}: non esiste nel progetto, saltato')
            continue
        file = elenca(bucket)
        scaricati = 0
        byte = 0
        for f in file:
            if not _percorso_sicuro(f['path']):
                errori += 1
                continue
            destinazione = os.path.join(cartella_uscita, bucket, *f['path'].split('/'))
            os.makedirs(os.path.dirname(destinazione), exist_ok=True)
            try:
                contenuto = _richiesta('GET', '/storage/v1/object/' + urllib.parse.quote(bucket, safe='') + '/' + urllib.parse.quote(f['path'], safe='/'))
                with open(destinazione, 'wb') as uscita:
                    uscita.write(contenuto)
                scaricati += 1
                byte += len(contenuto)
            except Exception:                    # niente nome del file nei log
                errori += 1
        manifest['bucket'][bucket] = {
            'public': info.get('public'),
            'file_size_limit': info.get('file_size_limit'),
            'allowed_mime_types': info.get('allowed_mime_types'),
            'file': file,
        }
        print(f'{bucket}: {scaricati}/{len(file)} file, {round(byte / 1048576, 2)} MB')

    with open(os.path.join(cartella_uscita, 'manifest.json'), 'w', encoding='utf-8') as uscita:
        json.dump(manifest, uscita, ensure_ascii=False, indent=1)
    if errori:
        print(f'ERRORI: {errori} file non scaricati', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

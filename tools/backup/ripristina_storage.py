#!/usr/bin/env python3
"""Backup di Bindex: rimette i file dei bucket in un progetto Supabase (ripristino).

Uso:  SUPABASE_URL=https://<progetto>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \\
      python3 ripristina_storage.py CARTELLA_STORAGE [bucket ...]

CARTELLA_STORAGE è la cartella "storage" estratta dall'archivio del backup
(contiene manifest.json). Senza nomi di bucket li rimette tutti. Crea i bucket
che mancano con la stessa configurazione (pubblico/privato, limiti) e carica i
file sovrascrivendo quelli con lo stesso percorso. Le policy di accesso si
rimettono a parte con database/storage_policies.sql (vedi LEGGIMI.txt).
Solo libreria standard di Python.
"""
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
CHIAVE = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')


def _richiesta(metodo, percorso, dati=None, tipo=None, extra=None, tentativi=4):
    intestazioni = {'Authorization': 'Bearer ' + CHIAVE, 'apikey': CHIAVE}
    if tipo:
        intestazioni['Content-Type'] = tipo
    intestazioni.update(extra or {})
    for tentativo in range(tentativi):
        req = urllib.request.Request(URL + percorso, data=dati, method=metodo, headers=intestazioni)
        try:
            with urllib.request.urlopen(req, timeout=120) as risposta:
                return risposta.status, risposta.read()
        except urllib.error.HTTPError as e:
            if e.code < 500 and e.code != 429:
                return e.code, e.read()
            if tentativo == tentativi - 1:
                return e.code, e.read()
        except urllib.error.URLError:
            if tentativo == tentativi - 1:
                raise
        time.sleep(3 * (tentativo + 1))
    return 0, b''


def main():
    if not URL or not CHIAVE or len(sys.argv) < 2:
        print('uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ripristina_storage.py CARTELLA_STORAGE [bucket ...]', file=sys.stderr)
        return 2
    cartella = sys.argv[1]
    with open(os.path.join(cartella, 'manifest.json'), encoding='utf-8') as f:
        manifest = json.load(f)
    scelti = sys.argv[2:] or list(manifest['bucket'].keys())
    errori = 0
    for bucket in scelti:
        info = manifest['bucket'].get(bucket)
        if info is None:
            print(f'{bucket}: non è nel backup, saltato')
            continue
        corpo = {'id': bucket, 'name': bucket, 'public': bool(info.get('public'))}
        if info.get('file_size_limit'):
            corpo['file_size_limit'] = info['file_size_limit']
        if info.get('allowed_mime_types'):
            corpo['allowed_mime_types'] = info['allowed_mime_types']
        stato, _ = _richiesta('POST', '/storage/v1/bucket', json.dumps(corpo).encode('utf-8'), 'application/json')
        if stato not in (200, 201, 400, 409):  # 400/409: esiste già
            print(f'{bucket}: impossibile creare il bucket (HTTP {stato})')
            errori += 1
            continue
        caricati = 0
        for voce in info.get('file', []):
            percorso = voce['path']
            sorgente = os.path.join(cartella, bucket, *percorso.split('/'))
            if not os.path.isfile(sorgente):
                errori += 1
                continue
            with open(sorgente, 'rb') as f:
                contenuto = f.read()
            tipo = voce.get('mimetype') or mimetypes.guess_type(percorso)[0] or 'application/octet-stream'
            stato, _ = _richiesta('POST', '/storage/v1/object/' + urllib.parse.quote(bucket, safe='') + '/' + urllib.parse.quote(percorso, safe='/'),
                                  contenuto, tipo, {'x-upsert': 'true'})
            if stato in (200, 201):
                caricati += 1
            else:
                errori += 1
        print(f'{bucket}: {caricati}/{len(info.get("file", []))} file caricati')
    if errori:
        print(f'ERRORI: {errori}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

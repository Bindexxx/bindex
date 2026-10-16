@echo off
setlocal enabledelayedexpansion

REM ===========================================================================
REM CardSync Pro - Aggiornamento automatico estensione
REM
REM Cosa fa:
REM 1. Cerca da solo la cartella dell'estensione leggendo le impostazioni di
REM    Chrome (dove sono elencate tutte le estensioni caricate "non
REM    pacchettizzate", con il loro percorso reale sul disco)
REM 2. Se non la trova da solo, apre un selettore di cartelle - PRE-COMPILATO
REM    con quella usata l'ultima volta, se c'e' - cosi' basta un click se e'
REM    ancora giusta, o si puo' scegliere al volo quella corretta se no
REM 3. Controlla che la cartella scelta sia sicura da svuotare (vuota, nuova
REM    o con dentro CardSync Pro) - altrimenti si ferma senza toccare nulla
REM 4. Scarica l'ultima versione, la estrae in una cartella temporanea e
REM    controlla che sia davvero CardSync Pro - TUTTO prima di chiudere Chrome:
REM    se qualcosa va storto, Chrome resta aperto e l'estensione intatta
REM 5. Chiude Chrome, sostituisce i file nella cartella dell'estensione e
REM    riavvia Chrome sul sito, cosi' la nuova versione si carica
REM
REM NOTA TECNICA: ogni comando PowerShell un po' complesso viene scritto
REM prima in un file .ps1 temporaneo ed eseguito da li' (invece di essere
REM incorporato direttamente come testo in una riga sola) - molto piu'
REM affidabile: le tante virgolette e parentesi che questi comandi
REM contengono mandavano facilmente in crash l'interprete di Windows se
REM scritte tutte su una riga dentro il .bat.
REM
REM IMPORTANTE: chiude TUTTE le finestre di Chrome aperte per completare
REM l'aggiornamento - salva il tuo lavoro prima di avviarlo.
REM ===========================================================================

set "URL_ZIP=https://bindexxx.github.io/bindex/releases/cardsync-extension.zip"
set "CONFIG_DIR=%APPDATA%\CardSyncPro"
set "CONFIG_FILE=%CONFIG_DIR%\cartella_estensione.txt"
set "TEMP_ZIP=%TEMP%\cardsync-extension-update.zip"
set "PS_RILEVA=%TEMP%\cardsync_rileva_cartella.ps1"
set "PS_SCEGLI=%TEMP%\cardsync_scegli_cartella.ps1"
set "PS_CONTROLLA=%TEMP%\cardsync_controlla_cartella.ps1"
set "PS_VERIFICA=%TEMP%\cardsync_verifica_zip.ps1"
set "PS_INSTALLA=%TEMP%\cardsync_installa.ps1"
set "TEMP_ESTRATTA=%TEMP%\cardsync-nuova-versione"
REM v5.29: elenco di TUTTE le cartelle da aggiornare (una per riga, UTF-8),
REM scritto e letto solo dai comandi PowerShell qui sotto.
set "LISTA_CARTELLE=%TEMP%\cardsync_cartelle_da_aggiornare.txt"
set "URL_SITO=https://bindexxx.github.io/bindex/"
set "RILEVATA_DA_CHROME=0"

echo.
echo ================================================
echo CardSync Pro - Aggiornamento estensione
echo ================================================
echo.

if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%" >nul 2>&1

REM --- Passo 1: prova a rilevarla da solo dalle impostazioni di Chrome ------
echo Cerco la cartella dell'estensione nelle impostazioni di Chrome...

> "%PS_RILEVA%" echo $basi = @("$env:LOCALAPPDATA\Google\Chrome\User Data")
>> "%PS_RILEVA%" echo $trovate = @()
>> "%PS_RILEVA%" echo foreach ($base in $basi) {
>> "%PS_RILEVA%" echo     if (-not (Test-Path $base)) { continue }
>> "%PS_RILEVA%" echo     Get-ChildItem $base -Directory -ErrorAction SilentlyContinue ^| Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile *' } ^| ForEach-Object {
>> "%PS_RILEVA%" echo         $pref = Join-Path $_.FullName 'Preferences'
>> "%PS_RILEVA%" echo         if (-not (Test-Path $pref)) { $pref = Join-Path $_.FullName 'Secure Preferences' }
>> "%PS_RILEVA%" echo         if (Test-Path $pref) {
>> "%PS_RILEVA%" echo             try {
>> "%PS_RILEVA%" echo                 $json = Get-Content $pref -Raw -ErrorAction Stop ^| ConvertFrom-Json
>> "%PS_RILEVA%" echo                 $json.extensions.settings.PSObject.Properties ^| ForEach-Object {
>> "%PS_RILEVA%" echo                     $m = $_.Value.manifest
>> "%PS_RILEVA%" echo                     $p = $_.Value.path
>> "%PS_RILEVA%" echo                     if ($m -and $m.name -eq 'CardSync Pro' -and $p -and (Test-Path (Join-Path $p 'manifest.json'))) { $trovate += $p }
>> "%PS_RILEVA%" echo                 }
>> "%PS_RILEVA%" echo             } catch {}
>> "%PS_RILEVA%" echo         }
>> "%PS_RILEVA%" echo     }
>> "%PS_RILEVA%" echo }
>> "%PS_RILEVA%" echo $uniche = @($trovate ^| Sort-Object -Unique)
>> "%PS_RILEVA%" echo Set-Content -LiteralPath $env:LISTA_CARTELLE -Value $uniche -Encoding UTF8
>> "%PS_RILEVA%" echo $uniche ^| ForEach-Object { Write-Output $_ }

REM FIX v5.29 (bug [23], completato): con CardSync Pro caricata in piu'
REM profili Chrome (o da piu' cartelle) prima si aggiornava SOLO l'ultima
REM cartella trovata, con un avviso; le altre restavano alla versione
REM vecchia e continuavano a lavorare (successo il 2026-10-16: una copia
REM ferma alla 5.20, senza l'interruttore "Lavora anche a estensione
REM chiusa", lavorava la coda a Chrome chiuso sull'app). Ora si aggiornano
REM TUTTE le cartelle trovate (elenco in LISTA_CARTELLE, senza doppioni).
if exist "%LISTA_CARTELLE%" del "%LISTA_CARTELLE%" >nul 2>&1
set "CARTELLA_ESTENSIONE="
set "CARTELLA_ESTENSIONE_CONTEGGIO=0"
for /f "usebackq delims=" %%F in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_RILEVA%"`) do (
    set "CARTELLA_ESTENSIONE=%%F"
    set /a CARTELLA_ESTENSIONE_CONTEGGIO+=1
)
del "%PS_RILEVA%" >nul 2>&1

if defined CARTELLA_ESTENSIONE goto :trovata_automaticamente
goto :non_trovata_automaticamente

:trovata_automaticamente
if %CARTELLA_ESTENSIONE_CONTEGGIO% GTR 1 (
    echo Trovate %CARTELLA_ESTENSIONE_CONTEGGIO% copie di CardSync Pro in Chrome - le aggiorno TUTTE:
) else (
    echo Trovata automaticamente:
)
for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "Get-Content -LiteralPath $env:LISTA_CARTELLE -Encoding UTF8"`) do echo   - %%F
echo !CARTELLA_ESTENSIONE!>"%CONFIG_FILE%"
set "RILEVATA_DA_CHROME=1"
echo.
goto :cartella_pronta

:non_trovata_automaticamente
echo Non trovata automaticamente.
echo.

REM --- Passo 1b: legge quella salvata da una volta precedente (se c'e') -----
set "CARTELLA_RICORDATA="
if exist "%CONFIG_FILE%" (
    for /f "usebackq delims=" %%L in ("%CONFIG_FILE%") do set "CARTELLA_RICORDATA=%%L"
)

REM --- Passo 1c: selettore di cartelle, PRE-COMPILATO con quella ricordata --
REM (se c'e') - molto piu' sicuro di un semplice si'/no testuale: si VEDE la
REM cartella evidenziata nella finestra vera di Windows, un click se e'
REM giusta, oppure la si cambia al volo navigando altrove.
echo Si apre una finestra per scegliere la cartella dell'estensione.
if defined CARTELLA_RICORDATA (
    echo Sara' gia' aperta su quella usata l'ultima volta - controllala,
    echo un click su "Seleziona cartella" se e' giusta, o naviga altrove se no.
) else (
    echo Naviga fino alla cartella con manifest.json dentro - o, se e' la
    echo primissima volta, scegli dove vuoi che venga installata.
)
echo.

> "%PS_SCEGLI%" echo Add-Type -AssemblyName System.Windows.Forms
>> "%PS_SCEGLI%" echo $f = New-Object System.Windows.Forms.FolderBrowserDialog
>> "%PS_SCEGLI%" echo $f.Description = 'Seleziona la cartella dell''estensione CardSync Pro'
if defined CARTELLA_RICORDATA (
    >> "%PS_SCEGLI%" echo $f.SelectedPath = "!CARTELLA_RICORDATA!"
)
>> "%PS_SCEGLI%" echo if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }

set "CARTELLA_ESTENSIONE="
for /f "usebackq delims=" %%F in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCEGLI%"`) do (
    set "CARTELLA_ESTENSIONE=%%F"
)
del "%PS_SCEGLI%" >nul 2>&1

if not defined CARTELLA_ESTENSIONE (
    echo Nessuna cartella selezionata - annullato.
    pause
    exit /b 1
)

echo !CARTELLA_ESTENSIONE!>"%CONFIG_FILE%"
echo Cartella salvata per le prossime volte: !CARTELLA_ESTENSIONE!
echo.
REM v5.29: anche la cartella scelta a mano passa dall'elenco, come quelle
REM trovate da Chrome (stessi controlli e stessa installazione piu' sotto).
powershell -NoProfile -Command "Set-Content -LiteralPath $env:LISTA_CARTELLE -Value $env:CARTELLA_ESTENSIONE -Encoding UTF8"

:cartella_pronta

REM Non blocca piu' se manifest.json non c'e' ancora - per la primissima
REM installazione e' normale che la cartella sia vuota o nuova: la si
REM installa li', semplicemente.
REM
REM NOTA (v5.17): i percorsi passano ai comandi PowerShell come variabili
REM d'ambiente ($env:CARTELLA_ESTENSIONE, $env:TEMP_ZIP, ...) e non scritti
REM tra apici nel comando: un apostrofo nel percorso (es. C:\Users\D'Amico)
REM rompeva il comando. -LiteralPath evita che [ ] nel nome vengano letti
REM come caratteri jolly.

REM --- Passo 1d: la cartella scelta e' sicura da svuotare? -------------------
REM FIX v5.17: prima la cartella veniva svuotata SEMPRE e senza guardare cosa
REM conteneva - scegliendo per sbaglio la cartella sbagliata nel selettore
REM (es. Documenti) la si cancellava tutta. Ora si procede solo se e' nuova,
REM vuota, o contiene gia' CardSync Pro (manifest.json con quel nome).
REM v5.29: controlla TUTTE le cartelle dell'elenco; se anche una sola non e'
REM sicura non si tocca nessuna cartella.
> "%PS_CONTROLLA%" echo $nonSicure = @()
>> "%PS_CONTROLLA%" echo foreach ($d in @(Get-Content -LiteralPath $env:LISTA_CARTELLE -Encoding UTF8)) {
>> "%PS_CONTROLLA%" echo     if (-not $d) { continue }
>> "%PS_CONTROLLA%" echo     $ok = $false
>> "%PS_CONTROLLA%" echo     if (-not (Test-Path -LiteralPath $d)) { $ok = $true }
>> "%PS_CONTROLLA%" echo     else {
>> "%PS_CONTROLLA%" echo         $contenuto = @(Get-ChildItem -LiteralPath $d -Force -ErrorAction SilentlyContinue)
>> "%PS_CONTROLLA%" echo         if ($contenuto.Count -eq 0) { $ok = $true }
>> "%PS_CONTROLLA%" echo         else {
>> "%PS_CONTROLLA%" echo             $man = Join-Path $d 'manifest.json'
>> "%PS_CONTROLLA%" echo             if (Test-Path -LiteralPath $man) {
>> "%PS_CONTROLLA%" echo                 try {
>> "%PS_CONTROLLA%" echo                     $m = Get-Content -LiteralPath $man -Raw -Encoding UTF8 ^| ConvertFrom-Json
>> "%PS_CONTROLLA%" echo                     if ($m.name -eq 'CardSync Pro') { $ok = $true }
>> "%PS_CONTROLLA%" echo                 } catch {}
>> "%PS_CONTROLLA%" echo             }
>> "%PS_CONTROLLA%" echo         }
>> "%PS_CONTROLLA%" echo     }
>> "%PS_CONTROLLA%" echo     if (-not $ok) { $nonSicure += $d }
>> "%PS_CONTROLLA%" echo }
>> "%PS_CONTROLLA%" echo if ($nonSicure.Count -eq 0) { Write-Output 'CARTELLA_OK' } else { Write-Output ('CARTELLA_NON_SICURA ' + ($nonSicure -join ' ; ')) }

set "ESITO_CARTELLA="
for /f "usebackq delims=" %%E in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_CONTROLLA%"`) do set "ESITO_CARTELLA=%%E"
del "%PS_CONTROLLA%" >nul 2>&1

if not "!ESITO_CARTELLA!"=="CARTELLA_OK" (
    echo ATTENZIONE: questa cartella non e' vuota e non contiene CardSync Pro:
    echo !ESITO_CARTELLA:~20!
    echo.
    echo Per sicurezza NON la tocco - l'aggiornamento la svuoterebbe tutta.
    echo Rilancia il comando e scegli la cartella con dentro manifest.json di
    echo CardSync Pro, oppure una cartella nuova e vuota per installarla.
    del "%CONFIG_FILE%" >nul 2>&1
    pause
    exit /b 1
)

REM --- Passo 2: scarica e controlla la nuova versione (Chrome resta aperto) -
REM FIX v5.17: prima Chrome veniva chiuso e la cartella svuotata PRIMA di
REM sapere se lo zip fosse valido - uno zip rovinato lasciava l'estensione
REM vuota. Ora si scarica, si estrae in una cartella temporanea e si
REM controlla il manifest: solo se e' tutto a posto si chiude Chrome. Lo zip
REM di un giro precedente interrotto viene cancellato prima, cosi' un
REM download fallito non passa per buono.
echo Scarico l'ultima versione...
if exist "%TEMP_ZIP%" del "%TEMP_ZIP%" >nul 2>&1
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri $env:URL_ZIP -OutFile $env:TEMP_ZIP -UseBasicParsing } catch { Write-Output 'ERRORE_DOWNLOAD'; exit 1 }"

if not exist "%TEMP_ZIP%" (
    echo Download fallito - controlla la connessione e riprova.
    echo Chrome e l'estensione non sono stati toccati.
    pause
    exit /b 1
)

> "%PS_VERIFICA%" echo try {
>> "%PS_VERIFICA%" echo     $tmp = $env:TEMP_ESTRATTA
>> "%PS_VERIFICA%" echo     if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction Stop }
>> "%PS_VERIFICA%" echo     Expand-Archive -LiteralPath $env:TEMP_ZIP -DestinationPath $tmp -Force -ErrorAction Stop
>> "%PS_VERIFICA%" echo     $man = Join-Path $tmp 'manifest.json'
>> "%PS_VERIFICA%" echo     if (-not (Test-Path -LiteralPath $man)) { Write-Output 'ZIP_NON_VALIDO'; exit 1 }
>> "%PS_VERIFICA%" echo     $m = Get-Content -LiteralPath $man -Raw -Encoding UTF8 -ErrorAction Stop ^| ConvertFrom-Json
>> "%PS_VERIFICA%" echo     if ($m.name -ne 'CardSync Pro') { Write-Output 'ZIP_NON_VALIDO'; exit 1 }
>> "%PS_VERIFICA%" echo     Write-Output ('ZIP_OK ' + $m.version)
>> "%PS_VERIFICA%" echo } catch { Write-Output 'ZIP_NON_VALIDO'; exit 1 }

set "ESITO_ZIP="
for /f "usebackq delims=" %%E in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_VERIFICA%"`) do set "ESITO_ZIP=%%E"
del "%PS_VERIFICA%" >nul 2>&1

if not "!ESITO_ZIP:~0,6!"=="ZIP_OK" (
    echo Il file scaricato non e' valido - riprova tra qualche minuto.
    echo Chrome e l'estensione non sono stati toccati.
    del "%TEMP_ZIP%" >nul 2>&1
    powershell -NoProfile -Command "Remove-Item -LiteralPath $env:TEMP_ESTRATTA -Recurse -Force -ErrorAction SilentlyContinue"
    pause
    exit /b 1
)
echo Fatto: scaricata la versione !ESITO_ZIP:~7!
echo.

REM --- Passo 3: chiude Chrome (con un breve avviso) --------------------------
echo Chiudo Chrome tra 5 secondi per completare l'installazione...
echo (salva subito eventuali lavori in corso in altre schede)
timeout /t 5 >nul
taskkill /IM chrome.exe /T >nul 2>&1
timeout /t 3 >nul
taskkill /F /IM chrome.exe /T >nul 2>&1
timeout /t 2 >nul

REM FIX (2026-10-16): prima non si controllava se Chrome si fosse chiuso
REM davvero. Se restava acceso (es. avviato come amministratore, o un
REM processo che non si lascia chiudere) i file venivano sostituiti con
REM Chrome in funzione: le pagine dell'app si aprivano nuove, ma il motore
REM dell'estensione (service worker) restava quello vecchio fino a una
REM ricarica a mano da chrome://extensions. Ora si installa solo con Chrome
REM chiuso del tutto; altrimenti si chiede di chiuderlo a mano. Fin qui
REM nessun file e' stato toccato: chiudere questa finestra annulla senza danni.
:verifica_chrome_chiuso
tasklist /FI "IMAGENAME eq chrome.exe" 2>nul | find /I "chrome.exe" >nul
if errorlevel 1 goto :chrome_chiuso
echo.
echo Chrome e' ancora aperto e non riesco a chiuderlo da solo.
echo Chiudilo a mano: tutte le finestre, e anche l'icona di Chrome vicino
echo all'orologio se c'e' (tasto destro - Esci). Poi premi un tasto qui.
echo (Per annullare chiudi questa finestra: l'estensione resta com'e'.)
pause >nul
taskkill /F /IM chrome.exe /T >nul 2>&1
timeout /t 2 >nul
goto :verifica_chrome_chiuso
:chrome_chiuso

REM RIMOSSO (era qui un tentativo di evitare il prompt "Ripristina le
REM pagine?" riscrivendo il file di preferenze di Chrome) - causava un
REM problema molto peggiore: Chrome rileva quando le sue preferenze sono
REM state modificate da un programma esterno (protezione anti-manomissione)
REM e puo' resettare varie impostazioni per sicurezza, incluse le estensioni
REM caricate manualmente - "disinstallandole" di fatto al riavvio
REM successivo. Meglio un prompt di ripristino occasionale che perdere
REM l'estensione ogni volta.

REM --- Passo 4: sostituisce i file (crea la cartella se non esiste ancora) ---
REM FIX (bug [13]): svuota la cartella PRIMA di copiare, cosi' un file
REM rimosso/rinominato in una release non resta come "orfano" inutilizzato
REM insieme ai nuovi file. v5.17: arrivati qui la cartella e' gia' stata
REM controllata (Passo 1d) e la nuova versione e' gia' estratta e verificata
REM nella cartella temporanea (Passo 2) - si copia da li'.
echo Installo...
REM v5.29: installa in TUTTE le cartelle dell'elenco.
> "%PS_INSTALLA%" echo try {
>> "%PS_INSTALLA%" echo     $n = 0
>> "%PS_INSTALLA%" echo     foreach ($d in @(Get-Content -LiteralPath $env:LISTA_CARTELLE -Encoding UTF8)) {
>> "%PS_INSTALLA%" echo         if (-not $d) { continue }
>> "%PS_INSTALLA%" echo         [System.IO.Directory]::CreateDirectory($d) ^| Out-Null
>> "%PS_INSTALLA%" echo         Get-ChildItem -LiteralPath $d -Force ^| Remove-Item -Recurse -Force -ErrorAction Stop
>> "%PS_INSTALLA%" echo         Get-ChildItem -LiteralPath $env:TEMP_ESTRATTA -Force ^| Copy-Item -Destination $d -Recurse -Force -ErrorAction Stop
>> "%PS_INSTALLA%" echo         $n++
>> "%PS_INSTALLA%" echo     }
>> "%PS_INSTALLA%" echo     if ($n -eq 0) { Write-Output 'ERRORE nessuna cartella da aggiornare'; exit 1 }
>> "%PS_INSTALLA%" echo     Write-Output ('INSTALLATA ' + $n)
>> "%PS_INSTALLA%" echo } catch { Write-Output ('ERRORE ' + $_.Exception.Message); exit 1 }

set "ESITO_INSTALLA="
for /f "usebackq delims=" %%E in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_INSTALLA%"`) do set "ESITO_INSTALLA=%%E"
del "%PS_INSTALLA%" >nul 2>&1

if not "!ESITO_INSTALLA:~0,10!"=="INSTALLATA" (
    echo.
    echo Installazione NON riuscita: !ESITO_INSTALLA!
    echo Chiudi le finestre che potrebbero usare quei file e rilancia il comando.
    echo Riapro Chrome...
    start "" "chrome" "%URL_SITO%"
    pause
    exit /b 1
)
del "%TEMP_ZIP%" >nul 2>&1
powershell -NoProfile -Command "Remove-Item -LiteralPath $env:TEMP_ESTRATTA -Recurse -Force -ErrorAction SilentlyContinue"
del "%LISTA_CARTELLE%" >nul 2>&1
echo Fatto. Cartelle aggiornate: !ESITO_INSTALLA:~11!
echo.

REM --- Passo 5: riavvia Chrome sul sito --------------------------------------
REM v5.17: tolto --load-extension - Chrome lo ignora dalla versione 137 (vedi
REM annuncio "PSA: Removing --load-extension flag in Chrome branded builds"
REM sul gruppo chromium-extensions). Non serve: le estensioni caricate come
REM "non pacchettizzate" vengono rilette dalla loro cartella a ogni avvio di
REM Chrome, quindi al riavvio parte gia' la versione appena copiata. Chrome
REM riparte sul sito, da dove e' partito l'aggiornamento.
echo Riavvio Chrome...
start "" "chrome" "%URL_SITO%"
echo.
echo ================================================
echo Installazione completata!
echo ================================================
echo.

if "%RILEVATA_DA_CHROME%"=="1" (
    echo Chrome sapeva gia' di questa cartella - nessun altro passo necessario.
    echo.
) else (
    echo ULTIMO PASSO IMPORTANTE - se non l'hai gia' fatto per questa cartella:
    echo Chrome deve "conoscere" questa cartella almeno una volta prima di
    echo poterla usare come estensione. Vai su chrome://extensions, attiva
    echo "Modalita' sviluppatore" in alto a destra se non e' gia' attiva, poi
    echo "Carica estensione non pacchettizzata" e seleziona questa cartella:
    echo !CARTELLA_ESTENSIONE!
    echo.
    echo Se l'avevi gia' fatto in precedenza per questa stessa cartella, puoi
    echo ignorare questo avviso - non serve rifarlo due volte.
    echo.
)

timeout /t 3 >nul
exit /b 0

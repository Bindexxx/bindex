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
REM 3. Scarica l'ultima versione
REM 4. La estrae nella cartella scelta, sovrascrivendo i file vecchi
REM 5. Chiude e riavvia Chrome da solo, cosi' la nuova versione si carica
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
>> "%PS_RILEVA%" echo                     if ($m -and $m.name -eq 'CardSync Pro' -and $p -and (Test-Path (Join-Path $p 'manifest.json'))) { Write-Output $p }
>> "%PS_RILEVA%" echo                 }
>> "%PS_RILEVA%" echo             } catch {}
>> "%PS_RILEVA%" echo         }
>> "%PS_RILEVA%" echo     }
>> "%PS_RILEVA%" echo }

set "CARTELLA_ESTENSIONE="
set "CARTELLA_ESTENSIONE_CONTEGGIO=0"
for /f "usebackq delims=" %%F in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_RILEVA%"`) do (
    set "CARTELLA_ESTENSIONE=%%F"
    set /a CARTELLA_ESTENSIONE_CONTEGGIO+=1
)
del "%PS_RILEVA%" >nul 2>&1

REM FIX (bug [23]): prima, con l'estensione caricata come "non pacchettizzata"
REM su più di un profilo Chrome sulla stessa macchina, il ciclo sopra teneva
REM silenziosamente solo l'ultima cartella rilevata, senza dire che ne
REM esistevano altre. Ora almeno avvisa (non sceglie comunque per te quale
REM usare, resta l'ultima trovata) — caso raro con un solo profilo Chrome.
if %CARTELLA_ESTENSIONE_CONTEGGIO% GTR 1 (
    echo ATTENZIONE: rilevati %CARTELLA_ESTENSIONE_CONTEGGIO% profili Chrome con CardSync Pro caricata.
    echo Verra' aggiornata solo l'ultima rilevata: !CARTELLA_ESTENSIONE!
    echo Se non e' quella giusta, aggiorna manualmente gli altri profili.
    echo.
)

if defined CARTELLA_ESTENSIONE goto :trovata_automaticamente
goto :non_trovata_automaticamente

:trovata_automaticamente
echo Trovata automaticamente: !CARTELLA_ESTENSIONE!
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

:cartella_pronta

REM Non blocca piu' se manifest.json non c'e' ancora - per la primissima
REM installazione e' normale che la cartella sia vuota o nuova: la si
REM installa li', semplicemente.

REM --- Passo 2: scarica l'ultima versione ------------------------------------
echo Scarico l'ultima versione...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%URL_ZIP%' -OutFile '%TEMP_ZIP%' -UseBasicParsing } catch { Write-Output 'ERRORE_DOWNLOAD'; exit 1 }"

if not exist "%TEMP_ZIP%" (
    echo Download fallito - controlla la connessione e riprova.
    pause
    exit /b 1
)
echo Fatto.
echo.

REM --- Passo 3: chiude Chrome (con un breve avviso) --------------------------
echo Chiudo Chrome tra 5 secondi per completare l'installazione...
echo (salva subito eventuali lavori in corso in altre schede)
timeout /t 5 >nul
taskkill /IM chrome.exe /T >nul 2>&1
timeout /t 3 >nul
taskkill /F /IM chrome.exe /T >nul 2>&1
timeout /t 2 >nul

REM RIMOSSO (era qui un tentativo di evitare il prompt "Ripristina le
REM pagine?" riscrivendo il file di preferenze di Chrome) - causava un
REM problema molto peggiore: Chrome rileva quando le sue preferenze sono
REM state modificate da un programma esterno (protezione anti-manomissione)
REM e puo' resettare varie impostazioni per sicurezza, incluse le estensioni
REM caricate manualmente - "disinstallandole" di fatto al riavvio
REM successivo. Meglio un prompt di ripristino occasionale che perdere
REM l'estensione ogni volta.

REM --- Passo 4: estrae (crea la cartella se non esiste ancora) ---------------
echo Installo...
if not exist "!CARTELLA_ESTENSIONE!" mkdir "!CARTELLA_ESTENSIONE!" >nul 2>&1
REM FIX (bug [13]): svuota la cartella PRIMA di estrarre, cosi' un file
REM rimosso/rinominato in una release non resta come "orfano" inutilizzato
REM insieme ai nuovi file (Expand-Archive -Force sovrascrive solo gli
REM omonimi, non cancella quelli che non fanno piu' parte dello zip).
powershell -NoProfile -Command "Remove-Item -Path '!CARTELLA_ESTENSIONE!\*' -Recurse -Force" >nul 2>&1
powershell -NoProfile -Command "Expand-Archive -Path '%TEMP_ZIP%' -DestinationPath '!CARTELLA_ESTENSIONE!' -Force"
del "%TEMP_ZIP%" >nul 2>&1
echo Fatto.
echo.

REM --- Passo 5: riavvia Chrome, forzando il ricaricamento dell'estensione ----
REM FIX (estensione rimasta alla versione vecchia dopo l'aggiornamento):
REM un semplice "start chrome" dopo il taskkill /F si affida al fatto che
REM Chrome "si ricordi" da solo di ricaricare da disco l'estensione non
REM pacchettizzata - non sempre affidabile con una chiusura forzata. Il
REM flag --load-extension e' il modo ufficiale per dire a Chrome "carica
REM (o ricarica) DAVVERO questa cartella come estensione adesso", cosi'
REM il codice nuovo appena estratto viene letto per certo, senza bisogno
REM di cliccare "ricarica" a mano su chrome://extensions.
echo Riavvio Chrome (forzando il ricaricamento dell'estensione)...
start "" "chrome" --load-extension="!CARTELLA_ESTENSIONE!"
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

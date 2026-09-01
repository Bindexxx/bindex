/* ==========================================================================
   CardSync Pocket — Barra di stato + tendina notifiche
   File: statusbar.js   —   versione 5.3

   Avvio minimo:

     CSBar.init({
       onSettings: function () { ... },
       onProfile:  function () { ... },
       onNotificationClick: function (n) { ... }
     });

   Funzioni principali:
     CSBar.setConnection('online' | 'connecting' | 'offline')
     CSBar.avvisa('bustina-pronta')            <- via preferita
     CSBar.notify({ title, text, icon, target })
     CSBar.setCountdown({ label, startedAt, endsAt, actionLabel, onAction })
     CSBar.setTheme('chiaro' | 'scuro' | 'retro')   <- scrive data-tema sul body
     CSBar.setCurrency({ value, glyph, label })
     CSBar.lock() / CSBar.unlock()

   La barra si costruisce da sola: nel tuo HTML non devi incollare markup.
   ========================================================================== */

(function (global) {
  "use strict";

  var doc = global.document;

  /* ---------------------------------------------------------------------
     Stato interno
     --------------------------------------------------------------------- */

  var state = {
    mounted: false,
    open: false,
    locked: false,
    connection: "offline",
    lastSync: null,
    notifications: [],
    quickActions: [],
    settings: { audio: true, vibrazione: true, avvisi: true, suono: "pokeball" },
    countdown: null,
    currency: null,
    queue: [],
    queueBusy: false,
    clockTimer: null,
    countdownTimer: null,
    tickerTimer: null,
    headsTimer: null,
    saveTimer: null,
    currencyTimer: null,
    scrollY: 0,
    lastFocus: null,
    baseTitle: "",
    popOpen: false,
    pending: [],
    flushing: false,
    deferredInstall: null,
    ctaDismissed: {},
    tipTimer: null,
    presence: null,
    presenceTimer: null,
    themeObserver: null
  };

  var opts = {
    onSettings: null,
    onProfile: null,
    onNotificationClick: null,
    onQuickAction: null,
    onSync: null,
    onPresence: null,           // clic sulla pillola delle persone collegate
    quickActions: null,
    notificationTypes: {},
    profileName: "",
    avatarUrl: "",
    persist: true,
    storageKey: "csbar.v1",
    maxNotifications: 40,
    tickerDuration: 4500,
    bannerDuration: 4200,
    titleBadge: true,
    sound: true,
    haptics: true,

    /* installazione come app e avvisi di sistema */
    serviceWorker: null,        // es. "service-worker.js" per attivare la PWA
    installPrompt: true,        // mostra la proposta "Installa l'app"
    systemNotifications: true,  // avvisi anche a sito chiuso
    notificationIcon: null,     // es. "icon-192.png"
    appName: "CardSync Pocket",

    /* tema: la barra segue il tema del progetto */
    themeAttribute: "data-tema", // l'attributo che il tuo progetto usa sul <body>
    persistTheme: false,         // lascia il salvataggio del tema al tuo progetto
    onThemeChange: null,         // richiamata quando il tema cambia (es. accensioneCrt)

    /* coda offline */
    onFlushAction: null,        // function (azione) -> Promise
    watchNetwork: true,         // segue gli eventi online/offline del browser

    /* CardSync Pro (2026-09-01): dove montare la barra. Default invariato
       (document.body, per compatibilità con l'uso originale a schermo
       intero). Passando un elemento o un selettore, la barra si monta lì
       invece che sul body — serve per progetti che, come questo, mostrano
       un mockup di telefono dentro una pagina desktop più grande: la barra
       deve restare dentro lo "schermo" del telefono, non coprire tutta la
       finestra del browser. */
    container: null
  };

  var el = {};

  var drag = {
    active: false,
    pointerId: null,
    startY: 0,
    baseY: 0,
    height: 0,
    moved: false,
    passedThreshold: false,
    samples: []
  };

  var swipe = {
    active: false,
    pointerId: null,
    node: null,
    id: null,
    wrap: null,
    startX: 0,
    startY: 0,
    axis: null,
    dx: 0,
    armed: false,
    bloccata: false,
    dxUltimo: 0,
    soglia: 100,
    blockClick: false
  };

  var headsDrag = {
    active: false,
    pointerId: null,
    startY: 0,
    dy: 0,
    moved: false
  };

  var DEFAULT_QUICK = [
    { id: "audio", label: "Audio", glyph: "\u266a" },
    { id: "vibrazione", label: "Vibrazione", glyph: "\u224b" },
    { id: "avvisi", label: "Avvisi", glyph: "\u25c8" },
    { id: "sincronizza", label: "Sincronizza", glyph: "\u27f3", type: "action" }
  ];

  var CONNECTION_LABEL = {
    online: "Connesso",
    connecting: "Connessione in corso",
    offline: "Connessione assente"
  };

  var ICON_PERSONA =
    '<svg viewBox="0 0 22 24" fill="currentColor" aria-hidden="true">' +
    '<circle cx="11" cy="6.4" r="4.6"/>' +
    '<path d="M11 12.6c-4.4 0-8 2.9-8 6.5V22a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2.9c0-3.6-3.6-6.5-8-6.5z"/>' +
    "</svg>";

  var ICON_GEAR =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="3"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
    "</svg>";

  /* ---------------------------------------------------------------------
     Utilità
     --------------------------------------------------------------------- */

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function formatTime(date) {
    try {
      return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return pad2(date.getHours()) + ":" + pad2(date.getMinutes());
    }
  }

  /* "4h 12m", "12m 30s", "pronta" */
  function formatDuration(ms) {
    if (ms <= 0) return "pronta";
    var totalSec = Math.floor(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    if (h > 0) return h + "h " + pad2(m) + "m";
    if (m > 0) return m + "m " + pad2(s) + "s";
    return s + "s";
  }

  function relativeTime(date) {
    if (!date) return "mai";
    var diff = Date.now() - date.getTime();
    if (diff < 45000) return "adesso";
    if (diff < 3600000) return Math.round(diff / 60000) + " min fa";
    if (diff < 86400000) return Math.round(diff / 3600000) + " h fa";
    return formatTime(date);
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "??";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  /* ev.target non è sempre un elemento (può essere il documento stesso):
     closest() andrebbe in errore. */
  function closestEl(target, selector) {
    if (!target || typeof target.closest !== "function") return null;
    return target.closest(selector);
  }

  function findNotification(id) {
    for (var i = 0; i < state.notifications.length; i++) {
      if (state.notifications[i].id === id) return state.notifications[i];
    }
    return null;
  }

  /* ---------------------------------------------------------------------
     Memoria locale
     --------------------------------------------------------------------- */

  function loadStored() {
    if (!opts.persist) return;
    try {
      var raw = global.localStorage.getItem(opts.storageKey);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && data.settings) {
        for (var k in data.settings) {
          if (Object.prototype.hasOwnProperty.call(data.settings, k)) {
            state.settings[k] = data.settings[k];
          }
        }
      }
      if (data && data.notifications) {
        state.notifications = data.notifications.map(function (n) {
          n.date = new Date(n.date);
          return n;
        });
      }
      if (data && data.lastSync) state.lastSync = new Date(data.lastSync);
      if (data && data.pending) state.pending = data.pending;
      if (data && data.ctaDismissed) state.ctaDismissed = data.ctaDismissed;
    } catch (e) {
      /* memoria non disponibile: si prosegue senza salvataggio */
    }
  }

  function writeNow() {
    if (!opts.persist) return;
    try {
      global.localStorage.setItem(
        opts.storageKey,
        JSON.stringify({
          settings: state.settings,
          lastSync: state.lastSync ? state.lastSync.toISOString() : null,
          pending: state.pending,
          ctaDismissed: state.ctaDismissed,
          notifications: state.notifications.map(function (n) {
            return {
              id: n.id,
              title: n.title,
              text: n.text,
              icon: n.icon,
              target: n.target,
              group: n.group,
              groupLabel: n.groupLabel,
              count: n.count,
              priority: n.priority,
              intervento: n.intervento,
              read: n.read,
              date: n.date.toISOString()
            };
          })
        })
      );
    } catch (e) {
      /* spazio pieno o memoria bloccata: si ignora */
    }
  }

  function save() {
    if (!opts.persist) return;
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(function () {
      state.saveTimer = null;
      writeNow();
    }, 250);
  }

  /* Scrive subito se c'è un salvataggio ancora in attesa. Serve prima di
     chiudere la pagina e prima di rileggere quanto scritto da un'altra
     scheda, per non perdere l'ultima modifica fatta qui. */
  function flushSave() {
    if (!state.saveTimer) return false;
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
    writeNow();
    return true;
  }

  /* ---------------------------------------------------------------------
     Suono e vibrazione
     --------------------------------------------------------------------- */

  var audioCtx = null;
  var customAudio = null;

  /* Suoni disponibili. Ogni nota è [frequenza, ritardo in secondi]. */
  var SOUNDS = {
    pokeball: { label: "Pokeball", wave: "square", gain: 0.05, notes: [[880, 0], [1318, 0.085]] },
    gameboy: { label: "Game Boy", wave: "square", gain: 0.045, notes: [[523, 0], [784, 0.06], [1046, 0.12]] },
    cristallo: { label: "Cristallo", wave: "sine", gain: 0.09, notes: [[1174, 0], [1568, 0.07], [2093, 0.14]] },
    tamburo: { label: "Tamburo", wave: "triangle", gain: 0.11, notes: [[196, 0], [147, 0.05]] },
    nessuno: { label: "Nessuno", wave: "sine", gain: 0, notes: [] }
  };

  var SOUND_ORDER = ["pokeball", "gameboy", "cristallo", "tamburo", "nessuno"];

  function currentSound() {
    return state.settings.suono || "pokeball";
  }

  function soundLabel() {
    var s = currentSound();
    if (SOUNDS[s]) return SOUNDS[s].label;
    return "Personale"; /* è stato indicato un file audio */
  }

  function setSound(name, preview) {
    state.settings.suono = name;
    customAudio = null;
    save();
    if (state.mounted) renderPrefs();
    if (preview) blip(true);
  }

  /* preview = true suona anche quando il tasto Audio è spento,
     per far sentire la scelta al momento della selezione */
  function blip(preview) {
    if (!opts.sound) return;
    if (!preview && !state.settings.audio) return;

    var name = currentSound();
    if (name === "nessuno") return;

    /* file audio personale: qualsiasi nome con un punto o una barra */
    if (!SOUNDS[name]) {
      try {
        if (!customAudio || customAudio.getAttribute("src") !== name) {
          customAudio = new Audio(name);
        }
        customAudio.currentTime = 0;
        var playing = customAudio.play();
        if (playing && typeof playing.catch === "function") playing.catch(function () {});
      } catch (e) {
        /* file non caricabile */
      }
      return;
    }

    var preset = SOUNDS[name];
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      var t0 = audioCtx.currentTime;
      preset.notes.forEach(function (note) {
        var t = t0 + note[1];
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = preset.wave;
        osc.frequency.value = note[0];
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(preset.gain, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
      });
    } catch (e) {
      /* audio non disponibile */
    }
  }

  function buzz(pattern) {
    if (!opts.haptics || !state.settings.vibrazione) return;
    try {
      if (global.navigator && global.navigator.vibrate) {
        global.navigator.vibrate(pattern);
      }
    } catch (e) {
      /* vibrazione non supportata */
    }
  }

  /* ---------------------------------------------------------------------
     Temi

     La barra NON ha una tavolozza propria: segue il tema del progetto,
     cioè l'attributo data-tema sul <body>. Il colore arriva dalle
     variabili CSS del tuo foglio di stile. Qui si tiene solo il colore
     per la barra di sistema del telefono e il pallino nella tendina.
     --------------------------------------------------------------------- */

  var THEMES = {
    chiaro: { label: "Chiaro", campione: "#EAEAE7", chrome: "#EAEAE7" },
    scuro: { label: "Scuro", campione: "#23232A", chrome: "#16161A" },
    retro: { label: "Retro", campione: "#17421A", chrome: "#0b2b0b" }
  };

  var THEME_ORDER = ["chiaro", "scuro", "retro"];

  function currentTheme() {
    var t = doc.body ? doc.body.getAttribute(opts.themeAttribute) : null;
    return THEMES[t] ? t : THEME_ORDER[0];
  }

  function updateChromeColor(color) {
    if (!color) return;
    try {
      var meta = doc.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = doc.createElement("meta");
        meta.setAttribute("name", "theme-color");
        doc.head.appendChild(meta);
      }
      meta.setAttribute("content", color);
    } catch (e) {
      /* niente */
    }
  }

  /* Cambia il tema del progetto. È la stessa strada del tuo tasto "Tema":
     scrive data-tema sul body, non esiste un secondo posto dove il tema
     viene deciso. */
  function setTheme(name) {
    if (!THEMES[name]) return;
    doc.body.setAttribute(opts.themeAttribute, name);
    /* l'observer qui sotto fa il resto (colore di sistema, pallini) */
    if (!state.themeObserver) onThemeChanged();
  }

  function onThemeChanged() {
    var name = currentTheme();
    updateChromeColor(THEMES[name].chrome);
    if (state.mounted) renderPrefs();
    if (opts.persistTheme) {
      state.settings.tema = name;
      save();
    }
    if (typeof opts.onThemeChange === "function") opts.onThemeChange(name);
  }

  /* Resta in ascolto: se il tema lo cambia il TUO tasto, la barra si
     adegua da sola senza che tu debba chiamare niente. */
  function watchProjectTheme() {
    try {
      if (!global.MutationObserver) return;
      state.themeObserver = new global.MutationObserver(function () {
        onThemeChanged();
      });
      state.themeObserver.observe(doc.body, {
        attributes: true,
        attributeFilter: [opts.themeAttribute]
      });
    } catch (e) {
      /* niente */
    }
  }

  /* ---------------------------------------------------------------------
     Costruzione del DOM
     --------------------------------------------------------------------- */

  function build() {
    var root = doc.createElement("div");
    root.className = "csb-root";
    root.innerHTML =
      '<p class="csb-sr" role="status" aria-live="polite" data-csb="live"></p>' +

      '<div class="csb-backdrop" data-csb="backdrop"></div>' +

      '<section class="csb-shade" data-csb="shade" role="dialog" tabindex="-1" ' +
      'aria-label="Centro notifiche" aria-hidden="true">' +
        '<div class="csb-shade-inner">' +
          '<div class="csb-count" data-csb="countdown" hidden>' +
            '<div class="csb-count-row">' +
              '<span class="csb-count-label" data-csb="cdlabel"></span>' +
              '<span class="csb-count-time" data-csb="cdtime"></span>' +
            "</div>" +
            '<span class="csb-count-track"><i class="csb-count-fill" data-csb="cdfill"></i></span>' +
            '<button type="button" class="csb-count-action" data-csb="cdaction" hidden></button>' +
          "</div>" +
          '<div class="csb-cta" data-csb="cta" hidden>' +
            '<span class="csb-cta-ico" data-csb="ctaico"></span>' +
            '<span class="csb-cta-text" data-csb="ctatext"></span>' +
            '<button type="button" class="csb-cta-btn" data-csb="ctabtn"></button>' +
            '<button type="button" class="csb-cta-close" data-csb="ctaclose" ' +
            'aria-label="Nascondi questa proposta">\u00d7</button>' +
          "</div>" +
          '<div class="csb-pending" data-csb="pending" hidden>' +
            '<span class="csb-pending-ico">\u21c5</span>' +
            '<span class="csb-pending-text" data-csb="pendingtext"></span>' +
            '<button type="button" class="csb-pending-btn" data-csb="pendingbtn">Riprova ora</button>' +
          "</div>" +
          '<div class="csb-quick" data-csb="quick"></div>' +
          '<div class="csb-prefs">' +
            '<div class="csb-swatches" data-csb="swatches" role="group" aria-label="Tema"></div>' +
            '<button type="button" class="csb-sound-btn" data-csb="soundbtn">' +
              '<span class="csb-glyph" aria-hidden="true">\u266a</span>' +
              '<span data-csb="soundlabel"></span>' +
            "</button>" +
          "</div>" +
          '<div class="csb-notif-head">' +
            "<span>Notifiche</span>" +
            '<button type="button" class="csb-clear" data-csb="clear" hidden>Pulisci tutto</button>' +
          "</div>" +
          '<p class="csb-tip" data-csb="tip">' +
            '<span class="csb-glyph" aria-hidden="true">\u2190</span>' +
            '<span data-csb="tiptext"></span>' +
          "</p>" +
          '<div class="csb-list" data-csb="list"></div>' +
        "</div>" +
        '<div class="csb-handle" data-csb="handle" aria-hidden="true"><i></i></div>' +
      "</section>" +

      '<div class="csb-heads" data-csb="heads">' +
        '<button type="button" class="csb-heads-btn" data-csb="headsbtn">' +
          '<span class="csb-heads-ico" data-csb="headsico"></span>' +
          '<span class="csb-heads-body">' +
            '<span class="csb-heads-title" data-csb="headstitle"></span>' +
            '<span class="csb-heads-text" data-csb="headstext"></span>' +
          "</span>" +
        "</button>" +
        '<span class="csb-heads-grip" aria-hidden="true"></span>' +
      "</div>" +

      '<header class="csb-bar" data-csb="bar">' +
        '<div class="csb-left">' +
          '<span class="csb-clock" data-csb="clock">--:--</span>' +
          '<span class="csb-ball-wrap">' +
            '<button type="button" class="csb-ball" data-csb="ball" data-state="offline" ' +
            'aria-label="Connessione assente" aria-expanded="false"></button>' +
            '<div class="csb-pop" data-csb="pop" hidden>' +
              '<div class="csb-pop-row"><span class="csb-pop-k">Stato</span>' +
              '<span class="csb-pop-v" data-csb="popstate"></span></div>' +
              '<div class="csb-pop-row"><span class="csb-pop-k">Ultima sincro</span>' +
              '<span class="csb-pop-v" data-csb="popsync"></span></div>' +
              '<div class="csb-pop-row"><span class="csb-pop-k">Notifiche</span>' +
              '<span class="csb-pop-v" data-csb="popcount"></span></div>' +
            "</div>" +
          "</span>" +
        "</div>" +
        '<div class="csb-center">' +
          '<button type="button" class="csb-center-btn" data-csb="center">' +
            '<span class="csb-dot" data-csb="dot"></span><span data-csb="centertext"></span>' +
          "</button>" +
        "</div>" +
        '<div class="csb-right">' +
          '<button type="button" class="csb-presence" data-csb="presence">' +
            ICON_PERSONA + '<span data-csb="presencecount"></span>' +
          "</button>" +
          '<span class="csb-sync" data-csb="sync" title="Modifiche in attesa">' +
            '<span class="csb-sync-glyph">\u21c5</span><span data-csb="synccount"></span>' +
          "</span>" +
          '<span class="csb-currency" data-csb="currency">' +
            '<span class="csb-cur-glyph" data-csb="curglyph"></span>' +
            '<span data-csb="curvalue"></span>' +
          "</span>" +
          '<button type="button" class="csb-icon" data-csb="settings" aria-label="Impostazioni">' +
          ICON_GEAR + "</button>" +
          '<button type="button" class="csb-icon csb-profile" data-csb="profile" aria-label="Profilo">' +
          '<span class="csb-avatar" data-csb="avatar">??</span></button>' +
        "</div>" +
      "</header>";

    // CardSync Pro (2026-09-01): monta dentro opts.container se fornito
    // (elemento o selettore), altrimenti comportamento originale invariato
    // (document.body). Fallback silenzioso su document.body se il
    // selettore non trova nulla, per non lasciare la barra "orfana".
    var mountTarget = doc.body;
    if (opts.container) {
      mountTarget = typeof opts.container === "string" ? doc.querySelector(opts.container) : opts.container;
      if (!mountTarget) mountTarget = doc.body;
    }
    mountTarget.appendChild(root);

    var q = function (name) {
      return root.querySelector('[data-csb="' + name + '"]');
    };

    el.root = root;
    el.live = q("live");
    el.backdrop = q("backdrop");
    el.shade = q("shade");
    el.countdown = q("countdown");
    el.cdLabel = q("cdlabel");
    el.cdTime = q("cdtime");
    el.cdFill = q("cdfill");
    el.cdAction = q("cdaction");
    el.cta = q("cta");
    el.ctaIco = q("ctaico");
    el.ctaText = q("ctatext");
    el.ctaBtn = q("ctabtn");
    el.ctaClose = q("ctaclose");
    el.pending = q("pending");
    el.pendingText = q("pendingtext");
    el.pendingBtn = q("pendingbtn");
    el.presence = q("presence");
    el.presenceCount = q("presencecount");
    el.sync = q("sync");
    el.syncCount = q("synccount");
    el.quick = q("quick");
    el.swatches = q("swatches");
    el.soundBtn = q("soundbtn");
    el.soundLabel = q("soundlabel");
    el.clear = q("clear");
    el.tip = q("tip");
    el.tipText = q("tiptext");
    el.list = q("list");
    el.handle = q("handle");
    el.heads = q("heads");
    el.headsBtn = q("headsbtn");
    el.headsIco = q("headsico");
    el.headsTitle = q("headstitle");
    el.headsText = q("headstext");
    el.bar = q("bar");
    el.clock = q("clock");
    el.ball = q("ball");
    el.pop = q("pop");
    el.popState = q("popstate");
    el.popSync = q("popsync");
    el.popCount = q("popcount");
    el.center = q("center");
    el.centerText = q("centertext");
    el.dot = q("dot");
    el.currency = q("currency");
    el.curGlyph = q("curglyph");
    el.curValue = q("curvalue");
    el.settings = q("settings");
    el.profile = q("profile");
    el.avatar = q("avatar");

    // CardSync Pro (2026-09-01): questa classe pilota "html.csb-has-bar
    // body { padding-top: ... }" nel CSS — corretto SOLO quando la barra
    // vive sul body a schermo intero (uso originale). Con un container
    // specifico (vedi opts.container sopra) applicarla spingerebbe giù
    // l'intero sito, non solo lo "schermo" del telefono — lo spazio per la
    // barra lì è già gestito dal layout del progetto stesso.
    if (!opts.container) doc.documentElement.classList.add("csb-has-bar");
  }

  /* ---------------------------------------------------------------------
     Orologio
     --------------------------------------------------------------------- */

  function tickClock() {
    var now = new Date();
    el.clock.textContent = formatTime(now);
    var ms = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50;
    clearTimeout(state.clockTimer);
    state.clockTimer = setTimeout(tickClock, ms);
  }

  /* ---------------------------------------------------------------------
     Connessione e pannellino diagnostica
     --------------------------------------------------------------------- */

  function setConnection(status) {
    if (!CONNECTION_LABEL[status]) status = "offline";
    var wasOnline = state.connection === "online";
    state.connection = status;
    if (status === "online" && !wasOnline) {
      state.lastSync = new Date();
      save();
    }
    if (!state.mounted) return;
    el.ball.setAttribute("data-state", status);
    el.ball.setAttribute("aria-label", CONNECTION_LABEL[status]);
    renderPop();
    if (status === "online") flushQueue();
  }

  function renderPop() {
    el.popState.textContent = CONNECTION_LABEL[state.connection];
    el.popSync.textContent = relativeTime(state.lastSync);
    var n = unreadCount();
    el.popCount.textContent = n === 0 ? "tutte lette" : n + " da leggere";
  }

  function togglePop(force) {
    var next = force != null ? force : !state.popOpen;
    state.popOpen = next;
    el.pop.hidden = !next;
    el.ball.setAttribute("aria-expanded", next ? "true" : "false");
    if (next) renderPop();
  }

  /* ---------------------------------------------------------------------
     Persone collegate che stanno aiutando il gruppo
     --------------------------------------------------------------------- */

  function setPresence(input) {
    if (!state.mounted) return;

    /* setPresence(null) o setPresence(0) nasconde la pillola */
    if (input == null || input === 0) {
      state.presence = null;
      el.presence.classList.remove("is-visible", "is-up");
      return;
    }

    var dati = typeof input === "number" ? { count: input } : input;
    var prima = state.presence ? state.presence.count : null;

    state.presence = {
      count: Math.max(0, Number(dati.count) || 0),
      label: dati.label || (state.presence && state.presence.label) || "persone collegate"
    };

    if (state.presence.count <= 0) {
      el.presence.classList.remove("is-visible", "is-up");
      return;
    }

    el.presenceCount.textContent = String(state.presence.count);
    el.presence.classList.add("is-visible");

    var testo = state.presence.count === 1
      ? "1 persona collegata"
      : state.presence.count + " " + state.presence.label;
    el.presence.setAttribute("title", testo);
    el.presence.setAttribute("aria-label", testo);

    /* qualcuno è appena entrato: la pillola si accende un istante */
    clearTimeout(state.presenceTimer);
    if (prima != null && state.presence.count > prima) {
      el.presence.classList.add("is-up");
      state.presenceTimer = setTimeout(function () {
        el.presence.classList.remove("is-up");
      }, 1400);
    } else {
      el.presence.classList.remove("is-up");
    }
  }

  /* ---------------------------------------------------------------------
     Contatore risorsa (polvere magica)
     --------------------------------------------------------------------- */

  function setCurrency(input) {
    if (!state.mounted) return;
    if (input == null) {
      state.currency = null;
      el.currency.classList.remove("is-visible");
      return;
    }
    var prev = state.currency ? state.currency.value : null;
    state.currency = {
      value: Number(input.value) || 0,
      glyph: input.glyph || (state.currency && state.currency.glyph) || "\u2727",
      label: input.label || (state.currency && state.currency.label) || "Polvere magica"
    };
    el.curGlyph.textContent = state.currency.glyph;
    el.curValue.textContent = String(state.currency.value);
    el.currency.setAttribute("title", state.currency.label);
    el.currency.setAttribute("aria-label", state.currency.label + ": " + state.currency.value);
    el.currency.classList.add("is-visible");

    clearTimeout(state.currencyTimer);
    if (prev != null && state.currency.value > prev) {
      el.currency.classList.add("is-up");
      state.currencyTimer = setTimeout(function () {
        el.currency.classList.remove("is-up");
      }, 1100);
    } else {
      el.currency.classList.remove("is-up");
    }
  }

  /* ---------------------------------------------------------------------
     Countdown della bustina
     --------------------------------------------------------------------- */

  function setCountdown(input) {
    if (!state.mounted) return;
    if (!input) {
      state.countdown = null;
      el.countdown.hidden = true;
      clearInterval(state.countdownTimer);
      return;
    }
    var endsAt = input.endsAt instanceof Date ? input.endsAt : new Date(input.endsAt);
    var startedAt = input.startedAt
      ? input.startedAt instanceof Date
        ? input.startedAt
        : new Date(input.startedAt)
      : new Date();

    state.countdown = {
      label: input.label || "Prossima bustina",
      startedAt: startedAt,
      endsAt: endsAt,
      actionLabel: input.actionLabel || "Apri ora",
      onAction: input.onAction || null,
      onComplete: input.onComplete || null,
      /* Se il tempo è già scaduto nel momento in cui imposti il countdown,
         onComplete NON viene chiamato: altrimenti scatterebbe a ogni
         ricaricamento della pagina. Metti notifyIfPast: true se invece
         vuoi che scatti lo stesso. */
      completed: input.notifyIfPast ? false : Date.now() >= endsAt.getTime()
    };

    el.countdown.hidden = false;
    el.cdLabel.textContent = state.countdown.label;
    el.cdAction.textContent = state.countdown.actionLabel;

    clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(tickCountdown, 1000);
    tickCountdown();
  }

  function tickCountdown() {
    var c = state.countdown;
    if (!c) return;
    var now = Date.now();
    var total = Math.max(1, c.endsAt.getTime() - c.startedAt.getTime());
    var left = c.endsAt.getTime() - now;
    var progress = clamp(1 - left / total, 0, 1);

    el.cdTime.textContent = left > 0 ? formatDuration(left) : "pronta";
    el.cdFill.style.width = (progress * 100).toFixed(1) + "%";
    el.countdown.classList.toggle("is-ready", left <= 0);
    el.cdAction.hidden = left > 0 || !c.onAction;

    if (left <= 0 && !c.completed) {
      c.completed = true;
      if (typeof c.onComplete === "function") c.onComplete();
    }
  }

  /* ---------------------------------------------------------------------
     Installazione come app e avvisi di sistema
     --------------------------------------------------------------------- */

  function supportsNotifications() {
    return typeof global.Notification !== "undefined";
  }

  function setupServiceWorker() {
    if (!opts.serviceWorker) return;
    if (!global.navigator || !("serviceWorker" in global.navigator)) return;
    if (global.location.protocol === "file:") {
      if (global.console && console.info) {
        console.info(
          "[CSBar] L'installazione come app richiede un indirizzo http/https: " +
          "aprendo il file con doppio clic resta disattivata."
        );
      }
      return;
    }
    global.addEventListener("load", function () {
      global.navigator.serviceWorker.register(opts.serviceWorker).catch(function (err) {
        if (global.console && console.warn) {
          console.warn("[CSBar] service worker non registrato:", err);
        }
      });
    });
  }

  function setupInstall() {
    global.addEventListener("beforeinstallprompt", function (ev) {
      ev.preventDefault();
      state.deferredInstall = ev;
      renderCta();
    });
    global.addEventListener("appinstalled", function () {
      state.deferredInstall = null;
      renderCta();
    });
  }

  function renderCta() {
    if (!state.mounted) return;
    var kind = null;
    if (opts.installPrompt && state.deferredInstall && !state.ctaDismissed.install) {
      kind = "install";
    } else if (
      opts.systemNotifications &&
      supportsNotifications() &&
      global.Notification.permission === "default" &&
      !state.ctaDismissed.avvisi
    ) {
      kind = "avvisi";
    }

    if (!kind) {
      el.cta.hidden = true;
      el.cta.removeAttribute("data-kind");
      return;
    }

    el.cta.hidden = false;
    el.cta.setAttribute("data-kind", kind);
    if (kind === "install") {
      el.ctaIco.textContent = "\u2b07";
      el.ctaText.textContent = "Installa " + opts.appName + " sulla schermata home.";
      el.ctaBtn.textContent = "Installa";
    } else {
      el.ctaIco.textContent = "\u25c8";
      el.ctaText.textContent = "Ricevi gli avvisi anche quando il sito è chiuso.";
      el.ctaBtn.textContent = "Attiva";
    }
  }

  function requestNotificationPermission() {
    if (!supportsNotifications()) return Promise.resolve("non supportato");
    try {
      var result = global.Notification.requestPermission();
      if (result && typeof result.then === "function") {
        return result.then(function (perm) {
          renderCta();
          return perm;
        });
      }
      renderCta();
      return Promise.resolve(global.Notification.permission);
    } catch (e) {
      return Promise.resolve("errore");
    }
  }

  function maybeSystemNotify(item) {
    if (!opts.systemNotifications || !state.settings.avvisi) return;
    if (!supportsNotifications() || global.Notification.permission !== "granted") return;
    if (!doc.hidden) return; /* pagina in primo piano: basta il banner interno */
    try {
      var sysNotif = new global.Notification(displayTitle(item), {
        body: item.text || "",
        tag: item.group || item.id,
        icon: opts.notificationIcon || undefined,
        badge: opts.notificationIcon || undefined,
        silent: !state.settings.audio
      });
      sysNotif.onclick = function () {
        try {
          global.focus();
        } catch (e) {
          /* niente */
        }
        sysNotif.close();
        openNotification(findNotification(item.id) || item);
      };
    } catch (e) {
      /* alcuni browser richiedono il service worker: si ignora */
    }
  }

  /* ---------------------------------------------------------------------
     Coda offline
     --------------------------------------------------------------------- */

  function renderPending() {
    if (!state.mounted) return;
    var n = state.pending.length;

    el.sync.classList.toggle("is-visible", n > 0);
    el.sync.classList.toggle("is-flushing", state.flushing);
    el.syncCount.textContent = n ? String(n) : "";
    el.sync.setAttribute(
      "aria-label",
      n === 1 ? "1 modifica in attesa" : n + " modifiche in attesa"
    );

    el.pending.hidden = n === 0;
    el.pendingText.textContent =
      n === 1
        ? "1 modifica in attesa di sincronizzazione."
        : n + " modifiche in attesa di sincronizzazione.";
    el.pendingBtn.disabled = state.flushing;
    el.pendingBtn.textContent = state.flushing ? "In corso\u2026" : "Riprova ora";
  }

  function enqueueAction(action) {
    var a = action || {};
    var item = {
      id: a.id != null ? String(a.id) : "act-" + Date.now() + "-" + Math.round(Math.random() * 1e6),
      type: a.type || "azione",
      label: a.label || "",
      payload: a.payload !== undefined ? a.payload : null,
      date: new Date().toISOString(),
      attempts: 0
    };
    state.pending.push(item);
    save();
    renderPending();
    if (state.connection === "online") flushQueue();
    return item.id;
  }

  function flushQueue() {
    if (state.flushing) return Promise.resolve(0);
    if (!state.pending.length) return Promise.resolve(0);
    if (typeof opts.onFlushAction !== "function") return Promise.resolve(0);

    state.flushing = true;
    renderPending();
    var done = 0;

    function step() {
      if (!state.pending.length) return Promise.resolve();
      var item = state.pending[0];
      item.attempts = (item.attempts || 0) + 1;
      return Promise.resolve()
        .then(function () {
          return opts.onFlushAction(item);
        })
        .then(function () {
          state.pending.shift();
          done++;
          save();
          renderPending();
          return step();
        });
    }

    return step()
      .catch(function (err) {
        /* la prima azione fallita ferma la coda: si riproverà più tardi */
        if (global.console && console.warn) {
          console.warn("[CSBar] sincronizzazione interrotta:", err);
        }
      })
      .then(function () {
        state.flushing = false;
        save();
        renderPending();
        if (done > 0) {
          state.lastSync = new Date();
          if (state.popOpen) renderPop();
          notify({
            icon: "\u2713",
            title: "Modifiche sincronizzate",
            text:
              done === 1
                ? "1 modifica salvata sul server."
                : done + " modifiche salvate sul server."
          });
        }
        return done;
      });
  }

  /* ---------------------------------------------------------------------
     Allineamento tra schede aperte
     --------------------------------------------------------------------- */

  function syncFromStorage() {
    if (!state.mounted || !opts.persist) return;
    /* se qui c'è una modifica non ancora scritta, ha la precedenza:
       la si salva e si salta la rilettura */
    if (flushSave()) return;
    loadStored();
    renderQuick();
    renderPrefs();
    renderList();
    renderCenter();
    renderPending();
    if (state.popOpen) renderPop();
  }

  /* ---------------------------------------------------------------------
     Centro barra: ticker e contatore
     --------------------------------------------------------------------- */

  function unreadCount() {
    var n = 0;
    for (var i = 0; i < state.notifications.length; i++) {
      if (!state.notifications[i].read) n += state.notifications[i].count || 1;
    }
    return n;
  }

  function renderCenter() {
    /* il badge nel titolo della scheda va aggiornato sempre, anche mentre
       il ticker sta occupando il centro della barra */
    updateTitleBadge();
    if (state.popOpen) renderPop();
    if (el.center.classList.contains("is-alert")) return;
    var da = interventiAperti().length;
    var n = unreadCount();
    if (da > 0 && !state.open) {
      el.centerText.textContent = da === 1 ? "1 cosa da gestire" : da + " cose da gestire";
      el.dot.style.background = "var(--csb-attesa)";
      el.dot.hidden = false;
      el.center.classList.add("is-visible");
      el.center.setAttribute("aria-label", "Apri il centro notifiche, " + da + " da gestire");
      updateTitleBadge();
      return;
    }
    if (n > 0 && !state.open) {
      el.centerText.textContent = n === 1 ? "1 notifica nuova" : n + " notifiche nuove";
      el.dot.style.background = "";
      el.dot.hidden = false;
      el.center.classList.add("is-visible");
      el.center.setAttribute("aria-label", "Apri il centro notifiche, " + n + " da leggere");
    } else {
      el.center.classList.remove("is-visible");
      el.centerText.textContent = "";
      el.dot.hidden = true;
      el.center.setAttribute("aria-label", "Apri il centro notifiche");
    }
  }

  function updateTitleBadge() {
    if (!opts.titleBadge) return;
    var n = Math.max(unreadCount(), interventiAperti().length);
    try {
      doc.title = n > 0 ? "(" + n + ") " + state.baseTitle : state.baseTitle;
    } catch (e) {
      /* niente */
    }
  }

  function showTicker(text) {
    clearTimeout(state.tickerTimer);
    el.centerText.textContent = text;
    el.dot.hidden = false;
    el.center.classList.add("is-visible", "is-alert");
    state.tickerTimer = setTimeout(function () {
      el.center.classList.remove("is-alert");
      renderCenter();
    }, opts.tickerDuration);
  }

  /* ---------------------------------------------------------------------
     Banner heads-up e coda avvisi
     --------------------------------------------------------------------- */

  function enqueue(item) {
    state.queue.push(item);
    pumpQueue();
  }

  function pumpQueue() {
    if (state.queueBusy || !state.queue.length) return;
    if (state.open) {
      state.queue.length = 0;
      return;
    }
    var item = state.queue.shift();
    state.queueBusy = true;

    showTicker(displayTitle(item));
    blip();
    buzz([18, 60, 18]);
    announce(displayTitle(item) + ". " + (item.text || ""));

    var useBanner = item.priority === "high" && !state.locked;
    if (useBanner) showHeads(item);

    var wait = useBanner ? opts.bannerDuration + 450 : 1400;
    setTimeout(function () {
      state.queueBusy = false;
      pumpQueue();
    }, wait);
  }

  function showHeads(item) {
    clearTimeout(state.headsTimer);
    el.heads.setAttribute("data-notif", item.id);
    el.headsIco.textContent = item.icon || "\u25cf";
    el.headsTitle.textContent = displayTitle(item);
    el.headsText.textContent = item.text || "";
    el.heads.style.transform = "";
    el.heads.classList.remove("is-dragging");
    el.heads.classList.add("is-visible");
    state.headsTimer = setTimeout(hideHeads, opts.bannerDuration);
  }

  function hideHeads() {
    clearTimeout(state.headsTimer);
    el.heads.classList.remove("is-visible", "is-dragging");
    el.heads.style.transform = "";
  }

  function announce(text) {
    el.live.textContent = "";
    setTimeout(function () {
      el.live.textContent = text;
    }, 60);
  }

  /* ---------------------------------------------------------------------
     Tasti rapidi
     --------------------------------------------------------------------- */

  function renderQuick() {
    var html = "";
    for (var i = 0; i < state.quickActions.length; i++) {
      var qa = state.quickActions[i];
      var isToggle = qa.type !== "action";
      var on = isToggle && !!state.settings[qa.id];
      html +=
        '<button type="button" class="csb-quick-btn' + (on ? " is-on" : "") +
        '" data-quick="' + escapeHtml(qa.id) + '"' +
        (isToggle ? ' aria-pressed="' + (on ? "true" : "false") + '"' : "") + ">" +
        '<span class="csb-glyph" aria-hidden="true">' + escapeHtml(qa.glyph || "\u2022") + "</span>" +
        '<span class="csb-quick-label">' + escapeHtml(qa.label) + "</span>" +
        "</button>";
    }
    el.quick.innerHTML = html;
  }

  function handleQuickClick(ev) {
    var btn = closestEl(ev.target, "[data-quick]");
    if (!btn) return;
    var id = btn.getAttribute("data-quick");
    var item = null;
    for (var i = 0; i < state.quickActions.length; i++) {
      if (state.quickActions[i].id === id) item = state.quickActions[i];
    }
    if (!item) return;

    if (item.type !== "action") {
      state.settings[id] = !state.settings[id];
      btn.classList.toggle("is-on", state.settings[id]);
      btn.setAttribute("aria-pressed", state.settings[id] ? "true" : "false");
      save();
      if (id === "audio" && state.settings.audio) blip();
      if (id === "vibrazione" && state.settings.vibrazione) buzz(25);
      if (typeof item.onToggle === "function") item.onToggle(state.settings[id], item);
    } else {
      buzz(15);
      btn.classList.add("is-busy");
      setTimeout(function () {
        btn.classList.remove("is-busy");
      }, 1200);
      if (id === "sincronizza" && typeof opts.onSync === "function") opts.onSync();
      if (typeof item.onToggle === "function") item.onToggle(true, item);
    }
    if (typeof opts.onQuickAction === "function") {
      opts.onQuickAction({ id: id, active: state.settings[id], type: item.type });
    }
  }

  function renderPrefs() {
    if (!state.mounted) return;

    var current = currentTheme();
    var html = "";
    for (var i = 0; i < THEME_ORDER.length; i++) {
      var name = THEME_ORDER[i];
      var t = THEMES[name];
      html +=
        '<button type="button" class="csb-swatch' + (current === name ? " is-on" : "") +
        '" data-theme="' + escapeHtml(name) + '" title="Tema ' + escapeHtml(t.label) +
        '" aria-label="Tema ' + escapeHtml(t.label) + '"' +
        ' aria-pressed="' + (current === name ? "true" : "false") + '"' +
        ' style="background: ' + t.campione + ';"></button>';
    }
    el.swatches.innerHTML = html;

    el.soundLabel.textContent = soundLabel();
    el.soundBtn.classList.toggle("is-muted", currentSound() === "nessuno");
    el.soundBtn.setAttribute("aria-label", "Suono delle notifiche: " + soundLabel() + ". Tocca per cambiare.");
  }

  function handleSwatchClick(ev) {
    var btn = closestEl(ev.target, "[data-theme]");
    if (!btn) return;
    setTheme(btn.getAttribute("data-theme"));
    buzz(12);
  }

  function cycleSound() {
    var current = currentSound();
    var idx = SOUND_ORDER.indexOf(current);
    var next = SOUND_ORDER[(idx + 1) % SOUND_ORDER.length];
    setSound(next, true);
  }

  /* ---------------------------------------------------------------------
     Notifiche
     --------------------------------------------------------------------- */

  function displayTitle(n) {
    if ((n.count || 1) > 1 && n.groupLabel) return n.count + " " + n.groupLabel;
    return n.title;
  }

  function schedaNotifica(n) {
    var count = n.count || 1;
    return '<div class="csb-notif-wrap" data-wrap="' + escapeHtml(n.id) + '">' +
      '<span class="csb-notif-hint" aria-hidden="true">' +
      (n.intervento ? "\u21ba" : "\u2715") + "</span>" +
      '<button type="button" class="csb-notif' + (n.read ? "" : " is-new") +
      (n.intervento ? " is-intervento" : "") +
      '" data-notif="' + escapeHtml(n.id) + '">' +
      '<span class="csb-notif-ico" aria-hidden="true">' + escapeHtml(n.icon || "\u25cf") + "</span>" +
      '<span class="csb-notif-body">' +
        '<span class="csb-notif-title">' + escapeHtml(displayTitle(n)) +
        (n.intervento ? '<span class="csb-tag">Da gestire</span>' : "") +
        (count > 1 && !n.groupLabel ? '<span class="csb-badge">\u00d7' + count + "</span>" : "") +
        "</span>" +
        (n.text ? '<span class="csb-notif-text">' + escapeHtml(n.text) + "</span>" : "") +
      "</span>" +
      '<span class="csb-notif-time">' + escapeHtml(formatTime(n.date)) + "</span>" +
      "</button>" +
      "</div>";
  }

  function interventiAperti() {
    var out = [];
    for (var i = 0; i < state.notifications.length; i++) {
      if (state.notifications[i].intervento) out.push(state.notifications[i]);
    }
    return out;
  }

  function renderList() {
    var interventi = interventiAperti();
    var normali = [];
    for (var i = 0; i < state.notifications.length; i++) {
      if (!state.notifications[i].intervento) normali.push(state.notifications[i]);
    }

    if (!state.notifications.length) {
      el.list.innerHTML =
        '<p class="csb-empty">Nessuna notifica.<br>Torna dopo la prossima bustina.</p>';
      el.clear.hidden = true;
      return;
    }
    el.clear.hidden = normali.length === 0;

    var html = "";

    /* prima quello che aspetta una mano, sempre in cima */
    if (interventi.length) {
      html += '<p class="csb-sez">' +
        (interventi.length === 1 ? "Richiede il tuo intervento"
                                 : interventi.length + " cose richiedono il tuo intervento") +
        "</p>";
      for (var a = 0; a < interventi.length; a++) html += schedaNotifica(interventi[a]);
    }

    if (interventi.length && normali.length) {
      html += '<p class="csb-sez" style="color: var(--csb-testo-2)">Altre notifiche</p>';
    }

    for (var b = 0; b < normali.length; b++) html += schedaNotifica(normali[b]);

    el.list.innerHTML = html;
  }

  function notify(input) {
    if (!state.mounted) return null;
    var n = input || {};

    /* raggruppamento: se esiste già una notifica non letta dello stesso
       gruppo, si aggiorna quella invece di aggiungerne una nuova */
    if (n.group) {
      for (var i = 0; i < state.notifications.length; i++) {
        var ex = state.notifications[i];
        if (ex.group === n.group && !ex.read) {
          ex.count = (ex.count || 1) + 1;
          ex.date = new Date();
          if (n.text) ex.text = n.text;
          if (n.target) ex.target = n.target;
          state.notifications.splice(i, 1);
          state.notifications.unshift(ex);
          renderList();
          save();
          if (state.settings.avvisi) {
            enqueue(ex);
            maybeSystemNotify(ex);
          }
          renderCenter();
          return ex.id;
        }
      }
    }

    var item = {
      id: n.id != null ? String(n.id) : "csb-" + Date.now() + "-" + Math.round(Math.random() * 1e6),
      title: n.title || "Notifica",
      text: n.text || "",
      icon: n.icon || "\u25cf",
      target: n.target || null,
      group: n.group || null,
      groupLabel: n.groupLabel || null,
      priority: n.priority === "high" ? "high" : "normal",
      /* true = aspetta una mano dell'utente, non sparisce da sola */
      intervento: !!n.intervento,
      count: 1,
      data: n.data || null,
      date: n.date instanceof Date ? n.date : new Date(),
      read: false
    };

    state.notifications.unshift(item);
    if (state.notifications.length > opts.maxNotifications) {
      state.notifications.length = opts.maxNotifications;
    }

    renderList();
    save();

    if (state.open) {
      markAllRead();
    } else if (state.settings.avvisi) {
      enqueue(item);
      maybeSystemNotify(item);
      renderCenter();
    } else {
      renderCenter();
    }
    return item.id;
  }

  function avvisa(tipo, extra) {
    var preset = opts.notificationTypes && opts.notificationTypes[tipo];
    if (!preset) {
      if (global.console && console.warn) {
        console.warn("[CSBar] tipo di notifica sconosciuto: " + tipo);
      }
      return null;
    }
    var merged = {};
    var k;
    for (k in preset) {
      if (Object.prototype.hasOwnProperty.call(preset, k)) merged[k] = preset[k];
    }
    if (extra) {
      for (k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) merged[k] = extra[k];
      }
    }
    return notify(merged);
  }

  function openNotification(item) {
    if (!item) return;
    item.read = true;
    save();
    close();
    renderList();
    renderCenter();

    if (typeof opts.onNotificationClick === "function") {
      opts.onNotificationClick(item);
    } else if (item.target) {
      if (item.target.charAt(0) === "#") global.location.hash = item.target;
      else global.location.href = item.target;
    }
  }

  function removeNotification(id) {
    for (var i = 0; i < state.notifications.length; i++) {
      if (state.notifications[i].id === id) {
        state.notifications.splice(i, 1);
        break;
      }
    }
    save();
    renderList();
    renderCenter();
  }

  function markAllRead() {
    for (var i = 0; i < state.notifications.length; i++) {
      state.notifications[i].read = true;
    }
    save();
    renderList();
    renderCenter();
  }

  /* Svuota l'elenco ma lascia in piedi quello che richiede un intervento:
     quelle spariscono solo quando vengono davvero gestite. */
  function clearAll() {
    state.notifications = interventiAperti();
    save();
    renderList();
    renderCenter();
    announce("Notifiche eliminate.");
  }

  /* Da chiamare quando l'intervento è stato fatto davvero. */
  function resolveIntervention(id) {
    var n = findNotification(id);
    if (!n) return false;
    n.intervento = false;
    dismissNotification(id);
    return true;
  }

  function handleListClick(ev) {
    if (swipe.blockClick) {
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    var btn = closestEl(ev.target, "[data-notif]");
    if (!btn) return;
    openNotification(findNotification(btn.getAttribute("data-notif")));
  }

  /* sparizione con collasso in altezza */
  function dismissNotification(id) {
    var wrap = el.list.querySelector('[data-wrap="' + id + '"]');
    if (!wrap) {
      removeNotification(id);
      return;
    }
    var node = wrap.querySelector(".csb-notif");
    if (node) {
      node.classList.add("is-settling");
      node.style.transform = "translateX(-110%)";
      node.style.opacity = "0";
    }
    wrap.style.height = wrap.offsetHeight + "px";
    void wrap.offsetHeight;
    wrap.classList.add("is-collapsing");
    wrap.style.marginBottom = "-8px";
    buzz(14);
    setTimeout(function () {
      removeNotification(id);
    }, 230);
  }

  /* ---------------------------------------------------------------------
     Scorrimento laterale per eliminare una notifica
     --------------------------------------------------------------------- */

  /* La soglia si calcola sulla larghezza della scheda: circa un terzo.
     Sotto quella, la notifica torna al suo posto. */
  function sogliaEliminazione(node) {
    var largo = node && node.offsetWidth ? node.offsetWidth : 300;
    return Math.max(88, Math.round(largo * 0.34));
  }

  function onSwipeDown(ev) {
    var node = closestEl(ev.target, "[data-notif]");
    if (!node) return;
    if (ev.button != null && ev.button !== 0) return;

    swipe.active = true;
    swipe.pointerId = ev.pointerId;
    swipe.node = node;
    swipe.wrap = node.parentNode;
    swipe.id = node.getAttribute("data-notif");
    swipe.startX = ev.clientX;
    swipe.startY = ev.clientY;
    swipe.axis = null;
    swipe.dx = 0;
    swipe.armed = false;
    var dati = findNotification(swipe.id);
    swipe.bloccata = !!(dati && dati.intervento);
    swipe.wrap.classList.toggle("is-bloccata", swipe.bloccata);
    swipe.soglia = sogliaEliminazione(node);

    global.addEventListener("pointermove", onSwipeMove, { passive: false });
    global.addEventListener("pointerup", onSwipeUp);
    global.addEventListener("pointercancel", onSwipeUp);
  }

  function onSwipeMove(ev) {
    if (!swipe.active || ev.pointerId !== swipe.pointerId) return;
    var dx = ev.clientX - swipe.startX;
    var dy = ev.clientY - swipe.startY;

    if (!swipe.axis) {
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
      swipe.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (swipe.axis === "y") {
        endSwipe(false);
        return;
      }
      swipe.node.classList.remove("is-settling");
      swipe.wrap.classList.add("is-swiping");
    }

    if (ev.cancelable) ev.preventDefault();

    /* verso destra fa sempre resistenza; le notifiche da gestire la fanno
       in tutte e due le direzioni, così si capisce che non si buttano via */
    var x = dx > 0 ? dx * 0.18 : dx;
    if (swipe.bloccata) x = dx * 0.22;
    swipe.dx = x;
    swipe.node.style.transform = "translateX(" + x + "px)";

    /* superata la soglia l'indizio si fa deciso e il telefono lo conferma */
    var armato = !swipe.bloccata && x < -swipe.soglia;
    if (armato !== swipe.armed) {
      swipe.armed = armato;
      swipe.wrap.classList.toggle("is-armed", armato);
      if (armato) buzz(12);
    }
  }

  function onSwipeUp() {
    if (!swipe.active) return;
    if (swipe.axis !== "x") {
      endSwipe(false);
      return;
    }

    var node = swipe.node;
    var wrap = swipe.wrap;
    var id = swipe.id;
    var oltre = !swipe.bloccata && swipe.dx < -swipe.soglia;
    var eraBloccata = swipe.bloccata;

    endSwipe(true);

    if (eraBloccata && swipe.dxUltimo < -30) {
      mostraSuggerimento("Questa resta finché non la gestisci. Toccala per aprirla.");
    }

    if (oltre) {
      dismissNotification(id);
      return;
    }

    wrap.classList.remove("is-swiping", "is-armed", "is-bloccata");
    node.classList.add("is-settling");
    node.style.transform = "";
  }

  function endSwipe(moved) {
    swipe.dxUltimo = swipe.dx;
    swipe.active = false;
    swipe.blockClick = moved && swipe.axis === "x";
    if (swipe.blockClick) {
      setTimeout(function () {
        swipe.blockClick = false;
      }, 320);
    }
    if (swipe.wrap) swipe.wrap.classList.remove("is-bloccata");
    if (swipe.wrap && !moved) swipe.wrap.classList.remove("is-swiping", "is-armed");
    swipe.node = null;
    swipe.wrap = null;
    swipe.axis = null;
    global.removeEventListener("pointermove", onSwipeMove);
    global.removeEventListener("pointerup", onSwipeUp);
    global.removeEventListener("pointercancel", onSwipeUp);
  }

  /* ---------------------------------------------------------------------
     Tutorial: si mostra una volta sola, alla prima apertura della tendina
     con almeno una notifica dentro.
     --------------------------------------------------------------------- */

  function motoRidotto() {
    try {
      return global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  /* Mostra una riga di spiegazione in cima all'elenco, poi la ritira. */
  function mostraSuggerimento(testo, durata) {
    if (!state.mounted) return;
    el.tipText.textContent = testo;
    el.tip.classList.add("is-visible");
    clearTimeout(state.tipTimer);
    state.tipTimer = setTimeout(function () {
      el.tip.classList.remove("is-visible");
    }, durata || 4000);
  }

  function mostraTutorial(forzato) {
    if (!state.mounted) return;
    if (!forzato && state.settings.tutorial === "fatto") return;
    if (!el.list.querySelector(".csb-notif:not(.is-intervento)")) return;

    state.settings.tutorial = "fatto";
    save();

    mostraSuggerimento("Trascina una notifica verso sinistra per eliminarla.", 7000);

    var node = el.list.querySelector(".csb-notif:not(.is-intervento)");
    if (node && !motoRidotto()) {
      var wrap = node.parentNode;
      wrap.classList.add("is-swiping");
      node.classList.add("is-demo");
      setTimeout(function () {
        node.classList.remove("is-demo");
        wrap.classList.remove("is-swiping");
      }, 4900);
    }

  }

  function endSwipe(moved) {
    swipe.dxUltimo = swipe.dx;
    swipe.active = false;
    swipe.blockClick = moved && swipe.axis === "x";
    if (swipe.blockClick) {
      setTimeout(function () {
        swipe.blockClick = false;
      }, 320);
    }
    swipe.node = null;
    swipe.axis = null;
    global.removeEventListener("pointermove", onSwipeMove);
    global.removeEventListener("pointerup", onSwipeUp);
    global.removeEventListener("pointercancel", onSwipeUp);
  }

  /* ---------------------------------------------------------------------
     Blocco dello scorrimento pagina (compatibile Safari iOS)
     --------------------------------------------------------------------- */

  function lockScroll() {
    state.scrollY = global.pageYOffset || doc.documentElement.scrollTop || 0;
    doc.body.style.top = -state.scrollY + "px";
    doc.body.classList.add("csb-locked");
  }

  function unlockScroll() {
    if (!doc.body.classList.contains("csb-locked")) return;
    doc.body.classList.remove("csb-locked");
    doc.body.style.top = "";
    global.scrollTo(0, state.scrollY);
  }

  /* ---------------------------------------------------------------------
     Apertura / chiusura tendina
     --------------------------------------------------------------------- */

  function shadeHeight() {
    return el.shade.offsetHeight || 1;
  }

  function setShadeY(px, animate) {
    el.shade.classList.toggle("is-animating", !!animate);
    el.shade.style.setProperty("--csb-y", px + "px");
  }

  function open(animate) {
    if (!state.open) state.lastFocus = doc.activeElement;
    el.bar.classList.add("is-shade-open");
    hideHeads();
    togglePop(false);
    el.shade.classList.add("is-visible");
    el.shade.setAttribute("aria-hidden", "false");
    el.backdrop.classList.add("is-active");
    el.backdrop.style.opacity = "";
    setShadeY(0, animate !== false);
    lockScroll();
    state.open = true;
    state.queue.length = 0;
    clearTimeout(state.tickerTimer);
    el.center.classList.remove("is-alert");
    markAllRead();
    tickCountdown();
    setTimeout(function () {
      if (state.open) mostraTutorial(false);
    }, 520);
    try {
      el.shade.focus({ preventScroll: true });
    } catch (e) {
      el.shade.focus();
    }
  }

  function close(animate) {
    var wasOpen = state.open;
    el.bar.classList.remove("is-shade-open");
    clearTimeout(state.tipTimer);
    if (el.tip) el.tip.classList.remove("is-visible");
    setShadeY(-shadeHeight(), animate !== false);
    el.shade.setAttribute("aria-hidden", "true");
    el.backdrop.classList.remove("is-active");
    el.backdrop.style.opacity = "";
    unlockScroll();
    state.open = false;
    renderCenter();

    if (wasOpen && state.lastFocus && typeof state.lastFocus.focus === "function") {
      try {
        state.lastFocus.focus({ preventScroll: true });
      } catch (e) {
        /* niente */
      }
      state.lastFocus = null;
    }

    setTimeout(function () {
      if (!state.open) {
        el.shade.classList.remove("is-visible");
        el.shade.style.setProperty("--csb-y", "-100%");
      }
    }, 360);
  }

  /* ---------------------------------------------------------------------
     Trascinamento della tendina (mouse + dito, stesso codice)
     --------------------------------------------------------------------- */

  function onPointerDown(ev) {
    if (state.locked) return;
    if (ev.button != null && ev.button !== 0) return;
    if (closestEl(ev.target, ".csb-icon, .csb-ball, .csb-pop, .csb-quick-btn, .csb-notif, " +
      ".csb-clear, .csb-count-action, .csb-cta-btn, .csb-cta-close, " +
      ".csb-pending-btn, .csb-swatch, .csb-sound-btn")) return;

    drag.active = true;
    drag.moved = false;
    drag.passedThreshold = false;
    drag.pointerId = ev.pointerId;
    drag.startY = ev.clientY;
    drag.height = shadeHeight();
    drag.baseY = state.open ? 0 : -drag.height;
    drag.samples = [{ y: ev.clientY, t: performance.now() }];

    hideHeads();
    el.shade.classList.add("is-visible");
    el.shade.classList.remove("is-animating");
    el.backdrop.classList.add("is-active");
    el.backdrop.style.opacity = String(clamp((drag.baseY + drag.height) / drag.height, 0, 1));
    el.bar.classList.add("is-dragging", "is-shade-open");

    global.addEventListener("pointermove", onPointerMove, { passive: false });
    global.addEventListener("pointerup", onPointerUp);
    global.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(ev) {
    if (!drag.active || ev.pointerId !== drag.pointerId) return;

    var dy = ev.clientY - drag.startY;
    if (!drag.moved && Math.abs(dy) > 5) drag.moved = true;
    if (drag.moved && ev.cancelable) ev.preventDefault();

    var y = drag.baseY + dy;
    if (y > 0) y = y * 0.16;
    y = clamp(y, -drag.height, 14);

    var progress = (y + drag.height) / drag.height;
    setShadeY(y, false);
    el.backdrop.style.opacity = String(clamp(progress, 0, 1));

    /* piccolo colpo di vibrazione quando si supera la soglia di scatto */
    var past = progress > 0.45;
    if (past !== drag.passedThreshold) {
      drag.passedThreshold = past;
      if (past) buzz(10);
    }

    drag.samples.push({ y: ev.clientY, t: performance.now() });
    if (drag.samples.length > 6) drag.samples.shift();
  }

  function onPointerUp() {
    if (!drag.active) return;
    drag.active = false;
    el.bar.classList.remove("is-dragging");
    global.removeEventListener("pointermove", onPointerMove);
    global.removeEventListener("pointerup", onPointerUp);
    global.removeEventListener("pointercancel", onPointerUp);

    var first = drag.samples[0];
    var last = drag.samples[drag.samples.length - 1];
    var dt = last.t - first.t;
    var velocity = dt > 12 ? (last.y - first.y) / dt : 0;

    var currentY = parseFloat(el.shade.style.getPropertyValue("--csb-y"));
    if (isNaN(currentY)) currentY = drag.baseY;
    var progress = (currentY + drag.height) / drag.height;

    el.backdrop.style.opacity = "";

    if (!drag.moved) {
      if (state.open) open(true);
      else close(true);
      return;
    }

    var shouldOpen;
    if (velocity > 0.35) shouldOpen = true;
    else if (velocity < -0.35) shouldOpen = false;
    else shouldOpen = progress > 0.45;

    if (shouldOpen) open(true);
    else close(true);
  }

  /* ---------------------------------------------------------------------
     Trascinamento del banner heads-up (verso l'alto per scartarlo)
     --------------------------------------------------------------------- */

  function onHeadsDown(ev) {
    if (ev.button != null && ev.button !== 0) return;
    headsDrag.active = true;
    headsDrag.moved = false;
    headsDrag.pointerId = ev.pointerId;
    headsDrag.startY = ev.clientY;
    headsDrag.dy = 0;
    clearTimeout(state.headsTimer);
    el.heads.classList.add("is-dragging");
    global.addEventListener("pointermove", onHeadsMove, { passive: false });
    global.addEventListener("pointerup", onHeadsUp);
    global.addEventListener("pointercancel", onHeadsUp);
  }

  function onHeadsMove(ev) {
    if (!headsDrag.active || ev.pointerId !== headsDrag.pointerId) return;
    var dy = ev.clientY - headsDrag.startY;
    if (!headsDrag.moved && Math.abs(dy) > 5) headsDrag.moved = true;
    if (headsDrag.moved && ev.cancelable) ev.preventDefault();
    headsDrag.dy = Math.min(0, dy);
    el.heads.style.transform = "translate(-50%, " + headsDrag.dy + "px)";
  }

  function onHeadsUp() {
    if (!headsDrag.active) return;
    headsDrag.active = false;
    el.heads.classList.remove("is-dragging");
    global.removeEventListener("pointermove", onHeadsMove);
    global.removeEventListener("pointerup", onHeadsUp);
    global.removeEventListener("pointercancel", onHeadsUp);

    if (headsDrag.dy < -22) {
      hideHeads();
    } else if (headsDrag.moved) {
      el.heads.style.transform = "";
      state.headsTimer = setTimeout(hideHeads, 1600);
    } else {
      el.heads.style.transform = "";
      state.headsTimer = setTimeout(hideHeads, opts.bannerDuration);
    }
  }

  /* ---------------------------------------------------------------------
     Focus dentro la tendina (semplice trappola per il tasto Tab)
     --------------------------------------------------------------------- */

  function trapFocus(ev) {
    if (!state.open || ev.key !== "Tab") return;
    var nodes = el.shade.querySelectorAll("button:not([hidden]):not([disabled])");
    if (!nodes.length) return;
    var firstNode = nodes[0];
    var lastNode = nodes[nodes.length - 1];
    if (ev.shiftKey && (doc.activeElement === firstNode || doc.activeElement === el.shade)) {
      ev.preventDefault();
      lastNode.focus();
    } else if (!ev.shiftKey && doc.activeElement === lastNode) {
      ev.preventDefault();
      firstNode.focus();
    }
  }

  /* ---------------------------------------------------------------------
     Eventi
     --------------------------------------------------------------------- */

  function bindEvents() {
    el.bar.addEventListener("pointerdown", onPointerDown);
    el.handle.addEventListener("pointerdown", onPointerDown);
    el.quick.addEventListener("pointerdown", onPointerDown);
    el.countdown.addEventListener("pointerdown", onPointerDown);
    el.cta.addEventListener("pointerdown", onPointerDown);
    el.pending.addEventListener("pointerdown", onPointerDown);

    el.ctaBtn.addEventListener("click", function () {
      if (el.cta.getAttribute("data-kind") === "install") CSBar.promptInstall();
      else requestNotificationPermission();
    });

    el.ctaClose.addEventListener("click", function () {
      var kind = el.cta.getAttribute("data-kind");
      if (kind) {
        state.ctaDismissed[kind] = true;
        save();
      }
      renderCta();
    });

    el.pendingBtn.addEventListener("click", function () {
      flushQueue();
    });

    el.quick.addEventListener("click", handleQuickClick);
    el.swatches.addEventListener("click", handleSwatchClick);
    el.swatches.addEventListener("pointerdown", onPointerDown);
    el.soundBtn.addEventListener("click", cycleSound);
    el.list.addEventListener("click", handleListClick, true);
    el.list.addEventListener("pointerdown", onSwipeDown);
    el.clear.addEventListener("click", clearAll);

    el.backdrop.addEventListener("click", function () {
      close();
    });

    el.center.addEventListener("click", function () {
      if (!state.locked) open();
    });

    el.ball.addEventListener("click", function (ev) {
      ev.stopPropagation();
      togglePop();
    });

    el.heads.addEventListener("pointerdown", onHeadsDown);
    el.headsBtn.addEventListener("click", function () {
      if (headsDrag.moved) return;
      var id = el.heads.getAttribute("data-notif");
      hideHeads();
      openNotification(findNotification(id));
    });

    el.cdAction.addEventListener("click", function () {
      var c = state.countdown;
      close();
      if (c && typeof c.onAction === "function") c.onAction();
    });

    el.presence.addEventListener("click", function () {
      buzz(10);
      if (typeof opts.onPresence === "function") opts.onPresence(CSBar.getPresence());
      else open();
    });

    el.settings.addEventListener("click", function () {
      buzz(12);
      if (typeof opts.onSettings === "function") opts.onSettings();
    });

    el.profile.addEventListener("click", function () {
      buzz(12);
      if (typeof opts.onProfile === "function") opts.onProfile();
    });

    doc.addEventListener("click", function (ev) {
      if (state.popOpen && !closestEl(ev.target, ".csb-ball-wrap")) togglePop(false);
    });

    doc.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        if (state.popOpen) togglePop(false);
        else if (state.open) close();
        else hideHeads();
      }
      trapFocus(ev);
    });

    global.addEventListener("resize", function () {
      if (state.open) setShadeY(0, false);
    });

    doc.addEventListener("visibilitychange", function () {
      if (doc.hidden) {
        flushSave();
        return;
      }
      tickClock();
      tickCountdown();
      syncFromStorage();
      renderList();
      if (state.popOpen) renderPop();
    });

    /* ultima occasione per salvare prima che la pagina venga chiusa */
    global.addEventListener("pagehide", flushSave);
    global.addEventListener("beforeunload", flushSave);

    /* allineamento fra più schede aperte dello stesso sito */
    global.addEventListener("storage", function (ev) {
      if (!opts.persist) return;
      if (ev.key && ev.key !== opts.storageKey) return;
      syncFromStorage();
    });

    /* stato della rete del browser */
    if (opts.watchNetwork) {
      global.addEventListener("offline", function () {
        setConnection("offline");
      });
      global.addEventListener("online", function () {
        setConnection("connecting");
        if (typeof opts.onSync === "function") opts.onSync();
        else setConnection("online");
      });
    }
  }

  /* ---------------------------------------------------------------------
     API pubblica
     --------------------------------------------------------------------- */

  var CSBar = {
    version: "5.3",

    init: function (userOptions) {
      if (state.mounted) return CSBar;
      var o = userOptions || {};
      for (var k in o) {
        if (Object.prototype.hasOwnProperty.call(o, k)) opts[k] = o[k];
      }

      state.baseTitle = doc.title;

      state.quickActions = (opts.quickActions || DEFAULT_QUICK).map(function (qa) {
        var type = qa.type || "toggle";
        if (type !== "action" && state.settings[qa.id] === undefined) {
          state.settings[qa.id] = qa.active !== false;
        }
        return { id: qa.id, label: qa.label, glyph: qa.glyph, type: type, onToggle: qa.onToggle };
      });

      loadStored();
      build();
      state.mounted = true;

      if (opts.persistTheme && state.settings.tema) setTheme(state.settings.tema);
      watchProjectTheme();
      onThemeChanged();

      renderQuick();
      renderPrefs();
      renderList();
      renderCenter();
      setConnection(state.connection);
      tickClock();
      bindEvents();

      renderCta();
      renderPending();
      setupServiceWorker();
      if (opts.installPrompt) setupInstall();
      if (opts.watchNetwork && global.navigator && global.navigator.onLine === false) {
        setConnection("offline");
      }

      if (opts.avatarUrl || opts.profileName) {
        CSBar.setProfile({ name: opts.profileName, avatarUrl: opts.avatarUrl });
      }
      return CSBar;
    },

    /* connessione */
    setConnection: setConnection,
    getConnection: function () { return state.connection; },
    setLastSync: function (date) {
      state.lastSync = date instanceof Date ? date : new Date(date);
      save();
      if (state.popOpen) renderPop();
    },

    /* notifiche */
    notify: notify,
    avvisa: avvisa,
    remove: removeNotification,
    clearAll: clearAll,
    markAllRead: markAllRead,
    getNotifications: function () { return state.notifications.slice(); },
    getUnreadCount: unreadCount,

    /* tutorial del gesto */
    playTutorial: function () { mostraTutorial(true); },
    resetTutorial: function () {
      state.settings.tutorial = null;
      save();
    },

    /* tema */
    setTheme: setTheme,
    getTheme: currentTheme,
    getThemes: function () { return THEME_ORDER.slice(); },

    /* suono delle notifiche */
    setSound: function (name, preview) { setSound(name, preview !== false); },
    getSound: currentSound,
    getSounds: function () { return SOUND_ORDER.slice(); },
    playSound: function () { blip(true); },

    /* coda offline */
    enqueueAction: enqueueAction,
    flush: flushQueue,
    getPending: function () { return state.pending.slice(); },
    clearPending: function () {
      state.pending = [];
      save();
      renderPending();
    },

    /* installazione come app e avvisi di sistema */
    canInstall: function () { return !!state.deferredInstall; },
    promptInstall: function () {
      if (!state.deferredInstall) return Promise.resolve("non disponibile");
      var ev = state.deferredInstall;
      state.deferredInstall = null;
      try {
        ev.prompt();
      } catch (e) {
        renderCta();
        return Promise.resolve("errore");
      }
      return Promise.resolve(ev.userChoice).then(function (choice) {
        renderCta();
        return choice && choice.outcome;
      });
    },
    requestNotificationPermission: requestNotificationPermission,
    notificationPermission: function () {
      return supportsNotifications() ? global.Notification.permission : "non supportato";
    },
    isInstalled: function () {
      try {
        return (
          global.matchMedia("(display-mode: standalone)").matches ||
          global.navigator.standalone === true
        );
      } catch (e) {
        return false;
      }
    },

    /* persone collegate */
    setPresence: setPresence,
    getPresence: function () {
      return state.presence ? state.presence.count : 0;
    },

    /* notifiche che richiedono un intervento manuale */
    resolveIntervention: resolveIntervention,
    getInterventions: interventiAperti,
    countInterventions: function () { return interventiAperti().length; },

    /* countdown e risorsa */
    setCountdown: setCountdown,
    clearCountdown: function () { setCountdown(null); },
    setCurrency: setCurrency,

    /* impostazioni dei tasti rapidi */
    getSetting: function (id) { return !!state.settings[id]; },
    setSetting: function (id, value) {
      state.settings[id] = !!value;
      save();
      if (state.mounted) renderQuick();
    },

    /* profilo */
    setProfile: function (profile) {
      if (!state.mounted) return;
      var p = profile || {};
      if (p.avatarUrl) {
        el.avatar.style.backgroundImage = 'url("' + p.avatarUrl + '")';
        el.avatar.textContent = "";
      } else {
        el.avatar.style.backgroundImage = "";
        el.avatar.textContent = initials(p.name);
      }
      if (p.name) el.profile.setAttribute("aria-label", "Profilo di " + p.name);
    },

    /* tendina */
    open: function () { if (!state.locked) open(); },
    close: function () { close(); },
    toggle: function () {
      if (state.locked) return;
      if (state.open) close();
      else open();
    },
    isOpen: function () { return state.open; },

    /* blocco durante l'apertura bustina */
    lock: function () {
      state.locked = true;
      if (state.open) close();
      hideHeads();
      if (state.mounted) el.bar.classList.add("is-locked");
    },
    unlock: function () {
      state.locked = false;
      if (state.mounted) el.bar.classList.remove("is-locked");
    },
    isLocked: function () { return state.locked; }
  };

  global.CSBar = CSBar;
})(window);

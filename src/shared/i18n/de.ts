import type { En } from './en'
import type { Messages } from './types'

// German. A draft by Claude (plan M10d): to be checked by a native speaker before a release.
// "Sie" throughout; AND / OR / NOT stay English (they're the search syntax).

export const de: Messages<En> = {
  common: {
    ok: 'OK',
    cancel: 'Abbrechen',
    save: 'Speichern',
    close: 'Schließen',
    delete: 'Löschen',
    yes: 'Ja',
    no: 'Nein',
    none: 'Keine'
  },
  menu: {
    file: {
      title: 'Datei',
      new: 'Neu…',
      open: 'Öffnen…',
      openRecent: 'Zuletzt geöffnet',
      recentEmpty: '(leer)',
      saveAs: 'Speichern unter…',
      importJson: 'Altes JSON importieren…',
      export: 'Exportieren',
      exportCsv: 'CSV…',
      exportJson: 'JSON…',
      exportMarkdown: 'Markdown…',
      about: 'Über Review Assistant',
      exit: 'Beenden'
    },
    edit: {
      undo: 'Rückgängig',
      undoWhat: 'Rückgängig: {what}',
      redo: 'Wiederholen',
      redoWhat: 'Wiederholen: {what}',
      cut: 'Ausschneiden',
      copy: 'Kopieren',
      paste: 'Einfügen',
      selectAll: 'Alles auswählen'
    },
    settings: {
      title: 'Einstellungen',
      preferences: 'Optionen…',
      plugins: 'Plugins…'
    }
  },
  app: {
    title: 'Review Assistant',
    titleWithFile: '{name} – Review Assistant',
    loadFailed: 'Die Datei konnte nicht geladen werden: {error}'
  },
  status: {
    rows: { one: '{count} Zeile', other: '{count} Zeilen' },
    rowsShown: {
      one: '{shown} von {count} Zeile angezeigt',
      other: '{shown} von {count} Zeilen angezeigt'
    },
    checked: { one: '{count} markiert', other: '{count} markiert' },
    showInFolder: 'Im Ordner anzeigen',
    dismiss: 'Ausblenden',
    claudeReading: 'Claude Desktop liest…'
  },
  notices: {
    failed: '{what} fehlgeschlagen: {reason}',
    exported: {
      one: '{count} Zeile nach {name} exportiert',
      other: '{count} Zeilen nach {name} exportiert'
    },
    undid: 'Änderung an {column} rückgängig gemacht ({row})',
    redid: 'Änderung an {column} wiederholt ({row})',
    undoMissing:
      'Die Änderung an {column} kann nicht rückgängig gemacht werden: Diese Option wurde entfernt',
    redoMissing:
      'Die Änderung an {column} kann nicht wiederholt werden: Diese Option wurde entfernt',
    dictionaryFailed:
      'Das Wörterbuch für {language} konnte nicht heruntergeladen werden (offline?), daher wird {language} vorerst nicht geprüft. Beim nächsten Start der App wird es erneut versucht.'
  },
  actions: {
    saveAs: 'Speichern unter',
    importing: 'Importieren',
    exporting: 'Exportieren',
    openingFile: 'Öffnen der Datei',
    showingFile: 'Anzeigen der Datei',
    addingRow: 'Hinzufügen einer Zeile',
    savingView: 'Speichern der Ansicht',
    savingCell: 'Speichern der Zelle',
    savingColumnWidth: 'Speichern der Spaltenbreite',
    reorderingColumns: 'Neuordnen der Spalten',
    savingRowHeight: 'Speichern der Zeilenhöhe',
    savingCheckboxes: 'Speichern der Markierungen',
    savingSearchBar: 'Speichern der Suchleisten-Einstellung',
    savingSort: 'Speichern der Sortierung',
    savingActiveTab: 'Speichern des aktiven Tabs'
  },
  undo: {
    editTo: 'Änderung an {column}',
    rowN: 'Zeile {n}'
  },
  welcome: {
    subtitle: 'Erstellen Sie ein neues Review oder öffnen Sie eines.',
    new: 'Neues Review',
    import: 'Datei aus der alten App importieren (.json)…',
    recent: 'Zuletzt geöffnet'
  },
  about: {
    description:
      'Ein Werkzeug zum Durchsehen und Auswerten Ihrer Notizen. Entwickelt für die Begutachtung wissenschaftlicher Artikel und Subgruppenanalysen.',
    version: 'Version',
    system: 'System',
    settingsFolder: 'Einstellungsordner',
    logFiles: 'Protokolldateien',
    openSettings: 'Einstellungsordner öffnen',
    openLogs: 'Protokolle öffnen',
    copy: 'Details kopieren',
    copied: 'Kopiert',
    dictionaries:
      'Rechtschreibwörterbücher: SCOWL (Englisch), igerman98 (Deutsch), Dicollecte (Französisch) und RLA-ES (Spanisch), unter ihren eigenen Lizenzen (LGPL, MPL, GPL und BSD-artig); siehe LICENSES.md im Installationsordner unter resources\\app.asar.unpacked\\resources\\dictionaries.'
  },
  table: {
    headerTooltip: '{name}: Klicken zum Sortieren, Ziehen zum Verschieben',
    insertColumnBefore: 'Spalte davor einfügen',
    insertColumnAfter: 'Spalte danach einfügen',
    editColumn: 'Bearbeiten…',
    deleteColumn: 'Löschen…',
    clearFiltersLabel: 'Filter und Suche zurücksetzen',
    clearFiltersTooltip: 'Alle Filter und die Suche zurücksetzen',
    checkAllLabel: 'Alle in diesem Tab angezeigten Zeilen markieren',
    checkAll: 'Alle markieren',
    uncheckAll: 'Alle Markierungen aufheben',
    rowTooltip: 'Rechtsklick für Zeilenoptionen',
    checkRow: 'Zeile markieren',
    resizeRow: 'Ziehen, um die Zeilenhöhe zu ändern',
    numberTooltip: 'Ganze Zahl von {min} bis {max}; ↑/↓ zum Ändern',
    newTab: 'Neuer Tab…',
    insertRowAbove: 'Zeile darüber einfügen',
    insertRowBelow: 'Zeile darunter einfügen',
    addRowTo: 'Zeile hinzufügen zu…',
    addCheckedTo: {
      one: 'Markierte Zeilen ({count}) hinzufügen zu…',
      other: 'Markierte Zeilen ({count}) hinzufügen zu…'
    },
    deleteRow: 'Zeile löschen',
    deleteChecked: {
      one: 'Markierte Zeilen löschen ({count})',
      other: 'Markierte Zeilen löschen ({count})'
    },
    removeRow: 'Zeile entfernen',
    removeChecked: {
      one: 'Markierte Zeilen entfernen ({count})',
      other: 'Markierte Zeilen entfernen ({count})'
    },
    actions: {
      addingToTab: 'Hinzufügen zum Tab',
      insertingRow: 'Einfügen einer Zeile',
      removingRow: 'Entfernen der Zeile',
      removingRows: 'Entfernen der Zeilen'
    }
  },
  columns: {
    types: {
      text: 'Text (mehrzeilig)',
      dropdown: 'Auswahlliste',
      checkbox: 'Kontrollkästchen',
      date: 'Datum',
      number: 'Zahl'
    },
    defaultName: 'Neue Spalte',
    nameEmpty: 'Der Spaltenname darf nicht leer sein.',
    needOption: 'Bitte fügen Sie der Auswahlliste mindestens eine Option hinzu.',
    optionEmpty: 'Optionen dürfen nicht leer sein.',
    optionsDiffer: 'Jede Option muss anders sein.',
    wholeNumbers: 'Minimum und Maximum müssen ganze Zahlen sein.',
    limits: 'Die Grenzen müssen innerhalb von ±{limit} liegen.',
    minAboveMax: 'Der Mindestwert darf nicht größer als der Höchstwert sein.',
    newTitle: 'Neue Spalte',
    editTitle: 'Spalteneinstellungen',
    description: 'Name, Typ und Optionen dieser Spalte.',
    name: 'Spaltenname',
    type: 'Spaltentyp',
    options: 'Optionen',
    newOption: 'Neue Option…',
    add: 'Hinzufügen',
    min: 'Mindestwert',
    max: 'Höchstwert',
    preview:
      'Ändern von {from} zu {to}: {converted}, {cleared}{empty}. Vorher wird eine Sicherung erstellt.',
    converts: { one: '{count} Wert wird umgewandelt', other: '{count} Werte werden umgewandelt' },
    willBeCleared: { one: '{count} wird geleert', other: '{count} werden geleert' },
    alreadyEmpty: { one: ', {count} bereits leer', other: ', {count} bereits leer' },
    changeType: 'Typ ändern',
    noOptions: 'Noch keine Optionen.',
    dragToReorder: 'Ziehen zum Umsortieren',
    optionN: 'Option {n}',
    removeOption: '{name} entfernen'
  },
  deleteColumn: {
    title: 'Spalte „{name}“ löschen?',
    body: 'Dadurch werden die Spalte und alle ihre Daten endgültig gelöscht. Vorher wird eine Sicherung der Datei erstellt.'
  },
  deleteRows: {
    deleting: 'Löschen der Zeilen',
    checking: 'Prüfen der Tab-Zugehörigkeit',
    title: { one: '{count} Zeile löschen?', other: '{count} Zeilen löschen?' },
    inTabs: { one: '{count} Zeile ist in {tabs}.', other: '{count} Zeilen sind in {tabs}.' },
    tabs: { one: '{count} Tab', other: '{count} Tabs' },
    body: {
      one: 'Beim Löschen wird sie aus der Haupttabelle und jedem Tab entfernt. Vorher wird eine Sicherung der Datei erstellt.',
      other:
        'Beim Löschen werden sie aus der Haupttabelle und jedem Tab entfernt. Vorher wird eine Sicherung der Datei erstellt.'
    }
  },
  filter: {
    label: '{name} filtern',
    any: 'Alle',
    checked: 'Angehakt',
    unchecked: 'Nicht angehakt',
    placeholder: 'Filtern…',
    helpText:
      'Alle Wörter müssen vorkommen. "genaue Phrase", a OR b, a NOT b, (…), schwimm*. Groß-/Kleinschreibung egal.',
    helpNumber:
      'Vergleichen: >2015, >=2015, <2020, <=2020, 2010..2020 (einschließlich). Anderer Text: enthält.',
    helpDate:
      'Vergleichen: >2019, <2020-06, 2019..2020 (ganze Jahre/Monate zählen). Anderer Text: enthält.'
  },
  tabs: {
    main: 'Haupttabelle',
    allRows: 'Alle Zeilen',
    tooltip: '{name} ({rows})',
    close: '{name} schließen',
    editMenu: 'Tab bearbeiten…',
    new: 'Neuer Tab',
    reordering: 'Neuordnen der Tabs',
    deleting: 'Löschen des Tabs',
    deleteTitle: '{name} löschen?',
    deleteBody:
      'Möchten Sie {name} wirklich löschen? Seine Zeilen bleiben in der Haupttabelle erhalten.',
    nothingToUndo: 'Nichts rückgängig zu machen',
    nothingToRedo: 'Nichts zu wiederholen',
    defaultName: 'Tab {n}',
    nameEmpty: 'Der Tab-Name darf nicht leer sein.',
    nameTaken: 'Ein Tab namens „{name}“ existiert bereits.',
    newTitle: 'Neuer Tab',
    editTitle: 'Tab bearbeiten',
    startsWith: { one: 'Beginnt mit {count} Zeile.', other: 'Beginnt mit {count} Zeilen.' },
    description: 'Ein Tab zeigt eine ausgewählte Gruppe von Zeilen aus der Haupttabelle.',
    name: 'Name',
    type: 'Typ',
    types: { review: 'Review-Tabelle', synthesis: 'Synthese' }
  },
  search: {
    button: 'Suchen',
    showTooltip: 'Suchen (Strg+F)',
    hideTooltip: 'Suche ausblenden (Strg+F)',
    label: 'Diesen Tab durchsuchen',
    placeholder: 'Suchen…  z. B. pacing "elite junior" NOT cycling',
    help: 'Durchsucht jede Spalte dieses Tabs. Alle Wörter müssen vorkommen (irgendwo).\n"genaue Phrase"   ·   a OR b   ·   a NOT b   ·   (a OR b) AND c   ·   schwimm* (schwimmen, Schwimmer…)\nAND / OR / NOT gelten nur in GROSSBUCHSTABEN. Groß-/Kleinschreibung egal.',
    clear: 'Suche löschen'
  },
  synthesis: {
    title: 'Synthese-Tab',
    body: {
      one: 'Dieser Tab hat {count} Zeile. Die Synthese-Ansicht kommt in einer späteren Version.',
      other: 'Dieser Tab hat {count} Zeilen. Die Synthese-Ansicht kommt in einer späteren Version.'
    },
    hint: 'Klicken Sie mit der rechten Maustaste auf den Tab und wählen Sie „Tab bearbeiten“, um ihn wieder zu einer Review-Tabelle zu machen.'
  },
  markdownExport: {
    title: 'Nach Markdown exportieren',
    loading: 'Wird geladen…',
    description:
      'Eine Notiz pro Zeile, z. B. für einen Obsidian-Vault. Notizen im Ordner werden nie gelöscht.',
    skipped: { one: '{count} übersprungen', other: '{count} übersprungen' },
    failed: { one: '{count} fehlgeschlagen', other: '{count} fehlgeschlagen' },
    done: {
      one: '{count} Notiz{counts} nach {folder} exportiert',
      other: '{count} Notizen{counts} nach {folder} exportiert'
    },
    notWritten: {
      one: '{count} konnte nicht geschrieben werden. Erstes Problem: {error}',
      other: '{count} konnten nicht geschrieben werden. Erstes Problem: {error}'
    },
    rows: 'Zeilen',
    scopeChecked: { one: 'Markierte Zeilen ({count})', other: 'Markierte Zeilen ({count})' },
    scopeMain: {
      one: 'Aktueller Tab – {count} angezeigt',
      other: 'Aktueller Tab – {count} angezeigt'
    },
    scopeTab: {
      one: 'Aktueller Tab ({name}) – {count} angezeigt',
      other: 'Aktueller Tab ({name}) – {count} angezeigt'
    },
    scopeAll: { one: 'Alles ({count})', other: 'Alles ({count})' },
    folder: 'Zielordner',
    noFolder: 'Kein Ordner gewählt',
    choose: 'Auswählen…',
    ifExistsLabel: 'Wenn eine Notiz schon existiert',
    ifExists: {
      ours: 'Nur von dieser App erstellte Notizen überschreiben',
      skip: 'Überspringen',
      overwrite: 'Überschreiben'
    },
    columns: 'Spalten',
    column: 'Spalte',
    exportAs: 'Exportieren als',
    property: 'Eigenschaftsname',
    fileName: 'Dateiname',
    modes: { property: 'Eigenschaft', section: 'Abschnitt', skip: 'Weglassen' },
    exportColumnAs: '{name} exportieren als',
    propertyFor: 'Eigenschaftsname für {name}',
    nameAfter: 'Notizen nach {name} benennen',
    extra: 'Weitere Eigenschaften',
    tagsFromTabs: '{tags} aus den Tabs, in denen eine Zeile ist',
    extraTagsLabel: 'Weitere Tags',
    extraTagsPlaceholder: 'Weitere Tags, durch Kommas getrennt (z. B. review/2026, lesen)',
    header: 'Text am Anfang jeder Notiz',
    headerPlaceholder: 'Optionales Markdown, z. B. #review oder ein Link wie [[Schwimm-Review]]',
    preview: 'Vorschau',
    noRows: 'Keine Zeilen in dieser Auswahl.',
    exporting: 'Wird exportiert…',
    exportN: { one: '{count} Notiz exportieren', other: '{count} Notizen exportieren' }
  },
  preferences: {
    title: 'Optionen',
    description: 'Diese gelten für alle Reviews.',
    language: 'Sprache',
    languageSystem: 'System',
    languageRestart: 'Manche Teile ändern sich erst nach einem Neustart.',
    theme: 'Design',
    themes: { system: 'System', light: 'Hell', dark: 'Dunkel' },
    markdownColour: 'Markdown-Farbe',
    searchHighlight: 'Suchtreffer-Farbe',
    spellcheck: 'Rechtschreibprüfung',
    spellcheckN: 'Prüfsprache {n}',
    spellcheckOff: 'Keine (Rechtschreibprüfung aus)',
    spellcheckOffline: '{name} · offline',
    spellcheckHint:
      'Bis zu drei Sprachen; ein Wort gilt als richtig, wenn eine davon es kennt. Die als offline markierten sind in der App enthalten, andere werden einmalig heruntergeladen. In Windows installierte Sprachen prüft eventuell Windows selbst.',
    hotkeys: 'Tastenkürzel',
    reset: 'Auf Standard zurücksetzen',
    resetTitle: 'Auf Standard zurücksetzen?',
    resetBody:
      'Sprache, Design, Markdown-Farben (samt Überschreiben), Prüfsprachen, Tastenkürzel sowie Anbieter und Modelle des Assistenten werden auf ihre Standardwerte zurückgesetzt (ein gespeicherter API-Schlüssel bleibt erhalten). Gespeichert wird erst, wenn Sie auf Speichern klicken.',
    resetButton: 'Zurücksetzen',
    kinds: {
      h1: '# Überschrift 1',
      h2: '## Überschrift 2',
      h3: '### Überschrift 3',
      h4: '#### Überschrift 4',
      h5: '##### Überschrift 5',
      h6: '###### Überschrift 6',
      bold: '**Fett**',
      italic: '*Kursiv*',
      strike: '~~Durchgestrichen~~',
      list: '- / 1. Listenzeichen',
      task: '- [ ] Aufgabe (und Kontrollkästchen)',
      code: '`Inline-Code`',
      quote: '> Zitat',
      link: '[Link](url)',
      rule: '--- Linie, <br>'
    },
    setByTheme: 'Vom Design {name} festgelegt',
    override: 'Designfarbe überschreiben',
    perElement: 'Farben pro Element',
    kindColour: 'Farbe für {name}',
    useMain: 'Die Haupt-Markdown-Farbe verwenden',
    highlightSample: 'Pacing beim {hit}',
    highlightSampleHit: 'Leistungsschwimmen',
    pressKeys: 'Tastenkombination drücken…'
  },
  assistantSettings: {
    keyRemoved: 'Wird beim Speichern entfernt',
    keySaved: 'Gespeichert (zum Ersetzen tippen)',
    keyPaste: 'API-Schlüssel einfügen',
    provider: 'Anbieter',
    providers: {
      openrouter: 'OpenRouter',
      anthropic: 'Anthropic (Claude)',
      openai: 'OpenAI-kompatibel',
      ollama: 'Ollama (auf diesem Computer)'
    },
    address: 'Adresse',
    key: 'API-Schlüssel',
    remove: 'Entfernen',
    testing: 'Wird getestet…',
    test: 'Testen',
    checking: 'Wird geprüft…',
    models: 'Modelle',
    fallback: 'Kontext, falls unbekannt',
    thousandTokens: 'tausend Token',
    showMeter: 'Token-Anzeige einblenden',
    showCosts: 'Kosten anzeigen (wenn der Anbieter Preise nennt)',
    refresh: 'Aktualisieren',
    load: 'Modelle laden',
    useSuggested: 'Vorschläge übernehmen',
    usingSuggested: 'Die vorgeschlagenen Modelle werden verwendet, bis Sie welche auswählen.',
    searchModels: 'Modelle durchsuchen',
    searchN: { one: '{count} Modell durchsuchen…', other: '{count} Modelle durchsuchen…' },
    default: 'Standard',
    priceTooltip: 'USD pro Million Token, Eingabe / Ausgabe',
    price: '$/1 Mio. ein · aus',
    context: 'Kontext',
    enable: '{name} aktivieren',
    makeDefault: '{name} zum Standard machen'
  },
  claudeDesktop: {
    notConnected: 'Nicht verbunden',
    off: 'Aus: Es wartet nichts auf Verbindungen.',
    waiting: 'An: Warte auf Claude Desktop.',
    read: {
      one: 'An: Claude hat das Review {count}-mal gelesen (zuletzt um {time}).',
      other: 'An: Claude hat das Review {count}-mal gelesen (zuletzt um {time}).'
    },
    title: 'Mit Claude Desktop verbinden',
    description:
      'Sprechen Sie in Claude Desktop über Ihr Review – mit Ihrem eigenen Claude-Abo statt eines API-Schlüssels. Claude kann die Tabs auflisten und die Zeilen des hier geöffneten Reviews lesen oder durchsuchen. Ändern kann es nichts.',
    switch: 'Claude Desktop das geöffnete Review lesen lassen',
    turnsOn: 'Wird beim Speichern eingeschaltet.',
    turnsOff: 'Wird beim Speichern ausgeschaltet.',
    saving: 'Wird gespeichert…',
    saveButton: 'Erweiterung für Claude Desktop speichern…',
    saved:
      'Gespeichert. Doppelklicken Sie auf die Datei (oder ziehen Sie sie in Claude Desktop), um sie zu installieren. Das ist nur einmal nötig.',
    setup:
      'Einmalige Einrichtung: Speichern Sie die Erweiterung und doppelklicken Sie darauf, um sie in Claude Desktop zu installieren.'
  },
  plugins: {
    title: 'Plugins',
    description: 'Designs und Plugins gelten für alle Reviews.',
    defaultTheme: 'Standard',
    fromVault: '{name} (Vault)',
    addTheme: 'Design hinzufügen…',
    vaultReadOnly: 'Designs aus Ihrem Vault werden hier nicht verändert',
    vault: 'Vault',
    noVault: 'Keiner: Wählen Sie einen Obsidian-Vault, um seine Designs zu nutzen',
    vaultMissing: '(sein .obsidian-Ordner fehlt)',
    clear: 'Entfernen',
    coloursOnly:
      'Es werden nur die Farben eines Designs verwendet. Hell oder Dunkel wählen Sie in den Optionen.',
    openThemes: 'Design-Ordner öffnen',
    openPlugins: 'Plugin-Ordner öffnen',
    deleteTheme: 'Design „{name}“ löschen?',
    deletePlugin: 'Plugin „{name}“ löschen?',
    recycleBin: 'Sein Ordner wird in den Papierkorb verschoben.',
    backToDefault: 'Die App wechselt zurück zum Standard-Design.',
    none: 'Keine Plugins installiert. Plugins gibt es noch nicht; Community-Plugins werden hier aufgelistet.',
    author: 'Autor',
    descriptionColumn: 'Beschreibung',
    enabled: 'Aktiviert'
  },
  assistant: {
    thisTab: { one: 'Dieser Tab ({count} Zeile)', other: 'Dieser Tab ({count} Zeilen)' },
    toggling: 'Ein- oder Ausschalten des Assistenten',
    savingWidth: 'Speichern der Bereichsbreite',
    savingModel: 'Speichern des Modells',
    clearing: 'Leeren des Chats',
    label: 'Assistent',
    resize: 'Größe des Assistenten-Bereichs ändern',
    model: 'Modell',
    noModels: 'Keine Modelle aktiviert',
    defaultModel: '{name} (Standard)',
    newChat: 'Neuer Chat',
    newChatTooltip: 'Das Gespräch dieses Tabs löschen und neu beginnen',
    close: 'Assistenten schließen',
    stale: '{old} ist nicht mehr aktiviert; {now} wird verwendet.',
    chooseModels: 'Wählen Sie Modelle unter Einstellungen → Optionen → Assistent.',
    checking: 'Der Schlüssel des Assistenten wird geprüft…',
    readOnly: '{reason} Das Gespräch ist schreibgeschützt.',
    unavailableSentence: 'Der Assistent ist nicht verfügbar.',
    long: {
      one: 'Dieses Gespräch ist lang: Die älteste {count} Nachricht wird nicht mehr mitgesendet. Ein {newChat} wird empfohlen.',
      other:
        'Dieses Gespräch ist lang: Die ältesten {count} Nachrichten werden nicht mehr mitgesendet. Ein {newChat} wird empfohlen.'
    },
    newChatLink: 'neuer Chat',
    unavailablePlaceholder: 'Der Assistent ist nicht verfügbar',
    placeholder: 'Fragen Sie etwas zu diesem Tab…',
    meterTooltip:
      'Geschätzte Token, die mit der nächsten Nachricht gesendet werden (etwa 4 Zeichen pro Token), von dem, was das Modell aufnimmt',
    meter: '~{used} / {limit} Token',
    oldestNotSent: {
      one: 'älteste {count} nicht gesendet',
      other: 'älteste {count} nicht gesendet'
    },
    nextCostTooltip: 'Geschätzte Eingabekosten der nächsten Nachricht',
    nextCost: '~{cost} nächste',
    costEstimated: 'Die Kosten mancher Antworten sind geschätzt oder unbekannt',
    costReported: 'Wie vom Anbieter gemeldet',
    tabCost: '{cost} dieser Tab',
    stop: 'Stopp',
    send: 'Senden',
    clearTitle: 'Neuen Chat beginnen?',
    clearBody:
      'Dadurch werden das Gespräch in „{name}“ und seine laufenden Kosten gelöscht. Ihre Zeilen sind davon nicht betroffen.',
    filesReferenced: {
      one: '{count} Datei angehängt: {names}',
      other: '{count} Dateien angehängt: {names}'
    },
    empty:
      'Fragen Sie zu den Zeilen in diesem Tab. Der Assistent kann sie lesen, ändert sie aber nie.',
    thinking: 'Denkt nach…',
    attachTooltip: '.txt-, .md- oder .pdf-Dateien an die nächste Nachricht anhängen',
    rowsChipTooltip:
      'Die in diesem Tab angezeigten Zeilen (nach Filtern), mit allen Spalten. Entfernen Sie dies, um sie bei der nächsten Nachricht wegzulassen.',
    addThisTab: 'Dieser Tab',
    fileTooltip: '{name} · ~{tokens} Token',
    message: 'Nachricht',
    hide: 'Assistent für diesen Tab ausblenden ({key})',
    show: 'Assistent für diesen Tab einblenden ({key})',
    image: '[Bild]',
    imageAlt: '[Bild: {alt}]'
  },
  editMenu: {
    noSuggestions: 'Keine Vorschläge',
    addToDictionary: 'Zum Wörterbuch hinzufügen'
  },
  files: {
    filterReview: 'Review-Dateien',
    filterOldJson: 'Dateien des alten Review Assistant',
    filterReviewOrJson: 'Review-Dateien (und alte .json)',
    filterKind: '{what}-Dateien',
    newTitle: 'Neues Review',
    untitled: 'Unbenannt',
    openTitle: 'Review öffnen',
    saveAsTitle: 'Speichern unter',
    copyName: '{name} Kopie',
    saveOnlyChecked: 'Nur markierte Zeilen speichern?',
    exportTitle: 'Als {what} exportieren',
    exportOnlyChecked: 'Nur markierte Zeilen exportieren?',
    checkedOfTotal: {
      one: '{count} von {total} Zeilen ist markiert.',
      other: '{count} von {total} Zeilen sind markiert.'
    },
    importTitle: 'Altes JSON importieren',
    importSaveTitle: 'Importiertes Review speichern unter',
    markdownFolderTitle: 'Notizen in Ordner exportieren'
  },
  errors: {
    unexpected: 'Unerwarteter Fehler: {message}',
    fileNotFound: 'Datei nicht gefunden:\n{path}',
    notAReviewFile: 'Keine Review-Datei:\n{path}',
    couldNotCreate: 'Die Review-Datei konnte nicht erstellt werden',
    couldNotOpen: 'Die Review-Datei konnte nicht geöffnet werden',
    couldNotOpenFile: 'Die Datei konnte nicht geöffnet werden',
    couldNotReopen: 'Die zuletzt geöffnete Review-Datei konnte nicht wieder geöffnet werden',
    couldNotSaveCopy: 'Es konnte keine Kopie gespeichert werden',
    couldNotImport: 'Die Datei konnte nicht importiert werden',
    couldNotExport: 'Die Datei konnte nicht exportiert werden',
    couldNotExportNotes: 'Die Notizen konnten nicht exportiert werden',
    sameAsOpen: 'Das ist die bereits geöffnete Datei. Wählen Sie einen anderen Namen.',
    sameAsImported: 'Das ist die JSON-Datei, die importiert wird. Wählen Sie einen anderen Namen.',
    fileIsOpen: 'Diese Datei ist geöffnet. Wählen Sie einen anderen Namen.',
    sameAsOpenReview: 'Das ist die geöffnete Review-Datei. Wählen Sie einen anderen Namen.',
    chooseFolderFirst: 'Wählen Sie zuerst einen Zielordner.',
    folderGone: 'Der Zielordner existiert nicht mehr:\n{path}',
    newerVersion:
      'Diese Datei wurde mit einer neueren Version von Review Assistant gespeichert. Bitte aktualisieren Sie die App.',
    sqliteNotReview: 'Dies ist eine SQLite-Datenbank, aber keine Review-Datei.',
    notReview: 'Diese Datei ist keine Review-Datei.',
    notJson: 'Diese Datei ist kein gültiges JSON.',
    notOldJson:
      'Diese JSON-Datei wurde nicht vom alten Review Assistant gespeichert (sie braucht "columns" und "rows").',
    crashed: 'Review Assistant ist abgestürzt',
    lateEdit: 'Änderung nicht gespeichert: Es wurde eine andere Datei geöffnet, bevor sie ankam',
    columnExists: 'Eine Spalte namens „{name}“ existiert bereits',
    tabExists: 'Ein Tab namens „{name}“ existiert bereits'
  },
  addons: {
    themeMissing: 'Dieses Design ist nicht installiert',
    addTitle: 'Ein Obsidian-Design hinzufügen',
    themeFilter: 'Obsidian-Design',
    replaceTitle: 'Design ersetzen?',
    replaceMessage: 'Ein Design namens „{name}“ ist bereits installiert. Ersetzen?',
    replace: 'Ersetzen',
    addFailed: 'Das Design konnte nicht hinzugefügt werden',
    vaultThemeDelete: 'Designs aus einem Vault können hier nicht gelöscht werden',
    vaultTitle: 'Ihren Obsidian-Vault auswählen',
    notVault: 'Kein Obsidian-Vault',
    notVaultDetail:
      'Dieser Ordner hat keinen .obsidian-Ordner. Wählen Sie den Vault-Ordner selbst.',
    pluginMissing: 'Dieses Plugin ist nicht installiert',
    pluginInvalid: 'Dieses Plugin hat kein gültiges Manifest',
    noThemeColours:
      'Diese Datei enthält keine Designfarben (CSS-Variablen auf body, .theme-light oder .theme-dark).',
    noManifest: 'Keine manifest.json',
    invalidManifest: 'Ungültiges Manifest'
  },
  assistantMain: {
    noKey: 'Kein API-Schlüssel. Legen Sie einen unter Einstellungen → Optionen fest.',
    checkFailed: 'Schlüsselprüfung fehlgeschlagen: {reason}',
    connected: 'Verbunden',
    unavailable: 'Der Assistent ist nicht verfügbar',
    attachTitle: 'Dateien anhängen',
    attachFilter: 'Text, Markdown oder PDF',
    attachFailed: {
      one: 'Eine Datei konnte nicht angehängt werden',
      other: 'Einige Dateien konnten nicht angehängt werden'
    },
    otherFile: 'Inzwischen ist eine andere Datei geöffnet',
    stillReplying: 'Der Assistent antwortet in diesem Tab noch',
    fileGone: 'Eine angehängte Datei ist nicht mehr verfügbar. Hängen Sie sie erneut an.',
    tooLarge:
      'Diese Nachricht ist zu groß für das Modell. Entfernen Sie den Tab-Chip oder einige Dateien oder wählen Sie ein Modell mit größerem Kontext.',
    stopped: 'Gestoppt',
    emptyReply: 'Die Antwort war leer',
    noSafeStorage:
      'Dieser Computer kann den Schlüssel nicht sicher speichern, daher wurde er nicht gespeichert'
  },
  providers: {
    noKey: 'Kein API-Schlüssel gespeichert',
    keyRefused: 'Der Schlüssel wurde abgelehnt',
    noCredit: 'Das Konto hat kein Guthaben mehr',
    tooMany: 'Zu viele Anfragen; bitte gleich noch einmal versuchen',
    answered: 'Der Anbieter antwortete mit {status}',
    unreachable: '{host} ist nicht erreichbar',
    emptyBody: 'Der Anbieter hat eine leere Antwort gesendet',
    reportedError: 'Der Anbieter hat einen Fehler gemeldet',
    notAllowed: 'Dieser Schlüssel darf dieses Modell nicht verwenden',
    noSuchModel: 'Anthropic bietet dieses Modell nicht an',
    overloaded: 'Claude ist überlastet; bitte gleich noch einmal versuchen',
    anthropicAnswered: 'Anthropic antwortete{status}',
    declined:
      'Claude hat die Antwort darauf abgelehnt{why}. Versuchen Sie, die Frage anders zu formulieren.'
  },
  attachments: {
    wrongType: 'nur .txt-, .md- und .pdf-Dateien',
    tooBig: 'größer als 20 MB',
    noText: 'kein Text gefunden (ein gescanntes PDF?)',
    notUtf8: 'kein UTF-8-Text'
  },
  import: {
    completeTitle: 'Import abgeschlossen',
    completeMessage: '{rows}, {columns} und {tabs} importiert.',
    rows: { one: '{count} Zeile', other: '{count} Zeilen' },
    columns: { one: '{count} Spalte', other: '{count} Spalten' },
    tabs: { one: '{count} Tab', other: '{count} Tabs' },
    savedAs: 'Gespeichert als {path}',
    changes: 'Beim Import vorgenommene Änderungen:',
    typeNames: {
      text: 'Text',
      dropdown: 'Auswahlliste',
      checkbox: 'Kontrollkästchen',
      date: 'Datum',
      number: 'Zahl'
    },
    width: '„{label}“: Breite von {from} px auf {to} px geändert.',
    unknownType: '„{label}“: unbekannter Typ „{type}“, als Text importiert.',
    emptyDropdown: '„{label}“: eine Auswahlliste ohne Optionen, als Text importiert.',
    addedOptions: {
      one: '„{label}“: {count} in Zeilen verwendete Option hinzugefügt: {options}.',
      other: '„{label}“: {count} in Zeilen verwendete Optionen hinzugefügt: {options}.'
    },
    swapped: '„{label}“: Minimum und Maximum waren vertauscht und wurden getauscht.',
    widened: '„{label}“: Bereich von {min}–{max} auf {lo}–{hi} erweitert, damit die Werte passen.',
    columnRenamed: 'Spalte „{from}“ in „{to}“ umbenannt.',
    strayValues: 'Werte unter „{name}“ (keine Spalte) wurden nicht importiert.',
    cleared: {
      one: '„{label}“: {count} Wert, der nicht in eine Spalte vom Typ {type} passte, wurde leer gelassen.',
      other:
        '„{label}“: {count} Werte, die nicht in eine Spalte vom Typ {type} passten, wurden leer gelassen.'
    },
    tallRows: {
      one: '{count} Zeile höher als {max} px auf {max} px gesetzt.',
      other: '{count} Zeilen höher als {max} px auf {max} px gesetzt.'
    },
    tabRenamed: 'Tab „{from}“ in „{to}“ umbenannt.',
    missingRows: {
      one: 'Tab „{label}“: {count} nicht mehr vorhandene Zeile übersprungen.',
      other: 'Tab „{label}“: {count} nicht mehr vorhandene Zeilen übersprungen.'
    }
  },
  hotkeys: {
    names: {
      newRow: 'Neue Zeile',
      newColumn: 'Neue Spalte',
      saveAs: 'Speichern unter',
      toggleAssistant: 'Assistent ein/aus'
    },
    fixed: {
      open: 'Öffnen',
      preferences: 'Optionen',
      selectAll: 'Alles auswählen',
      copy: 'Kopieren',
      cut: 'Ausschneiden',
      paste: 'Einfügen',
      undo: 'Rückgängig',
      redo: 'Wiederholen',
      search: 'Suchen',
      closeWindow: 'Fenster schließen',
      menus: 'die Menüs (Alt + Anfangsbuchstabe eines Menüs, in jeder Sprache der App)'
    },
    useKey: 'Einen Buchstaben, eine Ziffer oder eine F-Taste verwenden',
    addModifier: '{key} oder Alt hinzunehmen',
    usedBy: 'Bereits belegt durch {what}',
    resetTitle: 'Tastenkürzel geändert',
    resetMessage: {
      one: 'Ein Tastenkürzel wurde zurückgesetzt',
      other: 'Einige Tastenkürzel wurden zurückgesetzt'
    },
    resetLine: '{name}: {key} ist jetzt belegt durch {usedBy}, daher gilt wieder {now}.',
    resetHint: 'Sie können unter Einstellungen > Optionen ein anderes wählen.'
  },
  claudeDesktopMain: {
    title: 'Claude Desktop',
    scriptMissing: 'Das Claude-Desktop-Skript fehlt in diesem Build.',
    scriptMissingHint: 'Führen Sie „npm run build:mcp“ aus und versuchen Sie es erneut.',
    saveTitle: 'Erweiterung für Claude Desktop speichern',
    fileName: 'Review Assistant',
    filter: 'Claude-Desktop-Erweiterung',
    saveFailed: 'Die Erweiterung konnte nicht gespeichert werden.',
    inUse: 'Wird von einer anderen Instanz von Review Assistant verwendet.',
    couldNotStart: 'Start nicht möglich: {reason}'
  }
}

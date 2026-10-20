// The app's own text in English: the source of truth (plan M10d). de.ts, fr.ts and es.ts
// must have exactly these keys and the same {placeholders} (the build and the tests check).
// { one, other } is a plural, chosen by {count}.
// Not here: the user's data, logs, the Developer menu, anything sent to a model, the MCP
// tools, and the Markdown export's output.

export const en = {
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    delete: 'Delete',
    yes: 'Yes',
    no: 'No',
    none: 'None'
  },
  menu: {
    file: {
      title: 'File',
      new: 'New…',
      open: 'Open…',
      openRecent: 'Open Recent',
      recentEmpty: '(empty)',
      saveAs: 'Save As…',
      importJson: 'Import old JSON…',
      export: 'Export',
      exportCsv: 'CSV…',
      exportJson: 'JSON…',
      exportMarkdown: 'Markdown…',
      about: 'About Review Assistant',
      exit: 'Exit'
    },
    edit: {
      undo: 'Undo',
      undoWhat: 'Undo {what}',
      redo: 'Redo',
      redoWhat: 'Redo {what}',
      cut: 'Cut',
      copy: 'Copy',
      paste: 'Paste',
      selectAll: 'Select All'
    },
    settings: {
      title: 'Settings',
      preferences: 'Preferences…',
      plugins: 'Plugins…'
    }
  },
  app: {
    title: 'Review Assistant',
    titleWithFile: '{name} – Review Assistant',
    loadFailed: 'Could not load the file: {error}'
  },
  // The status bar (spec §2).
  status: {
    rows: { one: '{count} row', other: '{count} rows' },
    rowsShown: { one: '{shown} of {count} row shown', other: '{shown} of {count} rows shown' },
    checked: { one: '{count} checked', other: '{count} checked' },
    showInFolder: 'Show in folder',
    dismiss: 'Dismiss',
    claudeReading: 'Claude Desktop is reading…'
  },
  // Status-bar notices.
  notices: {
    failed: '{what} failed: {reason}',
    exported: { one: 'Exported {count} row to {name}', other: 'Exported {count} rows to {name}' },
    undid: 'Undid edit to {column} ({row})',
    redid: 'Redid edit to {column} ({row})',
    undoMissing: "Couldn't undo the edit to {column}: that option or item has been removed",
    redoMissing: "Couldn't redo the edit to {column}: that option or item has been removed",
    dictionaryFailed:
      "Couldn't download the {language} dictionary (offline?), so {language} isn't checked for now. It's tried again when the app next starts."
  },
  // What failed, in "{what} failed: {reason}".
  actions: {
    saveAs: 'Save As',
    importing: 'Importing',
    exporting: 'Exporting',
    openingFile: 'Opening the file',
    showingFile: 'Showing the file',
    addingRow: 'Adding a row',
    savingView: 'Saving the view',
    savingCell: 'Saving the cell',
    savingColumnWidth: 'Saving the column width',
    reorderingColumns: 'Reordering columns',
    savingRowHeight: 'Saving the row height',
    savingCheckboxes: 'Saving the checkboxes',
    savingSearchBar: 'Saving the search bar setting',
    savingSort: 'Saving the sort',
    savingActiveTab: 'Saving the active tab'
  },
  // Undo / Redo (the tab strip's buttons): what will be undone.
  undo: {
    editTo: 'edit to {column}',
    rowN: 'row {n}'
  },
  welcome: {
    subtitle: 'Create a new review or open one.',
    new: 'New review',
    import: 'Import a file from the old app (.json)…',
    recent: 'Recent'
  },
  about: {
    description:
      'A tool for reviewing and analyzing your notes. Designed for reviewing academic articles and performing sub-group analyses.',
    version: 'Version',
    system: 'System',
    settingsFolder: 'Settings folder',
    logFiles: 'Log files',
    openSettings: 'Open settings folder',
    openLogs: 'Open logs',
    copy: 'Copy details',
    copied: 'Copied',
    dictionaries:
      'Spellcheck dictionaries: SCOWL (English), igerman98 (German), Dicollecte (French) and RLA-ES (Spanish), under their own licences (LGPL, MPL, GPL and BSD-style); see LICENSES.md in the install folder, under resources\\app.asar.unpacked\\resources\\dictionaries.'
  },
  // The review table (spec §4–§7).
  table: {
    headerTooltip: '{name}: click to sort, drag to move',
    insertColumnBefore: 'Insert column before',
    insertColumnAfter: 'Insert column after',
    editColumn: 'Edit…',
    deleteColumn: 'Delete…',
    clearFiltersLabel: 'Clear filters and search',
    clearFiltersTooltip: 'Clear all filters and the search',
    checkAllLabel: 'Check all rows shown in this tab',
    checkAll: 'Check all',
    uncheckAll: 'Uncheck all',
    rowTooltip: 'Right-click for row options',
    checkRow: 'Check row',
    resizeRow: 'Drag to resize the row',
    numberTooltip: 'Whole number from {min} to {max}; ↑/↓ to step',
    newTab: 'New Tab…',
    insertRowAbove: 'Insert row above',
    insertRowBelow: 'Insert row below',
    addRowTo: 'Add row to…',
    addCheckedTo: {
      one: 'Add checked rows ({count}) to…',
      other: 'Add checked rows ({count}) to…'
    },
    deleteRow: 'Delete row',
    deleteChecked: { one: 'Delete checked rows ({count})', other: 'Delete checked rows ({count})' },
    removeRow: 'Remove row',
    removeChecked: { one: 'Remove checked rows ({count})', other: 'Remove checked rows ({count})' },
    actions: {
      addingToTab: 'Adding to the tab',
      insertingRow: 'Inserting a row',
      removingRow: 'Removing the row',
      removingRows: 'Removing the rows'
    }
  },
  // New column / Column settings (spec §4.2).
  columns: {
    types: {
      text: 'Text',
      dropdown: 'Dropdown',
      checkbox: 'Checkbox',
      list: 'List',
      checklist: 'Checklist',
      date: 'Date',
      number: 'Number'
    },
    defaultName: 'New Column',
    nameEmpty: 'Column name cannot be empty.',
    needOption: 'Please add at least one option for the dropdown.',
    optionEmpty: 'Options cannot be empty.',
    optionsDiffer: 'Each option must be different.',
    wholeNumbers: 'Minimum and maximum must be whole numbers.',
    limits: 'Limits must be within ±{limit}.',
    minAboveMax: 'Minimum value cannot be greater than maximum.',
    newTitle: 'New column',
    editTitle: 'Column settings',
    description: 'Name, type and options for this column.',
    name: 'Column name',
    type: 'Column type',
    options: 'Options',
    newOption: 'New option…',
    add: 'Add',
    min: 'Minimum value',
    max: 'Maximum value',
    preview: 'Changing {from} to {to}: {converted}, {cleared}{empty}. A backup is taken first.',
    converts: { one: '{count} value converts', other: '{count} values convert' },
    willBeCleared: { one: '{count} will be cleared', other: '{count} will be cleared' },
    alreadyEmpty: { one: ', {count} already empty', other: ', {count} already empty' },
    changeType: 'Change type',
    noOptions: 'No options yet.',
    dragToReorder: 'Drag to reorder',
    optionN: 'Option {n}',
    listStyle: 'List style',
    styles: { bullets: 'Bullets', numbered: 'Numbered' },
    items: 'Items',
    newItem: 'New item…',
    needItem: 'Please add at least one item for the checklist.',
    itemEmpty: 'Items cannot be empty.',
    itemsDiffer: 'Each item must be different.',
    noItems: 'No items yet.',
    itemN: 'Item {n}',
    untickWarning: {
      one: 'A removed item is ticked in {count} row; it will be unticked there. A backup is taken first.',
      other:
        'A removed item is ticked in {count} rows; it will be unticked there. A backup is taken first.'
    },
    restyleWarning: {
      one: 'Changing the style rewrites the markers in {count} cell. Nothing is lost.',
      other: 'Changing the style rewrites the markers in {count} cells. Nothing is lost.'
    },
    rewriteCells: 'Rewrite cells',
    removeOption: 'Remove {name}'
  },
  deleteColumn: {
    title: 'Delete column “{name}”?',
    body: 'This permanently deletes the column and all its data. A backup of the file is taken first.'
  },
  deleteRows: {
    deleting: 'Deleting rows',
    checking: 'Checking tab membership',
    title: { one: 'Delete {count} row?', other: 'Delete {count} rows?' },
    inTabs: { one: '{count} row is in {tabs}.', other: '{count} rows are in {tabs}.' },
    tabs: { one: '{count} tab', other: '{count} tabs' },
    body: {
      one: 'Deleting removes it from the main table and every tab. A backup of the file is taken first.',
      other:
        'Deleting removes them from the main table and every tab. A backup of the file is taken first.'
    }
  },
  // The filter under each column name (spec §7).
  filter: {
    label: 'Filter {name}',
    any: 'Any',
    checked: 'Checked',
    unchecked: 'Unchecked',
    placeholder: 'Filter…',
    noneTicked: '(none ticked)',
    pickItems: 'Pick items…',
    matchLabel: 'Match',
    matchAny: 'Any',
    matchAll: 'All',
    matchAnyHelp: 'Rows with at least one picked item ticked',
    matchAllHelp: 'Rows with every picked item ticked',
    helpText:
      'Words must all appear. "exact phrase", a OR b, a NOT b, (…), swim*. Not case-sensitive.',
    helpNumber:
      'Compare: >2015, >=2015, <2020, <=2020, 2010..2020 (inclusive). Other text: contains.',
    helpDate:
      'Compare: >2019, <2020-06, 2019..2020 (whole years/months count). Other text: contains.'
  },
  // The tab strip and New / Edit Tab (spec §8).
  tabs: {
    main: 'Main',
    allRows: 'All rows',
    tooltip: '{name} ({rows})',
    close: 'Close {name}',
    editMenu: 'Edit Tab…',
    new: 'New tab',
    reordering: 'Reordering tabs',
    deleting: 'Deleting the tab',
    deleteTitle: 'Delete {name}?',
    deleteBody: 'Are you sure you want to delete {name}? Its rows stay in the main table.',
    nothingToUndo: 'Nothing to undo',
    nothingToRedo: 'Nothing to redo',
    defaultName: 'Tab {n}',
    nameEmpty: 'Tab name must not be empty.',
    nameTaken: 'A tab named "{name}" already exists.',
    newTitle: 'New Tab',
    editTitle: 'Edit Tab',
    startsWith: { one: 'Starts with {count} row.', other: 'Starts with {count} rows.' },
    description: 'A tab shows a chosen set of rows from the main table.',
    name: 'Name',
    type: 'Type',
    types: { review: 'Review Table', synthesis: 'Synthesis' }
  },
  // The search bar (spec §7). AND / OR / NOT are the search syntax: they stay in English.
  search: {
    button: 'Search',
    showTooltip: 'Search (Ctrl+F)',
    hideTooltip: 'Hide search (Ctrl+F)',
    label: 'Search this tab',
    placeholder: 'Search…  e.g. pacing "elite junior" NOT cycling',
    help: 'Search every column of this tab. Words must all appear (anywhere).\n"exact phrase"   ·   a OR b   ·   a NOT b   ·   (a OR b) AND c   ·   swim* (swim, swims, swimming…)\nAND / OR / NOT only count in CAPITALS. Not case-sensitive.',
    clear: 'Clear search'
  },
  synthesis: {
    title: 'Synthesis tab',
    body: {
      one: 'This tab has {count} row. The synthesis view is coming in a later version.',
      other: 'This tab has {count} rows. The synthesis view is coming in a later version.'
    },
    hint: 'Right-click the tab and choose Edit Tab to make it a Review Table again.'
  },
  // File > Export > Markdown… (spec §9.1). Only the dialog: the notes it writes aren't
  // translated, so a re-export doesn't change with the UI language.
  markdownExport: {
    title: 'Export to Markdown',
    loading: 'Loading…',
    description:
      'One note per row, e.g. for an Obsidian vault. Notes in the folder are never deleted.',
    skipped: { one: '{count} skipped', other: '{count} skipped' },
    failed: { one: '{count} failed', other: '{count} failed' },
    done: {
      one: 'Exported {count} note{counts} to {folder}',
      other: 'Exported {count} notes{counts} to {folder}'
    },
    notWritten: {
      one: '{count} could not be written. First problem: {error}',
      other: '{count} could not be written. First problem: {error}'
    },
    rows: 'Rows',
    scopeChecked: { one: 'Checked rows ({count})', other: 'Checked rows ({count})' },
    scopeMain: { one: 'Current tab – {count} shown', other: 'Current tab – {count} shown' },
    scopeTab: {
      one: 'Current tab ({name}) – {count} shown',
      other: 'Current tab ({name}) – {count} shown'
    },
    scopeAll: { one: 'Everything ({count})', other: 'Everything ({count})' },
    folder: 'Target folder',
    noFolder: 'No folder chosen',
    choose: 'Choose…',
    ifExistsLabel: 'If a note already exists',
    ifExists: {
      ours: 'Overwrite only notes this app created',
      skip: 'Skip',
      overwrite: 'Overwrite'
    },
    columns: 'Columns',
    column: 'Column',
    exportAs: 'Export as',
    property: 'Property name',
    fileName: 'File name',
    modes: { property: 'Property', section: 'Section', skip: 'Skip' },
    exportColumnAs: 'Export {name} as',
    propertyFor: 'Property name for {name}',
    nameAfter: 'Name notes after {name}',
    extra: 'Extra properties',
    tagsFromTabs: '{tags} from the tabs each row is in',
    extraTagsLabel: 'Extra tags',
    extraTagsPlaceholder: 'Extra tags, comma-separated (e.g. review/2026, to-read)',
    header: 'Text at the top of every note',
    headerPlaceholder: 'Optional markdown, e.g. #review or a link like [[Swimming review]]',
    preview: 'Preview',
    noRows: 'No rows in this selection.',
    exporting: 'Exporting…',
    exportN: { one: 'Export {count} note', other: 'Export {count} notes' }
  },
  // Settings > Preferences (spec §12).
  preferences: {
    title: 'Preferences',
    description: 'These apply to every review.',
    language: 'Language',
    languageSystem: 'System',
    languageRestart: 'Some parts change after a restart.',
    theme: 'Theme',
    themes: { system: 'System', light: 'Light', dark: 'Dark' },
    markdownColour: 'Markdown colour',
    searchHighlight: 'Search highlight',
    spellcheck: 'Spellcheck',
    spellcheckN: 'Spellcheck language {n}',
    spellcheckOff: 'None (spellcheck off)',
    spellcheckOffline: '{name} · offline',
    spellcheckHint:
      'Up to three languages; a word is accepted if any of them knows it. Those marked offline come with the app; others are downloaded once. Languages Windows has installed may be checked by Windows.',
    hotkeys: 'Hotkeys',
    reset: 'Reset to defaults',
    resetTitle: 'Reset to defaults?',
    resetBody:
      'Language, theme, markdown colours (and the override), spellcheck languages, hotkeys and the assistant’s provider and models go back to their defaults (a saved API key is kept). Nothing is saved until you click Save.',
    resetButton: 'Reset',
    kinds: {
      h1: '# Heading 1',
      h2: '## Heading 2',
      h3: '### Heading 3',
      h4: '#### Heading 4',
      h5: '##### Heading 5',
      h6: '###### Heading 6',
      bold: '**Bold**',
      italic: '*Italic*',
      strike: '~~Strikethrough~~',
      list: '- / 1. List marker',
      task: '- [ ] Task (and checkboxes)',
      code: '`Inline code`',
      quote: '> Quote',
      link: '[Link](url)',
      rule: '--- Rule, <br>'
    },
    setByTheme: 'Set by theme {name}',
    override: 'Override theme colour',
    perElement: 'Colours per element',
    kindColour: '{name} colour',
    useMain: 'Use the main markdown colour',
    highlightSample: 'Pacing in elite {hit}',
    highlightSampleHit: 'swimming',
    pressKeys: 'Press a key combination…'
  },
  // Preferences > Assistant (spec §12).
  assistantSettings: {
    keyRemoved: 'Removed on Save',
    keySaved: 'Saved (type to replace)',
    keyPaste: 'Paste your API key',
    provider: 'Provider',
    providers: {
      openrouter: 'OpenRouter',
      anthropic: 'Anthropic (Claude)',
      openai: 'OpenAI-compatible',
      ollama: 'Ollama (on this computer)'
    },
    address: 'Address',
    key: 'API key',
    remove: 'Remove',
    testing: 'Testing…',
    test: 'Test',
    checking: 'Checking…',
    models: 'Models',
    fallback: 'Context if unknown',
    thousandTokens: 'thousand tokens',
    showMeter: 'Show token meter',
    showCosts: 'Show costs (where the provider gives prices)',
    refresh: 'Refresh',
    load: 'Load models',
    useSuggested: 'Use suggested',
    usingSuggested: 'Using the suggested models until you pick some.',
    searchModels: 'Search models',
    searchN: { one: 'Search {count} model…', other: 'Search {count} models…' },
    default: 'Default',
    priceTooltip: 'USD per million tokens, in / out',
    price: '$/1M in · out',
    context: 'Context',
    enable: 'Enable {name}',
    makeDefault: 'Make {name} the default'
  },
  // Preferences > Connect to Claude Desktop (spec §10.1).
  claudeDesktop: {
    notConnected: 'Not connected',
    off: 'Off: nothing is listening.',
    waiting: 'On: waiting for Claude Desktop.',
    read: {
      one: 'On: Claude has read the review {count} time (last at {time}).',
      other: 'On: Claude has read the review {count} times (last at {time}).'
    },
    title: 'Connect to Claude Desktop',
    description:
      'Chat about your review in Claude Desktop, using your own Claude plan instead of an API key. Claude can list tabs and read or search the rows of the review open here. It can’t change anything.',
    switch: 'Let Claude Desktop read the open review',
    turnsOn: 'Turns on when you press Save.',
    turnsOff: 'Turns off when you press Save.',
    saving: 'Saving…',
    saveButton: 'Save extension for Claude Desktop…',
    saved:
      'Saved. Double-click the file (or drag it into Claude Desktop) to install it. You only need to do this once.',
    setup:
      'One-time setup: save the extension, then double-click it to install it in Claude Desktop.'
  },
  // Settings > Plugins (spec §12.1).
  plugins: {
    title: 'Plugins',
    description: 'Themes and plugins apply to every review.',
    defaultTheme: 'Default',
    fromVault: '{name} (vault)',
    addTheme: 'Add theme…',
    vaultReadOnly: 'Themes from your vault are not changed here',
    vault: 'Vault',
    noVault: 'None: choose an Obsidian vault to use its themes',
    vaultMissing: '(its .obsidian folder isn’t there)',
    clear: 'Clear',
    coloursOnly: 'Only a theme’s colours are used. Light or dark is chosen in Preferences.',
    openThemes: 'Open themes folder',
    openPlugins: 'Open plugins folder',
    deleteTheme: 'Delete theme "{name}"?',
    deletePlugin: 'Delete plugin "{name}"?',
    recycleBin: 'Its folder is moved to the Recycle Bin.',
    backToDefault: 'The app switches back to the Default theme.',
    none: 'No plugins installed. Plugins aren’t available yet; community plugins will be listed here.',
    author: 'Author',
    descriptionColumn: 'Description',
    enabled: 'Enabled'
  },
  // The assistant panel (spec §10).
  assistant: {
    thisTab: { one: 'This tab ({count} row)', other: 'This tab ({count} rows)' },
    toggling: 'Turning the assistant on or off',
    savingWidth: 'Saving the panel width',
    savingModel: 'Saving the model',
    clearing: 'Clearing the chat',
    label: 'Assistant',
    resize: 'Resize the assistant panel',
    model: 'Model',
    noModels: 'No models enabled',
    defaultModel: '{name} (default)',
    newChat: 'New chat',
    newChatTooltip: 'Delete this tab’s conversation and start again',
    close: 'Close the assistant',
    stale: '{old} is no longer enabled; using {now}.',
    chooseModels: 'Choose models in Settings → Preferences → Assistant.',
    checking: 'Checking the assistant’s key…',
    readOnly: '{reason} The conversation is read-only.',
    unavailableSentence: 'The assistant is not available.',
    long: {
      one: 'This conversation is long: the oldest {count} message isn’t sent any more. A {newChat} is recommended.',
      other:
        'This conversation is long: the oldest {count} messages aren’t sent any more. A {newChat} is recommended.'
    },
    newChatLink: 'new chat',
    unavailablePlaceholder: 'The assistant is unavailable',
    placeholder: 'Ask something about this tab…',
    meterTooltip:
      'Estimated tokens sent with the next message (about 4 characters each), out of what the model takes',
    meter: '~{used} / {limit} tokens',
    oldestNotSent: { one: 'oldest {count} not sent', other: 'oldest {count} not sent' },
    nextCostTooltip: 'Estimated input cost of the next message',
    nextCost: '~{cost} next',
    costEstimated: 'Some replies’ costs are estimated or unknown',
    costReported: 'As reported by the provider',
    tabCost: '{cost} this tab',
    stop: 'Stop',
    send: 'Send',
    clearTitle: 'Start a new chat?',
    clearBody:
      'This deletes the conversation in “{name}”, and its running cost. Your rows are not affected.',
    filesReferenced: {
      one: '{count} file referenced: {names}',
      other: '{count} files referenced: {names}'
    },
    empty:
      'Ask about the rows shown in this tab. The assistant can read them but never changes them.',
    thinking: 'Thinking…',
    attachTooltip: 'Attach .txt, .md or .pdf files to the next message',
    rowsChipTooltip:
      'The rows shown in this tab (after filters), with all columns. Remove it to leave them out of the next message.',
    addThisTab: 'This tab',
    fileTooltip: '{name} · ~{tokens} tokens',
    message: 'Message',
    hide: 'Hide the assistant for this tab ({key})',
    show: 'Show the assistant for this tab ({key})',
    image: '[image]',
    imageAlt: '[image: {alt}]'
  },
  // The right-click menu in text fields.
  editMenu: {
    noSuggestions: 'No suggestions',
    addToDictionary: 'Add to dictionary'
  },
  // Main's file dialogs (spec §3, §9).
  files: {
    filterReview: 'Review files',
    filterOldJson: 'Old Review Assistant files',
    filterReviewOrJson: 'Review files (and old .json)',
    filterKind: '{what} files',
    newTitle: 'New review',
    untitled: 'Untitled',
    openTitle: 'Open review',
    saveAsTitle: 'Save As',
    copyName: '{name} copy',
    saveOnlyChecked: 'Save only checked rows?',
    exportTitle: 'Export as {what}',
    exportOnlyChecked: 'Export only checked rows?',
    checkedOfTotal: {
      one: '{count} of {total} rows is checked.',
      other: '{count} of {total} rows are checked.'
    },
    importTitle: 'Import old JSON',
    importSaveTitle: 'Save the imported review as',
    markdownFolderTitle: 'Export notes to folder'
  },
  errors: {
    unexpected: 'Unexpected error: {message}',
    fileNotFound: 'File not found:\n{path}',
    notAReviewFile: 'Not a review file:\n{path}',
    couldNotCreate: 'Could not create the review file',
    couldNotOpen: 'Could not open the review file',
    couldNotOpenFile: 'Could not open the file',
    couldNotReopen: 'Could not reopen the last review file',
    couldNotSaveCopy: 'Could not save a copy',
    couldNotImport: 'Could not import the file',
    couldNotExport: 'Could not export the file',
    couldNotExportNotes: 'Could not export the notes',
    sameAsOpen: 'That is the file already open. Choose a different name.',
    sameAsImported: 'That is the JSON file being imported. Choose a different name.',
    fileIsOpen: 'That file is open. Choose a different name.',
    sameAsOpenReview: 'That is the open review file. Choose a different name.',
    chooseFolderFirst: 'Choose a target folder first.',
    folderGone: 'The target folder no longer exists:\n{path}',
    newerVersion:
      'This file was saved by a newer version of Review Assistant. Please update the app.',
    sqliteNotReview: 'This is an SQLite database, but not a review file.',
    notReview: 'This file is not a review file.',
    notJson: 'This file is not valid JSON.',
    notOldJson:
      'This JSON file was not saved by the old Review Assistant (it needs "columns" and "rows").',
    crashed: 'Review Assistant crashed',
    lateEdit: 'Edit not saved: a different file was opened before it arrived',
    columnExists: 'A column named "{name}" already exists',
    tabExists: 'A tab named "{name}" already exists'
  },
  // Settings > Plugins: main's dialogs and errors (spec §12.1).
  addons: {
    themeMissing: 'That theme is not installed',
    addTitle: 'Add an Obsidian theme',
    themeFilter: 'Obsidian theme',
    replaceTitle: 'Replace theme?',
    replaceMessage: 'A theme called "{name}" is already installed. Replace it?',
    replace: 'Replace',
    addFailed: 'Could not add the theme',
    vaultThemeDelete: 'Themes from a vault cannot be deleted here',
    vaultTitle: 'Choose your Obsidian vault',
    notVault: 'Not an Obsidian vault',
    notVaultDetail: 'That folder has no .obsidian folder. Choose the vault folder itself.',
    pluginMissing: 'That plugin is not installed',
    pluginInvalid: 'This plugin has no valid manifest',
    noThemeColours:
      'This file has no theme colours (CSS variables on body, .theme-light or .theme-dark).',
    noManifest: 'No manifest.json',
    invalidManifest: 'Invalid manifest'
  },
  // The assistant, as main reports it (spec §10).
  assistantMain: {
    noKey: 'No API key. Set one in Settings → Preferences.',
    checkFailed: 'Key check failed: {reason}',
    connected: 'Connected',
    unavailable: 'The assistant is not available',
    attachTitle: 'Attach files',
    attachFilter: 'Text, Markdown or PDF',
    attachFailed: {
      one: 'A file could not be attached',
      other: 'Some files could not be attached'
    },
    otherFile: 'A different file is open now',
    stillReplying: 'The assistant is still replying in this tab',
    fileGone: 'An attached file is no longer available. Attach it again.',
    tooLarge:
      'This message is too large for the model. Remove the tab chip or some files, or pick a model with a larger context.',
    stopped: 'Stopped',
    emptyReply: 'The reply was empty',
    noSafeStorage: 'This computer can’t store the key securely, so it was not saved'
  },
  providers: {
    noKey: 'No API key saved',
    keyRefused: 'The key was refused',
    noCredit: 'The account has no credit left',
    tooMany: 'Too many requests; try again shortly',
    answered: 'The provider answered {status}',
    unreachable: 'Could not reach {host}',
    emptyBody: 'The provider sent an empty reply',
    reportedError: 'The provider reported an error',
    notAllowed: 'This key isn’t allowed to use that model',
    noSuchModel: 'Anthropic doesn’t offer that model',
    overloaded: 'Claude is overloaded; try again shortly',
    anthropicAnswered: 'Anthropic answered{status}',
    declined: 'Claude declined to answer this{why}. Try rephrasing the question.'
  },
  attachments: {
    wrongType: 'only .txt, .md and .pdf files',
    tooBig: 'larger than 20 MB',
    noText: 'no text found (a scanned PDF?)',
    notUtf8: 'not UTF-8 text'
  },
  // Import old JSON (spec §9): the summary, and what was changed on the way. (Names the
  // importer makes up for nameless columns and tabs are data, so they stay English.)
  import: {
    completeTitle: 'Import complete',
    completeMessage: 'Imported {rows}, {columns} and {tabs}.',
    rows: { one: '{count} row', other: '{count} rows' },
    columns: { one: '{count} column', other: '{count} columns' },
    tabs: { one: '{count} tab', other: '{count} tabs' },
    savedAs: 'Saved as {path}',
    changes: 'Changes made while importing:',
    // Lower case, as they're used mid-sentence ("didn't fit a number column").
    typeNames: {
      text: 'text',
      dropdown: 'dropdown',
      checkbox: 'checkbox',
      list: 'list',
      checklist: 'checklist',
      date: 'date',
      number: 'number'
    },
    width: '"{label}": width {from} px changed to {to} px.',
    unknownType: '"{label}": unknown type "{type}", imported as Text.',
    emptyDropdown: '"{label}": a dropdown with no options, imported as Text.',
    addedOptions: {
      one: '"{label}": added {count} option used in rows: {options}.',
      other: '"{label}": added {count} options used in rows: {options}.'
    },
    swapped: '"{label}": minimum and maximum were the wrong way round, so swapped.',
    widened: '"{label}": range widened from {min}–{max} to {lo}–{hi} to fit the values.',
    columnRenamed: 'Column "{from}" renamed to "{to}".',
    strayValues: 'Values under "{name}" (not a column) were not imported.',
    cleared: {
      one: '"{label}": {count} value that didn\'t fit a {type} column left empty.',
      other: '"{label}": {count} values that didn\'t fit a {type} column left empty.'
    },
    tallRows: {
      one: '{count} row taller than {max} px made {max} px.',
      other: '{count} rows taller than {max} px made {max} px.'
    },
    tabRenamed: 'Tab "{from}" renamed to "{to}".',
    missingRows: {
      one: 'Tab "{label}": {count} row no longer in the file skipped.',
      other: 'Tab "{label}": {count} rows no longer in the file skipped.'
    }
  },
  hotkeys: {
    names: {
      newRow: 'New row',
      newColumn: 'New column',
      saveAs: 'Save As',
      toggleAssistant: 'Toggle assistant'
    },
    // What already uses a key a hotkey can't take.
    fixed: {
      open: 'Open',
      preferences: 'Preferences',
      selectAll: 'Select all',
      copy: 'Copy',
      cut: 'Cut',
      paste: 'Paste',
      undo: 'Undo',
      redo: 'Redo',
      search: 'Search',
      closeWindow: 'Close window',
      menus: "the menus (Alt + a menu's first letter, in any of the app's languages)"
    },
    useKey: 'Use a letter, digit or F-key',
    addModifier: 'Add {key} or Alt',
    usedBy: 'Already used by {what}',
    resetTitle: 'Hotkeys changed',
    resetMessage: { one: 'A hotkey was reset', other: 'Some hotkeys were reset' },
    resetLine: '{name}: {key} is now used by {usedBy}, so it is back to {now}.',
    resetHint: 'You can choose another in Settings > Preferences.'
  },
  // Main's own message boxes for Claude Desktop (spec §10.1).
  claudeDesktopMain: {
    title: 'Claude Desktop',
    scriptMissing: 'The Claude Desktop script is missing from this build.',
    scriptMissingHint: 'Run "npm run build:mcp" and try again.',
    saveTitle: 'Save extension for Claude Desktop',
    fileName: 'Review Assistant',
    filter: 'Claude Desktop extension',
    saveFailed: 'The extension could not be saved.',
    inUse: 'In use by another copy of Review Assistant.',
    couldNotStart: 'Could not start: {reason}'
  }
} as const

export type En = typeof en

import type { En } from './en'
import type { Messages } from './types'

// French. A draft by Claude (plan M10d): to be checked by a native speaker before a release.
// "vous" throughout; AND / OR / NOT stay English (they're the search syntax).
// French plural rules treat 0 and 1 as singular ("0 ligne").

export const fr: Messages<En> = {
  common: {
    ok: 'OK',
    cancel: 'Annuler',
    save: 'Enregistrer',
    close: 'Fermer',
    delete: 'Supprimer',
    yes: 'Oui',
    no: 'Non',
    none: 'Aucune'
  },
  menu: {
    file: {
      title: 'Fichier',
      new: 'Nouveau…',
      open: 'Ouvrir…',
      openRecent: 'Ouvrir un fichier récent',
      recentEmpty: '(vide)',
      saveAs: 'Enregistrer sous…',
      importJson: 'Importer un ancien JSON…',
      export: 'Exporter',
      exportCsv: 'CSV…',
      exportJson: 'JSON…',
      exportMarkdown: 'Markdown…',
      about: 'À propos de Review Assistant',
      exit: 'Quitter'
    },
    edit: {
      title: 'Édition',
      undo: 'Annuler',
      undoWhat: 'Annuler : {what}',
      redo: 'Rétablir',
      redoWhat: 'Rétablir : {what}',
      cut: 'Couper',
      copy: 'Copier',
      paste: 'Coller',
      selectAll: 'Tout sélectionner'
    },
    settings: {
      title: 'Paramètres',
      preferences: 'Préférences…',
      plugins: 'Plugins…'
    }
  },
  app: {
    title: 'Review Assistant',
    titleWithFile: '{name} – Review Assistant',
    loadFailed: 'Impossible de charger le fichier : {error}'
  },
  status: {
    rows: { one: '{count} ligne', other: '{count} lignes' },
    rowsShown: {
      one: '{shown} sur {count} ligne affichée',
      other: '{shown} sur {count} lignes affichées'
    },
    checked: { one: '{count} cochée', other: '{count} cochées' },
    showInFolder: 'Afficher dans le dossier',
    dismiss: 'Masquer',
    claudeReading: 'Claude Desktop lit la revue…'
  },
  notices: {
    failed: 'Échec – {what} : {reason}',
    exported: {
      one: '{count} ligne exportée vers {name}',
      other: '{count} lignes exportées vers {name}'
    },
    undid: 'Modification de {column} annulée ({row})',
    redid: 'Modification de {column} rétablie ({row})',
    undoMissing: 'Impossible d’annuler la modification de {column} : cette option a été supprimée',
    redoMissing:
      'Impossible de rétablir la modification de {column} : cette option a été supprimée',
    dictionaryFailed:
      'Impossible de télécharger le dictionnaire de la langue « {language} » (hors ligne ?) : cette langue n’est donc pas vérifiée pour l’instant. Nouvel essai au prochain démarrage de l’application.'
  },
  actions: {
    saveAs: 'Enregistrer sous',
    importing: 'Importation',
    exporting: 'Exportation',
    openingFile: 'Ouverture du fichier',
    showingFile: 'Affichage du fichier',
    addingRow: 'Ajout d’une ligne',
    savingView: 'Enregistrement de la vue',
    savingCell: 'Enregistrement de la cellule',
    savingColumnWidth: 'Enregistrement de la largeur de colonne',
    reorderingColumns: 'Réorganisation des colonnes',
    savingRowHeight: 'Enregistrement de la hauteur de ligne',
    savingCheckboxes: 'Enregistrement des cases cochées',
    savingSearchBar: 'Enregistrement du réglage de la barre de recherche',
    savingSort: 'Enregistrement du tri',
    savingActiveTab: 'Enregistrement de l’onglet actif'
  },
  undo: {
    editTo: 'modification de {column}',
    edit: 'modification',
    rowN: 'ligne {n}'
  },
  welcome: {
    subtitle: 'Créez une nouvelle revue ou ouvrez-en une.',
    new: 'Nouvelle revue',
    import: 'Importer un fichier de l’ancienne application (.json)…',
    recent: 'Récents'
  },
  about: {
    description:
      'Un outil pour relire et analyser vos notes. Conçu pour la revue d’articles scientifiques et les analyses en sous-groupes.',
    version: 'Version',
    system: 'Système',
    settingsFolder: 'Dossier des paramètres',
    logFiles: 'Fichiers journaux',
    openSettings: 'Ouvrir le dossier des paramètres',
    openLogs: 'Ouvrir les journaux',
    copy: 'Copier les détails',
    copied: 'Copié',
    dictionaries:
      'Dictionnaires orthographiques : SCOWL (anglais), igerman98 (allemand), Dicollecte (français) et RLA-ES (espagnol), sous leurs propres licences (LGPL, MPL, GPL et de type BSD) ; voir LICENSES.md dans le dossier d’installation, sous resources\\app.asar.unpacked\\resources\\dictionaries.'
  },
  table: {
    headerTooltip: '{name} : cliquez pour trier, faites glisser pour déplacer',
    insertColumnBefore: 'Insérer une colonne avant',
    insertColumnAfter: 'Insérer une colonne après',
    editColumn: 'Modifier…',
    deleteColumn: 'Supprimer…',
    clearFiltersLabel: 'Effacer les filtres et la recherche',
    clearFiltersTooltip: 'Effacer tous les filtres et la recherche',
    checkAllLabel: 'Cocher toutes les lignes affichées dans cet onglet',
    checkAll: 'Tout cocher',
    uncheckAll: 'Tout décocher',
    rowTooltip: 'Clic droit pour les options de la ligne',
    checkRow: 'Cocher la ligne',
    resizeRow: 'Faites glisser pour redimensionner la ligne',
    numberTooltip: 'Nombre entier de {min} à {max} ; ↑/↓ pour modifier',
    newTab: 'Nouvel onglet…',
    insertRowAbove: 'Insérer une ligne au-dessus',
    insertRowBelow: 'Insérer une ligne en dessous',
    addRowTo: 'Ajouter la ligne à…',
    addCheckedTo: {
      one: 'Ajouter les lignes cochées ({count}) à…',
      other: 'Ajouter les lignes cochées ({count}) à…'
    },
    deleteRow: 'Supprimer la ligne',
    deleteChecked: {
      one: 'Supprimer les lignes cochées ({count})',
      other: 'Supprimer les lignes cochées ({count})'
    },
    removeRow: 'Retirer la ligne',
    removeChecked: {
      one: 'Retirer les lignes cochées ({count})',
      other: 'Retirer les lignes cochées ({count})'
    },
    actions: {
      addingToTab: 'Ajout à l’onglet',
      insertingRow: 'Insertion d’une ligne',
      removingRow: 'Retrait de la ligne',
      removingRows: 'Retrait des lignes'
    }
  },
  columns: {
    types: {
      text: 'Texte (multiligne)',
      dropdown: 'Liste déroulante',
      checkbox: 'Case à cocher',
      date: 'Date',
      number: 'Nombre'
    },
    defaultName: 'Nouvelle colonne',
    nameEmpty: 'Le nom de la colonne ne peut pas être vide.',
    needOption: 'Ajoutez au moins une option à la liste déroulante.',
    optionEmpty: 'Les options ne peuvent pas être vides.',
    optionsDiffer: 'Chaque option doit être différente.',
    wholeNumbers: 'Le minimum et le maximum doivent être des nombres entiers.',
    limits: 'Les limites doivent être comprises dans ±{limit}.',
    minAboveMax: 'La valeur minimale ne peut pas dépasser la valeur maximale.',
    newTitle: 'Nouvelle colonne',
    editTitle: 'Paramètres de la colonne',
    description: 'Nom, type et options de cette colonne.',
    name: 'Nom de la colonne',
    type: 'Type de colonne',
    options: 'Options',
    newOption: 'Nouvelle option…',
    add: 'Ajouter',
    min: 'Valeur minimale',
    max: 'Valeur maximale',
    preview:
      'Passage de {from} à {to} : {converted}, {cleared}{empty}. Une sauvegarde est faite d’abord.',
    converts: { one: '{count} valeur convertie', other: '{count} valeurs converties' },
    willBeCleared: { one: '{count} sera effacée', other: '{count} seront effacées' },
    alreadyEmpty: { one: ', {count} déjà vide', other: ', {count} déjà vides' },
    changeType: 'Changer le type',
    noOptions: 'Aucune option pour l’instant.',
    dragToReorder: 'Faites glisser pour réordonner',
    optionN: 'Option {n}',
    removeOption: 'Retirer {name}'
  },
  deleteColumn: {
    title: 'Supprimer la colonne « {name} » ?',
    body: 'La colonne et toutes ses données seront définitivement supprimées. Une sauvegarde du fichier est faite d’abord.'
  },
  deleteRows: {
    deleting: 'Suppression des lignes',
    checking: 'Vérification des onglets',
    title: { one: 'Supprimer {count} ligne ?', other: 'Supprimer {count} lignes ?' },
    inTabs: {
      one: '{count} ligne figure dans {tabs}.',
      other: '{count} lignes figurent dans {tabs}.'
    },
    tabs: { one: '{count} onglet', other: '{count} onglets' },
    body: {
      one: 'La supprimer la retire du tableau principal et de tous les onglets. Une sauvegarde du fichier est faite d’abord.',
      other:
        'Les supprimer les retire du tableau principal et de tous les onglets. Une sauvegarde du fichier est faite d’abord.'
    }
  },
  filter: {
    label: 'Filtrer {name}',
    any: 'Tous',
    checked: 'Cochées',
    unchecked: 'Non cochées',
    placeholder: 'Filtrer…',
    helpText:
      'Tous les mots doivent apparaître. "expression exacte", a OR b, a NOT b, (…), nag*. Insensible à la casse.',
    helpNumber:
      'Comparer : >2015, >=2015, <2020, <=2020, 2010..2020 (bornes incluses). Autre texte : contient.',
    helpDate:
      'Comparer : >2019, <2020-06, 2019..2020 (années/mois entiers). Autre texte : contient.'
  },
  tabs: {
    main: 'Principal',
    allRows: 'Toutes les lignes',
    tooltip: '{name} ({rows})',
    close: 'Fermer {name}',
    editMenu: 'Modifier l’onglet…',
    new: 'Nouvel onglet',
    reordering: 'Réorganisation des onglets',
    deleting: 'Suppression de l’onglet',
    deleteTitle: 'Supprimer {name} ?',
    deleteBody:
      'Voulez-vous vraiment supprimer {name} ? Ses lignes restent dans le tableau principal.',
    nothingToUndo: 'Rien à annuler',
    nothingToRedo: 'Rien à rétablir',
    defaultName: 'Onglet {n}',
    nameEmpty: 'Le nom de l’onglet ne peut pas être vide.',
    nameTaken: 'Un onglet nommé « {name} » existe déjà.',
    newTitle: 'Nouvel onglet',
    editTitle: 'Modifier l’onglet',
    startsWith: { one: 'Commence avec {count} ligne.', other: 'Commence avec {count} lignes.' },
    description: 'Un onglet affiche une sélection de lignes du tableau principal.',
    name: 'Nom',
    type: 'Type',
    types: { review: 'Tableau de revue', synthesis: 'Synthèse' }
  },
  search: {
    button: 'Rechercher',
    showTooltip: 'Rechercher (Ctrl+F)',
    hideTooltip: 'Masquer la recherche (Ctrl+F)',
    label: 'Rechercher dans cet onglet',
    placeholder: 'Rechercher…  ex. pacing "elite junior" NOT cycling',
    help: 'Recherche dans toutes les colonnes de cet onglet. Tous les mots doivent apparaître (n’importe où).\n"expression exacte"   ·   a OR b   ·   a NOT b   ·   (a OR b) AND c   ·   nag* (nage, nager, nageur…)\nAND / OR / NOT ne comptent qu’en MAJUSCULES. Insensible à la casse.',
    clear: 'Effacer la recherche'
  },
  synthesis: {
    title: 'Onglet de synthèse',
    body: {
      one: 'Cet onglet contient {count} ligne. La vue de synthèse arrivera dans une version ultérieure.',
      other:
        'Cet onglet contient {count} lignes. La vue de synthèse arrivera dans une version ultérieure.'
    },
    hint: 'Faites un clic droit sur l’onglet et choisissez « Modifier l’onglet » pour en refaire un tableau de revue.'
  },
  markdownExport: {
    title: 'Exporter en Markdown',
    loading: 'Chargement…',
    description:
      'Une note par ligne, par ex. pour un coffre Obsidian. Les notes du dossier ne sont jamais supprimées.',
    skipped: { one: '{count} ignorée', other: '{count} ignorées' },
    failed: { one: '{count} en échec', other: '{count} en échec' },
    done: {
      one: '{count} note exportée{counts} vers {folder}',
      other: '{count} notes exportées{counts} vers {folder}'
    },
    notWritten: {
      one: '{count} n’a pas pu être écrite. Premier problème : {error}',
      other: '{count} n’ont pas pu être écrites. Premier problème : {error}'
    },
    rows: 'Lignes',
    scopeChecked: { one: 'Lignes cochées ({count})', other: 'Lignes cochées ({count})' },
    scopeMain: {
      one: 'Onglet actuel – {count} affichée',
      other: 'Onglet actuel – {count} affichées'
    },
    scopeTab: {
      one: 'Onglet actuel ({name}) – {count} affichée',
      other: 'Onglet actuel ({name}) – {count} affichées'
    },
    scopeAll: { one: 'Tout ({count})', other: 'Tout ({count})' },
    folder: 'Dossier cible',
    noFolder: 'Aucun dossier choisi',
    choose: 'Choisir…',
    ifExistsLabel: 'Si une note existe déjà',
    ifExists: {
      ours: 'N’écraser que les notes créées par cette application',
      skip: 'Ignorer',
      overwrite: 'Écraser'
    },
    columns: 'Colonnes',
    column: 'Colonne',
    exportAs: 'Exporter comme',
    property: 'Nom de la propriété',
    fileName: 'Nom de fichier',
    modes: { property: 'Propriété', section: 'Section', skip: 'Ignorer' },
    exportColumnAs: 'Exporter {name} comme',
    propertyFor: 'Nom de la propriété pour {name}',
    nameAfter: 'Nommer les notes d’après {name}',
    extra: 'Propriétés supplémentaires',
    tagsFromTabs: '{tags} d’après les onglets de chaque ligne',
    extraTagsLabel: 'Tags supplémentaires',
    extraTagsPlaceholder: 'Tags supplémentaires, séparés par des virgules (ex. revue/2026, à-lire)',
    header: 'Texte en haut de chaque note',
    headerPlaceholder: 'Markdown facultatif, ex. #revue ou un lien comme [[Revue natation]]',
    preview: 'Aperçu',
    noRows: 'Aucune ligne dans cette sélection.',
    exporting: 'Exportation…',
    exportN: { one: 'Exporter {count} note', other: 'Exporter {count} notes' }
  },
  preferences: {
    title: 'Préférences',
    description: 'Elles s’appliquent à toutes les revues.',
    language: 'Langue',
    languageSystem: 'Système',
    languageRestart: 'Certaines parties ne changent qu’après un redémarrage.',
    theme: 'Thème',
    themes: { system: 'Système', light: 'Clair', dark: 'Sombre' },
    markdownColour: 'Couleur du Markdown',
    searchHighlight: 'Surlignage de recherche',
    spellcheck: 'Orthographe',
    spellcheckN: 'Langue de vérification {n}',
    spellcheckOff: 'Aucune (vérification désactivée)',
    spellcheckOffline: '{name} · hors ligne',
    spellcheckHint:
      'Jusqu’à trois langues ; un mot est accepté si l’une d’elles le connaît. Celles marquées hors ligne sont fournies avec l’application ; les autres sont téléchargées une fois. Les langues installées dans Windows peuvent être vérifiées par Windows.',
    hotkeys: 'Raccourcis clavier',
    reset: 'Rétablir les valeurs par défaut',
    resetTitle: 'Rétablir les valeurs par défaut ?',
    resetBody:
      'La langue, le thème, les couleurs du Markdown (et leur priorité), les langues de vérification, les raccourcis ainsi que le fournisseur et les modèles de l’assistant reprennent leurs valeurs par défaut (une clé d’API enregistrée est conservée). Rien n’est enregistré avant que vous cliquiez sur Enregistrer.',
    resetButton: 'Rétablir',
    kinds: {
      h1: '# Titre 1',
      h2: '## Titre 2',
      h3: '### Titre 3',
      h4: '#### Titre 4',
      h5: '##### Titre 5',
      h6: '###### Titre 6',
      bold: '**Gras**',
      italic: '*Italique*',
      strike: '~~Barré~~',
      list: '- / 1. Puce de liste',
      task: '- [ ] Tâche (et cases à cocher)',
      code: '`Code en ligne`',
      quote: '> Citation',
      link: '[Lien](url)',
      rule: '--- Trait, <br>'
    },
    setByTheme: 'Défini par le thème {name}',
    override: 'Remplacer la couleur du thème',
    perElement: 'Couleurs par élément',
    kindColour: 'Couleur de {name}',
    useMain: 'Utiliser la couleur principale du Markdown',
    highlightSample: 'Allure en {hit} d’élite',
    highlightSampleHit: 'natation',
    pressKeys: 'Appuyez sur une combinaison de touches…'
  },
  assistantSettings: {
    keyRemoved: 'Supprimée à l’enregistrement',
    keySaved: 'Enregistrée (tapez pour la remplacer)',
    keyPaste: 'Collez votre clé d’API',
    provider: 'Fournisseur',
    providers: {
      openrouter: 'OpenRouter',
      anthropic: 'Anthropic (Claude)',
      openai: 'Compatible OpenAI',
      ollama: 'Ollama (sur cet ordinateur)'
    },
    address: 'Adresse',
    key: 'Clé d’API',
    remove: 'Supprimer',
    testing: 'Test en cours…',
    test: 'Tester',
    checking: 'Vérification…',
    models: 'Modèles',
    fallback: 'Contexte si inconnu',
    thousandTokens: 'milliers de tokens',
    showMeter: 'Afficher le compteur de tokens',
    showCosts: 'Afficher les coûts (si le fournisseur donne ses prix)',
    refresh: 'Actualiser',
    load: 'Charger les modèles',
    useSuggested: 'Utiliser les suggestions',
    usingSuggested: 'Les modèles suggérés sont utilisés jusqu’à ce que vous en choisissiez.',
    searchModels: 'Rechercher des modèles',
    searchN: {
      one: 'Rechercher parmi {count} modèle…',
      other: 'Rechercher parmi {count} modèles…'
    },
    default: 'Par défaut',
    priceTooltip: 'USD par million de tokens, entrée / sortie',
    price: '$/1M entrée · sortie',
    context: 'Contexte',
    enable: 'Activer {name}',
    makeDefault: 'Utiliser {name} par défaut'
  },
  claudeDesktop: {
    notConnected: 'Non connecté',
    off: 'Désactivé : rien n’est à l’écoute.',
    waiting: 'Activé : en attente de Claude Desktop.',
    read: {
      one: 'Activé : Claude a lu la revue {count} fois (dernière fois à {time}).',
      other: 'Activé : Claude a lu la revue {count} fois (dernière fois à {time}).'
    },
    title: 'Se connecter à Claude Desktop',
    description:
      'Discutez de votre revue dans Claude Desktop, avec votre propre abonnement Claude au lieu d’une clé d’API. Claude peut lister les onglets et lire ou rechercher les lignes de la revue ouverte ici. Il ne peut rien modifier.',
    switch: 'Autoriser Claude Desktop à lire la revue ouverte',
    turnsOn: 'S’active quand vous cliquez sur Enregistrer.',
    turnsOff: 'Se désactive quand vous cliquez sur Enregistrer.',
    saving: 'Enregistrement…',
    saveButton: 'Enregistrer l’extension pour Claude Desktop…',
    saved:
      'Enregistrée. Double-cliquez sur le fichier (ou faites-le glisser dans Claude Desktop) pour l’installer. Il suffit de le faire une fois.',
    setup:
      'Configuration unique : enregistrez l’extension, puis double-cliquez dessus pour l’installer dans Claude Desktop.'
  },
  plugins: {
    title: 'Plugins',
    description: 'Les thèmes et plugins s’appliquent à toutes les revues.',
    defaultTheme: 'Par défaut',
    fromVault: '{name} (coffre)',
    addTheme: 'Ajouter un thème…',
    vaultReadOnly: 'Les thèmes de votre coffre ne sont pas modifiés ici',
    vault: 'Coffre',
    noVault: 'Aucun : choisissez un coffre Obsidian pour utiliser ses thèmes',
    vaultMissing: '(son dossier .obsidian est introuvable)',
    clear: 'Retirer',
    coloursOnly:
      'Seules les couleurs d’un thème sont utilisées. Clair ou sombre se choisit dans les Préférences.',
    openThemes: 'Ouvrir le dossier des thèmes',
    openPlugins: 'Ouvrir le dossier des plugins',
    deleteTheme: 'Supprimer le thème « {name} » ?',
    deletePlugin: 'Supprimer le plugin « {name} » ?',
    recycleBin: 'Son dossier est déplacé dans la Corbeille.',
    backToDefault: 'L’application revient au thème par défaut.',
    none: 'Aucun plugin installé. Les plugins ne sont pas encore disponibles ; les plugins de la communauté apparaîtront ici.',
    author: 'Auteur',
    descriptionColumn: 'Description',
    enabled: 'Activé'
  },
  assistant: {
    thisTab: { one: 'Cet onglet ({count} ligne)', other: 'Cet onglet ({count} lignes)' },
    toggling: 'Activation ou désactivation de l’assistant',
    savingWidth: 'Enregistrement de la largeur du panneau',
    savingModel: 'Enregistrement du modèle',
    clearing: 'Effacement de la conversation',
    label: 'Assistant',
    resize: 'Redimensionner le panneau de l’assistant',
    model: 'Modèle',
    noModels: 'Aucun modèle activé',
    defaultModel: '{name} (par défaut)',
    newChat: 'Nouvelle conversation',
    newChatTooltip: 'Supprimer la conversation de cet onglet et recommencer',
    close: 'Fermer l’assistant',
    stale: '{old} n’est plus activé ; {now} est utilisé.',
    chooseModels: 'Choisissez des modèles dans Paramètres → Préférences → Assistant.',
    checking: 'Vérification de la clé de l’assistant…',
    readOnly: '{reason} La conversation est en lecture seule.',
    unavailableSentence: 'L’assistant n’est pas disponible.',
    long: {
      one: 'Cette conversation est longue : le message le plus ancien ({count}) n’est plus envoyé. Une {newChat} est recommandée.',
      other:
        'Cette conversation est longue : les {count} messages les plus anciens ne sont plus envoyés. Une {newChat} est recommandée.'
    },
    newChatLink: 'nouvelle conversation',
    unavailablePlaceholder: 'L’assistant n’est pas disponible',
    placeholder: 'Posez une question sur cet onglet…',
    meterTooltip:
      'Tokens estimés envoyés avec le prochain message (environ 4 caractères chacun), sur ce que le modèle accepte',
    meter: '~{used} / {limit} tokens',
    oldestNotSent: {
      one: '{count} plus ancien non envoyé',
      other: '{count} plus anciens non envoyés'
    },
    nextCostTooltip: 'Coût d’entrée estimé du prochain message',
    nextCost: '~{cost} prochain',
    costEstimated: 'Le coût de certaines réponses est estimé ou inconnu',
    costReported: 'Selon le fournisseur',
    tabCost: '{cost} cet onglet',
    stop: 'Arrêter',
    send: 'Envoyer',
    clearTitle: 'Commencer une nouvelle conversation ?',
    clearBody:
      'Cela supprime la conversation de « {name} » et son coût cumulé. Vos lignes ne sont pas touchées.',
    filesReferenced: {
      one: '{count} fichier joint : {names}',
      other: '{count} fichiers joints : {names}'
    },
    empty:
      'Posez des questions sur les lignes affichées dans cet onglet. L’assistant peut les lire mais ne les modifie jamais.',
    thinking: 'Réflexion…',
    attachTooltip: 'Joindre des fichiers .txt, .md ou .pdf au prochain message',
    rowsChipTooltip:
      'Les lignes affichées dans cet onglet (après filtres), avec toutes les colonnes. Retirez-le pour ne pas les envoyer avec le prochain message.',
    addThisTab: 'Cet onglet',
    fileTooltip: '{name} · ~{tokens} tokens',
    message: 'Message',
    hide: 'Masquer l’assistant pour cet onglet ({key})',
    show: 'Afficher l’assistant pour cet onglet ({key})',
    image: '[image]',
    imageAlt: '[image : {alt}]'
  },
  editMenu: {
    noSuggestions: 'Aucune suggestion',
    addToDictionary: 'Ajouter au dictionnaire'
  },
  files: {
    filterReview: 'Fichiers de revue',
    filterOldJson: 'Fichiers de l’ancien Review Assistant',
    filterReviewOrJson: 'Fichiers de revue (et anciens .json)',
    filterKind: 'Fichiers {what}',
    newTitle: 'Nouvelle revue',
    untitled: 'Sans titre',
    openTitle: 'Ouvrir une revue',
    saveAsTitle: 'Enregistrer sous',
    copyName: '{name} copie',
    saveOnlyChecked: 'Enregistrer uniquement les lignes cochées ?',
    exportTitle: 'Exporter en {what}',
    exportOnlyChecked: 'Exporter uniquement les lignes cochées ?',
    checkedOfTotal: {
      one: '{count} ligne sur {total} est cochée.',
      other: '{count} lignes sur {total} sont cochées.'
    },
    importTitle: 'Importer un ancien JSON',
    importSaveTitle: 'Enregistrer la revue importée sous',
    markdownFolderTitle: 'Exporter les notes vers un dossier'
  },
  errors: {
    unexpected: 'Erreur inattendue : {message}',
    fileNotFound: 'Fichier introuvable :\n{path}',
    notAReviewFile: 'Ce n’est pas un fichier de revue :\n{path}',
    couldNotCreate: 'Impossible de créer le fichier de revue',
    couldNotOpen: 'Impossible d’ouvrir le fichier de revue',
    couldNotOpenFile: 'Impossible d’ouvrir le fichier',
    couldNotReopen: 'Impossible de rouvrir le dernier fichier de revue',
    couldNotSaveCopy: 'Impossible d’enregistrer une copie',
    couldNotImport: 'Impossible d’importer le fichier',
    couldNotExport: 'Impossible d’exporter le fichier',
    couldNotExportNotes: 'Impossible d’exporter les notes',
    sameAsOpen: 'C’est le fichier déjà ouvert. Choisissez un autre nom.',
    sameAsImported: 'C’est le fichier JSON en cours d’importation. Choisissez un autre nom.',
    fileIsOpen: 'Ce fichier est ouvert. Choisissez un autre nom.',
    sameAsOpenReview: 'C’est le fichier de revue ouvert. Choisissez un autre nom.',
    chooseFolderFirst: 'Choisissez d’abord un dossier cible.',
    folderGone: 'Le dossier cible n’existe plus :\n{path}',
    newerVersion:
      'Ce fichier a été enregistré par une version plus récente de Review Assistant. Veuillez mettre à jour l’application.',
    sqliteNotReview: 'C’est une base de données SQLite, mais pas un fichier de revue.',
    notReview: 'Ce fichier n’est pas un fichier de revue.',
    notJson: 'Ce fichier n’est pas un JSON valide.',
    notOldJson:
      'Ce fichier JSON n’a pas été enregistré par l’ancien Review Assistant (il lui faut "columns" et "rows").',
    crashed: 'Review Assistant a planté',
    lateEdit: 'Modification non enregistrée : un autre fichier a été ouvert avant son arrivée',
    columnExists: 'Une colonne nommée « {name} » existe déjà',
    tabExists: 'Un onglet nommé « {name} » existe déjà'
  },
  addons: {
    themeMissing: 'Ce thème n’est pas installé',
    addTitle: 'Ajouter un thème Obsidian',
    themeFilter: 'Thème Obsidian',
    replaceTitle: 'Remplacer le thème ?',
    replaceMessage: 'Un thème nommé « {name} » est déjà installé. Le remplacer ?',
    replace: 'Remplacer',
    addFailed: 'Impossible d’ajouter le thème',
    vaultThemeDelete: 'Les thèmes d’un coffre ne peuvent pas être supprimés ici',
    vaultTitle: 'Choisir votre coffre Obsidian',
    notVault: 'Ce n’est pas un coffre Obsidian',
    notVaultDetail:
      'Ce dossier ne contient pas de dossier .obsidian. Choisissez le dossier du coffre lui-même.',
    pluginMissing: 'Ce plugin n’est pas installé',
    pluginInvalid: 'Ce plugin n’a pas de manifeste valide',
    noThemeColours:
      'Ce fichier ne contient aucune couleur de thème (variables CSS sur body, .theme-light ou .theme-dark).',
    noManifest: 'Pas de manifest.json',
    invalidManifest: 'Manifeste non valide'
  },
  assistantMain: {
    noKey: 'Aucune clé d’API. Définissez-en une dans Paramètres → Préférences.',
    checkFailed: 'La vérification de la clé a échoué : {reason}',
    connected: 'Connecté',
    unavailable: 'L’assistant n’est pas disponible',
    attachTitle: 'Joindre des fichiers',
    attachFilter: 'Texte, Markdown ou PDF',
    attachFailed: {
      one: 'Un fichier n’a pas pu être joint',
      other: 'Certains fichiers n’ont pas pu être joints'
    },
    otherFile: 'Un autre fichier est ouvert maintenant',
    stillReplying: 'L’assistant répond encore dans cet onglet',
    fileGone: 'Un fichier joint n’est plus disponible. Joignez-le à nouveau.',
    tooLarge:
      'Ce message est trop long pour le modèle. Retirez la puce de l’onglet ou certains fichiers, ou choisissez un modèle avec un contexte plus grand.',
    stopped: 'Arrêté',
    emptyReply: 'La réponse était vide',
    noSafeStorage:
      'Cet ordinateur ne peut pas stocker la clé de façon sécurisée ; elle n’a donc pas été enregistrée'
  },
  providers: {
    noKey: 'Aucune clé d’API enregistrée',
    keyRefused: 'La clé a été refusée',
    noCredit: 'Le compte n’a plus de crédit',
    tooMany: 'Trop de requêtes ; réessayez dans un instant',
    answered: 'Le fournisseur a répondu {status}',
    unreachable: 'Impossible de joindre {host}',
    emptyBody: 'Le fournisseur a envoyé une réponse vide',
    reportedError: 'Le fournisseur a signalé une erreur',
    notAllowed: 'Cette clé n’est pas autorisée à utiliser ce modèle',
    noSuchModel: 'Anthropic ne propose pas ce modèle',
    overloaded: 'Claude est surchargé ; réessayez dans un instant',
    anthropicAnswered: 'Anthropic a répondu{status}',
    declined: 'Claude a refusé de répondre{why}. Essayez de reformuler la question.'
  },
  attachments: {
    wrongType: 'uniquement des fichiers .txt, .md et .pdf',
    tooBig: 'plus de 20 Mo',
    noText: 'aucun texte trouvé (un PDF numérisé ?)',
    notUtf8: 'texte non UTF-8'
  },
  import: {
    completeTitle: 'Importation terminée',
    completeMessage: 'Importé : {rows}, {columns} et {tabs}.',
    rows: { one: '{count} ligne', other: '{count} lignes' },
    columns: { one: '{count} colonne', other: '{count} colonnes' },
    tabs: { one: '{count} onglet', other: '{count} onglets' },
    savedAs: 'Enregistré sous {path}',
    changes: 'Modifications faites pendant l’importation :',
    typeNames: {
      text: 'texte',
      dropdown: 'liste déroulante',
      checkbox: 'case à cocher',
      date: 'date',
      number: 'nombre'
    },
    width: '« {label} » : largeur de {from} px changée en {to} px.',
    unknownType: '« {label} » : type inconnu « {type} », importé comme texte.',
    emptyDropdown: '« {label} » : liste déroulante sans options, importée comme texte.',
    addedOptions: {
      one: '« {label} » : {count} option utilisée dans les lignes ajoutée : {options}.',
      other: '« {label} » : {count} options utilisées dans les lignes ajoutées : {options}.'
    },
    swapped: '« {label} » : minimum et maximum étaient inversés, ils ont donc été échangés.',
    widened: '« {label} » : plage élargie de {min}–{max} à {lo}–{hi} pour contenir les valeurs.',
    columnRenamed: 'Colonne « {from} » renommée « {to} ».',
    strayValues: 'Les valeurs sous « {name} » (qui n’est pas une colonne) n’ont pas été importées.',
    cleared: {
      one: '« {label} » : {count} valeur incompatible avec une colonne de type {type} laissée vide.',
      other:
        '« {label} » : {count} valeurs incompatibles avec une colonne de type {type} laissées vides.'
    },
    tallRows: {
      one: '{count} ligne plus haute que {max} px ramenée à {max} px.',
      other: '{count} lignes plus hautes que {max} px ramenées à {max} px.'
    },
    tabRenamed: 'Onglet « {from} » renommé « {to} ».',
    missingRows: {
      one: 'Onglet « {label} » : {count} ligne absente du fichier ignorée.',
      other: 'Onglet « {label} » : {count} lignes absentes du fichier ignorées.'
    }
  },
  hotkeys: {
    names: {
      newRow: 'Nouvelle ligne',
      newColumn: 'Nouvelle colonne',
      saveAs: 'Enregistrer sous',
      toggleAssistant: 'Afficher/masquer l’assistant'
    },
    fixed: {
      open: 'Ouvrir',
      preferences: 'Préférences',
      selectAll: 'Tout sélectionner',
      copy: 'Copier',
      cut: 'Couper',
      paste: 'Coller',
      undo: 'Annuler',
      redo: 'Rétablir',
      search: 'Rechercher',
      closeWindow: 'Fermer la fenêtre',
      menus: 'les menus (Alt + première lettre d’un menu, dans toutes les langues de l’application)'
    },
    useKey: 'Utilisez une lettre, un chiffre ou une touche F',
    addModifier: 'Ajoutez {key} ou Alt',
    usedBy: 'Déjà utilisé par {what}',
    resetTitle: 'Raccourcis modifiés',
    resetMessage: {
      one: 'Un raccourci a été réinitialisé',
      other: 'Des raccourcis ont été réinitialisés'
    },
    resetLine: '{name} : {key} est maintenant utilisé par {usedBy}, il revient donc à {now}.',
    resetHint: 'Vous pouvez en choisir un autre dans Paramètres > Préférences.'
  },
  claudeDesktopMain: {
    title: 'Claude Desktop',
    scriptMissing: 'Le script Claude Desktop manque dans cette version.',
    scriptMissingHint: 'Lancez « npm run build:mcp » et réessayez.',
    saveTitle: 'Enregistrer l’extension pour Claude Desktop',
    fileName: 'Review Assistant',
    filter: 'Extension Claude Desktop',
    saveFailed: 'L’extension n’a pas pu être enregistrée.',
    inUse: 'Utilisé par une autre instance de Review Assistant.',
    couldNotStart: 'Démarrage impossible : {reason}'
  }
}

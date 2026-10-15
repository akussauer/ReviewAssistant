import type { En } from './en'
import type { Messages } from './types'

// Spanish. A draft by Claude (plan M10d): to be checked by a native speaker before a release.
// "tú" throughout, as in current Windows; AND / OR / NOT stay English (they're the search
// syntax).

export const es: Messages<En> = {
  common: {
    ok: 'Aceptar',
    cancel: 'Cancelar',
    save: 'Guardar',
    close: 'Cerrar',
    delete: 'Eliminar',
    yes: 'Sí',
    no: 'No',
    none: 'Ninguno'
  },
  menu: {
    file: {
      title: 'Archivo',
      new: 'Nuevo…',
      open: 'Abrir…',
      openRecent: 'Abrir reciente',
      recentEmpty: '(vacío)',
      saveAs: 'Guardar como…',
      importJson: 'Importar JSON antiguo…',
      export: 'Exportar',
      exportCsv: 'CSV…',
      exportJson: 'JSON…',
      exportMarkdown: 'Markdown…',
      about: 'Acerca de Review Assistant',
      exit: 'Salir'
    },
    edit: {
      undo: 'Deshacer',
      undoWhat: 'Deshacer {what}',
      redo: 'Rehacer',
      redoWhat: 'Rehacer {what}',
      cut: 'Cortar',
      copy: 'Copiar',
      paste: 'Pegar',
      selectAll: 'Seleccionar todo'
    },
    settings: {
      title: 'Configuración',
      preferences: 'Preferencias…',
      plugins: 'Complementos…'
    }
  },
  app: {
    title: 'Review Assistant',
    titleWithFile: '{name} – Review Assistant',
    loadFailed: 'No se pudo cargar el archivo: {error}'
  },
  status: {
    rows: { one: '{count} fila', other: '{count} filas' },
    rowsShown: {
      one: '{shown} de {count} fila mostrada',
      other: '{shown} de {count} filas mostradas'
    },
    checked: { one: '{count} marcada', other: '{count} marcadas' },
    showInFolder: 'Mostrar en la carpeta',
    dismiss: 'Descartar',
    claudeReading: 'Claude Desktop está leyendo…'
  },
  notices: {
    failed: 'Error al {what}: {reason}',
    exported: {
      one: '{count} fila exportada a {name}',
      other: '{count} filas exportadas a {name}'
    },
    undid: 'Se deshizo el cambio en {column} ({row})',
    redid: 'Se rehízo el cambio en {column} ({row})',
    undoMissing: 'No se pudo deshacer el cambio en {column}: esa opción se ha eliminado',
    redoMissing: 'No se pudo rehacer el cambio en {column}: esa opción se ha eliminado',
    dictionaryFailed:
      'No se pudo descargar el diccionario de {language} (¿sin conexión?), así que el {language} no se revisa por ahora. Se volverá a intentar la próxima vez que se inicie la aplicación.'
  },
  // Used in "Error al {what}: …", so these are infinitives.
  actions: {
    saveAs: 'guardar como',
    importing: 'importar',
    exporting: 'exportar',
    openingFile: 'abrir el archivo',
    showingFile: 'mostrar el archivo',
    addingRow: 'añadir una fila',
    savingView: 'guardar la vista',
    savingCell: 'guardar la celda',
    savingColumnWidth: 'guardar el ancho de la columna',
    reorderingColumns: 'reordenar las columnas',
    savingRowHeight: 'guardar el alto de la fila',
    savingCheckboxes: 'guardar las casillas',
    savingSearchBar: 'guardar el ajuste de la barra de búsqueda',
    savingSort: 'guardar el orden',
    savingActiveTab: 'guardar la pestaña activa'
  },
  undo: {
    editTo: 'cambio en {column}',
    rowN: 'fila {n}'
  },
  welcome: {
    subtitle: 'Crea una revisión nueva o abre una existente.',
    new: 'Nueva revisión',
    import: 'Importar un archivo de la aplicación antigua (.json)…',
    recent: 'Recientes'
  },
  about: {
    description:
      'Una herramienta para revisar y analizar tus notas. Pensada para revisar artículos académicos y hacer análisis de subgrupos.',
    version: 'Versión',
    system: 'Sistema',
    settingsFolder: 'Carpeta de configuración',
    logFiles: 'Archivos de registro',
    openSettings: 'Abrir la carpeta de configuración',
    openLogs: 'Abrir los registros',
    copy: 'Copiar detalles',
    copied: 'Copiado',
    dictionaries:
      'Diccionarios ortográficos: SCOWL (inglés), igerman98 (alemán), Dicollecte (francés) y RLA-ES (español), con sus propias licencias (LGPL, MPL, GPL y tipo BSD); consulta LICENSES.md en la carpeta de instalación, en resources\\app.asar.unpacked\\resources\\dictionaries.'
  },
  table: {
    headerTooltip: '{name}: haz clic para ordenar, arrastra para mover',
    insertColumnBefore: 'Insertar columna antes',
    insertColumnAfter: 'Insertar columna después',
    editColumn: 'Editar…',
    deleteColumn: 'Eliminar…',
    clearFiltersLabel: 'Borrar filtros y búsqueda',
    clearFiltersTooltip: 'Borrar todos los filtros y la búsqueda',
    checkAllLabel: 'Marcar todas las filas mostradas en esta pestaña',
    checkAll: 'Marcar todas',
    uncheckAll: 'Desmarcar todas',
    rowTooltip: 'Clic derecho para ver las opciones de la fila',
    checkRow: 'Marcar fila',
    resizeRow: 'Arrastra para cambiar el alto de la fila',
    numberTooltip: 'Número entero de {min} a {max}; ↑/↓ para cambiarlo',
    newTab: 'Nueva pestaña…',
    insertRowAbove: 'Insertar fila encima',
    insertRowBelow: 'Insertar fila debajo',
    addRowTo: 'Añadir fila a…',
    addCheckedTo: {
      one: 'Añadir filas marcadas ({count}) a…',
      other: 'Añadir filas marcadas ({count}) a…'
    },
    deleteRow: 'Eliminar fila',
    deleteChecked: {
      one: 'Eliminar filas marcadas ({count})',
      other: 'Eliminar filas marcadas ({count})'
    },
    removeRow: 'Quitar fila',
    removeChecked: {
      one: 'Quitar filas marcadas ({count})',
      other: 'Quitar filas marcadas ({count})'
    },
    actions: {
      addingToTab: 'añadir a la pestaña',
      insertingRow: 'insertar una fila',
      removingRow: 'quitar la fila',
      removingRows: 'quitar las filas'
    }
  },
  columns: {
    types: {
      text: 'Texto (varias líneas)',
      dropdown: 'Lista desplegable',
      checkbox: 'Casilla',
      date: 'Fecha',
      number: 'Número'
    },
    defaultName: 'Nueva columna',
    nameEmpty: 'El nombre de la columna no puede estar vacío.',
    needOption: 'Añade al menos una opción a la lista desplegable.',
    optionEmpty: 'Las opciones no pueden estar vacías.',
    optionsDiffer: 'Cada opción debe ser distinta.',
    wholeNumbers: 'El mínimo y el máximo deben ser números enteros.',
    limits: 'Los límites deben estar dentro de ±{limit}.',
    minAboveMax: 'El valor mínimo no puede ser mayor que el máximo.',
    newTitle: 'Nueva columna',
    editTitle: 'Configuración de la columna',
    description: 'Nombre, tipo y opciones de esta columna.',
    name: 'Nombre de la columna',
    type: 'Tipo de columna',
    options: 'Opciones',
    newOption: 'Nueva opción…',
    add: 'Añadir',
    min: 'Valor mínimo',
    max: 'Valor máximo',
    preview:
      'Cambio de {from} a {to}: {converted}, {cleared}{empty}. Antes se hace una copia de seguridad.',
    converts: { one: '{count} valor se convierte', other: '{count} valores se convierten' },
    willBeCleared: { one: '{count} se borrará', other: '{count} se borrarán' },
    alreadyEmpty: { one: ', {count} ya vacío', other: ', {count} ya vacíos' },
    changeType: 'Cambiar tipo',
    noOptions: 'Aún no hay opciones.',
    dragToReorder: 'Arrastra para reordenar',
    optionN: 'Opción {n}',
    removeOption: 'Quitar {name}'
  },
  deleteColumn: {
    title: '¿Eliminar la columna «{name}»?',
    body: 'Se eliminarán para siempre la columna y todos sus datos. Antes se hace una copia de seguridad del archivo.'
  },
  deleteRows: {
    deleting: 'eliminar las filas',
    checking: 'comprobar las pestañas',
    title: { one: '¿Eliminar {count} fila?', other: '¿Eliminar {count} filas?' },
    inTabs: { one: '{count} fila está en {tabs}.', other: '{count} filas están en {tabs}.' },
    tabs: { one: '{count} pestaña', other: '{count} pestañas' },
    body: {
      one: 'Al eliminarla se quita de la tabla principal y de todas las pestañas. Antes se hace una copia de seguridad del archivo.',
      other:
        'Al eliminarlas se quitan de la tabla principal y de todas las pestañas. Antes se hace una copia de seguridad del archivo.'
    }
  },
  filter: {
    label: 'Filtrar {name}',
    any: 'Todos',
    checked: 'Marcadas',
    unchecked: 'Sin marcar',
    placeholder: 'Filtrar…',
    helpText:
      'Deben aparecer todas las palabras. "frase exacta", a OR b, a NOT b, (…), nad*. No distingue mayúsculas.',
    helpNumber:
      'Comparar: >2015, >=2015, <2020, <=2020, 2010..2020 (inclusive). Otro texto: contiene.',
    helpDate:
      'Comparar: >2019, <2020-06, 2019..2020 (cuentan años/meses enteros). Otro texto: contiene.'
  },
  tabs: {
    main: 'Principal',
    allRows: 'Todas las filas',
    tooltip: '{name} ({rows})',
    close: 'Cerrar {name}',
    editMenu: 'Editar pestaña…',
    new: 'Nueva pestaña',
    reordering: 'reordenar las pestañas',
    deleting: 'eliminar la pestaña',
    deleteTitle: '¿Eliminar {name}?',
    deleteBody: '¿Seguro que quieres eliminar {name}? Sus filas se quedan en la tabla principal.',
    nothingToUndo: 'Nada que deshacer',
    nothingToRedo: 'Nada que rehacer',
    defaultName: 'Pestaña {n}',
    nameEmpty: 'El nombre de la pestaña no puede estar vacío.',
    nameTaken: 'Ya existe una pestaña llamada «{name}».',
    newTitle: 'Nueva pestaña',
    editTitle: 'Editar pestaña',
    startsWith: { one: 'Empieza con {count} fila.', other: 'Empieza con {count} filas.' },
    description: 'Una pestaña muestra un conjunto elegido de filas de la tabla principal.',
    name: 'Nombre',
    type: 'Tipo',
    types: { review: 'Tabla de revisión', synthesis: 'Síntesis' }
  },
  search: {
    button: 'Buscar',
    showTooltip: 'Buscar (Ctrl+F)',
    hideTooltip: 'Ocultar la búsqueda (Ctrl+F)',
    label: 'Buscar en esta pestaña',
    placeholder: 'Buscar…  p. ej. pacing "elite junior" NOT cycling',
    help: 'Busca en todas las columnas de esta pestaña. Deben aparecer todas las palabras (en cualquier lugar).\n"frase exacta"   ·   a OR b   ·   a NOT b   ·   (a OR b) AND c   ·   nad* (nadar, nadador, natación…)\nAND / OR / NOT solo cuentan en MAYÚSCULAS. No distingue mayúsculas.',
    clear: 'Borrar la búsqueda'
  },
  synthesis: {
    title: 'Pestaña de síntesis',
    body: {
      one: 'Esta pestaña tiene {count} fila. La vista de síntesis llegará en una versión posterior.',
      other:
        'Esta pestaña tiene {count} filas. La vista de síntesis llegará en una versión posterior.'
    },
    hint: 'Haz clic derecho en la pestaña y elige «Editar pestaña» para volver a convertirla en una tabla de revisión.'
  },
  markdownExport: {
    title: 'Exportar a Markdown',
    loading: 'Cargando…',
    description:
      'Una nota por fila, p. ej. para un almacén de Obsidian. Las notas de la carpeta nunca se eliminan.',
    skipped: { one: '{count} omitida', other: '{count} omitidas' },
    failed: { one: '{count} con error', other: '{count} con error' },
    done: {
      one: '{count} nota exportada{counts} a {folder}',
      other: '{count} notas exportadas{counts} a {folder}'
    },
    notWritten: {
      one: 'No se pudo escribir {count}. Primer problema: {error}',
      other: 'No se pudieron escribir {count}. Primer problema: {error}'
    },
    rows: 'Filas',
    scopeChecked: { one: 'Filas marcadas ({count})', other: 'Filas marcadas ({count})' },
    scopeMain: {
      one: 'Pestaña actual – {count} mostrada',
      other: 'Pestaña actual – {count} mostradas'
    },
    scopeTab: {
      one: 'Pestaña actual ({name}) – {count} mostrada',
      other: 'Pestaña actual ({name}) – {count} mostradas'
    },
    scopeAll: { one: 'Todo ({count})', other: 'Todo ({count})' },
    folder: 'Carpeta de destino',
    noFolder: 'Ninguna carpeta elegida',
    choose: 'Elegir…',
    ifExistsLabel: 'Si una nota ya existe',
    ifExists: {
      ours: 'Sobrescribir solo las notas creadas por esta aplicación',
      skip: 'Omitir',
      overwrite: 'Sobrescribir'
    },
    columns: 'Columnas',
    column: 'Columna',
    exportAs: 'Exportar como',
    property: 'Nombre de la propiedad',
    fileName: 'Nombre de archivo',
    modes: { property: 'Propiedad', section: 'Sección', skip: 'Omitir' },
    exportColumnAs: 'Exportar {name} como',
    propertyFor: 'Nombre de la propiedad para {name}',
    nameAfter: 'Nombrar las notas según {name}',
    extra: 'Propiedades adicionales',
    tagsFromTabs: '{tags} de las pestañas en las que está cada fila',
    extraTagsLabel: 'Etiquetas adicionales',
    extraTagsPlaceholder:
      'Etiquetas adicionales, separadas por comas (p. ej. revisión/2026, por-leer)',
    header: 'Texto al principio de cada nota',
    headerPlaceholder: 'Markdown opcional, p. ej. #revisión o un enlace como [[Revisión natación]]',
    preview: 'Vista previa',
    noRows: 'No hay filas en esta selección.',
    exporting: 'Exportando…',
    exportN: { one: 'Exportar {count} nota', other: 'Exportar {count} notas' }
  },
  preferences: {
    title: 'Preferencias',
    description: 'Se aplican a todas las revisiones.',
    language: 'Idioma',
    languageSystem: 'Sistema',
    languageRestart: 'Algunas partes cambian tras reiniciar.',
    theme: 'Tema',
    themes: { system: 'Sistema', light: 'Claro', dark: 'Oscuro' },
    markdownColour: 'Color del Markdown',
    searchHighlight: 'Resaltado de búsqueda',
    spellcheck: 'Ortografía',
    spellcheckN: 'Idioma de revisión {n}',
    spellcheckOff: 'Ninguno (revisión desactivada)',
    spellcheckOffline: '{name} · sin conexión',
    spellcheckHint:
      'Hasta tres idiomas; una palabra se acepta si alguno de ellos la conoce. Los marcados «sin conexión» vienen con la aplicación; los demás se descargan una vez. Los idiomas instalados en Windows puede revisarlos Windows.',
    hotkeys: 'Atajos de teclado',
    reset: 'Restablecer valores predeterminados',
    resetTitle: '¿Restablecer los valores predeterminados?',
    resetBody:
      'El idioma, el tema, los colores del Markdown (y su prioridad), los idiomas de revisión, los atajos y el proveedor y los modelos del asistente vuelven a sus valores predeterminados (una clave de API guardada se conserva). No se guarda nada hasta que hagas clic en Guardar.',
    resetButton: 'Restablecer',
    kinds: {
      h1: '# Título 1',
      h2: '## Título 2',
      h3: '### Título 3',
      h4: '#### Título 4',
      h5: '##### Título 5',
      h6: '###### Título 6',
      bold: '**Negrita**',
      italic: '*Cursiva*',
      strike: '~~Tachado~~',
      list: '- / 1. Viñeta de lista',
      task: '- [ ] Tarea (y casillas)',
      code: '`Código en línea`',
      quote: '> Cita',
      link: '[Enlace](url)',
      rule: '--- Línea, <br>'
    },
    setByTheme: 'Definido por el tema {name}',
    override: 'Sustituir el color del tema',
    perElement: 'Colores por elemento',
    kindColour: 'Color de {name}',
    useMain: 'Usar el color principal del Markdown',
    highlightSample: 'Ritmo en {hit} de élite',
    highlightSampleHit: 'natación',
    pressKeys: 'Pulsa una combinación de teclas…'
  },
  assistantSettings: {
    keyRemoved: 'Se quitará al guardar',
    keySaved: 'Guardada (escribe para sustituirla)',
    keyPaste: 'Pega tu clave de API',
    provider: 'Proveedor',
    providers: {
      openrouter: 'OpenRouter',
      anthropic: 'Anthropic (Claude)',
      openai: 'Compatible con OpenAI',
      ollama: 'Ollama (en este equipo)'
    },
    address: 'Dirección',
    key: 'Clave de API',
    remove: 'Quitar',
    testing: 'Probando…',
    test: 'Probar',
    checking: 'Comprobando…',
    models: 'Modelos',
    fallback: 'Contexto si se desconoce',
    thousandTokens: 'miles de tokens',
    showMeter: 'Mostrar el contador de tokens',
    showCosts: 'Mostrar los costes (si el proveedor da precios)',
    refresh: 'Actualizar',
    load: 'Cargar modelos',
    useSuggested: 'Usar sugeridos',
    usingSuggested: 'Se usan los modelos sugeridos hasta que elijas alguno.',
    searchModels: 'Buscar modelos',
    searchN: { one: 'Buscar entre {count} modelo…', other: 'Buscar entre {count} modelos…' },
    default: 'Predeterminado',
    priceTooltip: 'USD por millón de tokens, entrada / salida',
    price: '$/1M entrada · salida',
    context: 'Contexto',
    enable: 'Activar {name}',
    makeDefault: 'Usar {name} como predeterminado'
  },
  claudeDesktop: {
    notConnected: 'No conectado',
    off: 'Desactivado: nada está escuchando.',
    waiting: 'Activado: esperando a Claude Desktop.',
    read: {
      one: 'Activado: Claude ha leído la revisión {count} vez (la última a las {time}).',
      other: 'Activado: Claude ha leído la revisión {count} veces (la última a las {time}).'
    },
    title: 'Conectar con Claude Desktop',
    description:
      'Habla de tu revisión en Claude Desktop, con tu propio plan de Claude en lugar de una clave de API. Claude puede listar las pestañas y leer o buscar las filas de la revisión abierta aquí. No puede cambiar nada.',
    switch: 'Permitir que Claude Desktop lea la revisión abierta',
    turnsOn: 'Se activa al pulsar Guardar.',
    turnsOff: 'Se desactiva al pulsar Guardar.',
    saving: 'Guardando…',
    saveButton: 'Guardar la extensión para Claude Desktop…',
    saved:
      'Guardada. Haz doble clic en el archivo (o arrástralo a Claude Desktop) para instalarla. Solo hace falta una vez.',
    setup:
      'Configuración única: guarda la extensión y haz doble clic en ella para instalarla en Claude Desktop.'
  },
  plugins: {
    title: 'Complementos',
    description: 'Los temas y complementos se aplican a todas las revisiones.',
    defaultTheme: 'Predeterminado',
    fromVault: '{name} (almacén)',
    addTheme: 'Añadir tema…',
    vaultReadOnly: 'Los temas de tu almacén no se modifican aquí',
    vault: 'Almacén',
    noVault: 'Ninguno: elige un almacén de Obsidian para usar sus temas',
    vaultMissing: '(no se encuentra su carpeta .obsidian)',
    clear: 'Quitar',
    coloursOnly: 'Solo se usan los colores de un tema. Claro u oscuro se elige en Preferencias.',
    openThemes: 'Abrir la carpeta de temas',
    openPlugins: 'Abrir la carpeta de complementos',
    deleteTheme: '¿Eliminar el tema «{name}»?',
    deletePlugin: '¿Eliminar el complemento «{name}»?',
    recycleBin: 'Su carpeta se mueve a la Papelera de reciclaje.',
    backToDefault: 'La aplicación vuelve al tema predeterminado.',
    none: 'No hay complementos instalados. Los complementos aún no están disponibles; los de la comunidad aparecerán aquí.',
    author: 'Autor',
    descriptionColumn: 'Descripción',
    enabled: 'Activado'
  },
  assistant: {
    thisTab: { one: 'Esta pestaña ({count} fila)', other: 'Esta pestaña ({count} filas)' },
    toggling: 'activar o desactivar el asistente',
    savingWidth: 'guardar el ancho del panel',
    savingModel: 'guardar el modelo',
    clearing: 'borrar la conversación',
    label: 'Asistente',
    resize: 'Cambiar el tamaño del panel del asistente',
    model: 'Modelo',
    noModels: 'No hay modelos activados',
    defaultModel: '{name} (predeterminado)',
    newChat: 'Nueva conversación',
    newChatTooltip: 'Eliminar la conversación de esta pestaña y empezar de nuevo',
    close: 'Cerrar el asistente',
    stale: '{old} ya no está activado; se usa {now}.',
    chooseModels: 'Elige modelos en Configuración → Preferencias → Asistente.',
    checking: 'Comprobando la clave del asistente…',
    readOnly: '{reason} La conversación es de solo lectura.',
    unavailableSentence: 'El asistente no está disponible.',
    long: {
      one: 'Esta conversación es larga: el mensaje más antiguo ({count}) ya no se envía. Se recomienda una {newChat}.',
      other:
        'Esta conversación es larga: los {count} mensajes más antiguos ya no se envían. Se recomienda una {newChat}.'
    },
    newChatLink: 'nueva conversación',
    unavailablePlaceholder: 'El asistente no está disponible',
    placeholder: 'Pregunta algo sobre esta pestaña…',
    meterTooltip:
      'Tokens estimados que se envían con el próximo mensaje (unos 4 caracteres cada uno), sobre lo que admite el modelo',
    meter: '~{used} / {limit} tokens',
    oldestNotSent: {
      one: '{count} más antiguo sin enviar',
      other: '{count} más antiguos sin enviar'
    },
    nextCostTooltip: 'Coste de entrada estimado del próximo mensaje',
    nextCost: '~{cost} próximo',
    costEstimated: 'El coste de algunas respuestas es estimado o desconocido',
    costReported: 'Según el proveedor',
    tabCost: '{cost} esta pestaña',
    stop: 'Detener',
    send: 'Enviar',
    clearTitle: '¿Empezar una nueva conversación?',
    clearBody:
      'Se eliminan la conversación de «{name}» y su coste acumulado. Tus filas no se ven afectadas.',
    filesReferenced: {
      one: '{count} archivo adjunto: {names}',
      other: '{count} archivos adjuntos: {names}'
    },
    empty:
      'Pregunta sobre las filas que se muestran en esta pestaña. El asistente puede leerlas, pero nunca las cambia.',
    thinking: 'Pensando…',
    attachTooltip: 'Adjuntar archivos .txt, .md o .pdf al próximo mensaje',
    rowsChipTooltip:
      'Las filas mostradas en esta pestaña (tras los filtros), con todas las columnas. Quítalo para no enviarlas con el próximo mensaje.',
    addThisTab: 'Esta pestaña',
    fileTooltip: '{name} · ~{tokens} tokens',
    message: 'Mensaje',
    hide: 'Ocultar el asistente en esta pestaña ({key})',
    show: 'Mostrar el asistente en esta pestaña ({key})',
    image: '[imagen]',
    imageAlt: '[imagen: {alt}]'
  },
  editMenu: {
    noSuggestions: 'No hay sugerencias',
    addToDictionary: 'Añadir al diccionario'
  },
  files: {
    filterReview: 'Archivos de revisión',
    filterOldJson: 'Archivos del antiguo Review Assistant',
    filterReviewOrJson: 'Archivos de revisión (y .json antiguos)',
    filterKind: 'Archivos {what}',
    newTitle: 'Nueva revisión',
    untitled: 'Sin título',
    openTitle: 'Abrir revisión',
    saveAsTitle: 'Guardar como',
    copyName: '{name} copia',
    saveOnlyChecked: '¿Guardar solo las filas marcadas?',
    exportTitle: 'Exportar como {what}',
    exportOnlyChecked: '¿Exportar solo las filas marcadas?',
    checkedOfTotal: {
      one: '{count} de {total} filas está marcada.',
      other: '{count} de {total} filas están marcadas.'
    },
    importTitle: 'Importar JSON antiguo',
    importSaveTitle: 'Guardar la revisión importada como',
    markdownFolderTitle: 'Exportar las notas a una carpeta'
  },
  errors: {
    unexpected: 'Error inesperado: {message}',
    fileNotFound: 'No se encuentra el archivo:\n{path}',
    notAReviewFile: 'No es un archivo de revisión:\n{path}',
    couldNotCreate: 'No se pudo crear el archivo de revisión',
    couldNotOpen: 'No se pudo abrir el archivo de revisión',
    couldNotOpenFile: 'No se pudo abrir el archivo',
    couldNotReopen: 'No se pudo volver a abrir el último archivo de revisión',
    couldNotSaveCopy: 'No se pudo guardar una copia',
    couldNotImport: 'No se pudo importar el archivo',
    couldNotExport: 'No se pudo exportar el archivo',
    couldNotExportNotes: 'No se pudieron exportar las notas',
    sameAsOpen: 'Es el archivo que ya está abierto. Elige otro nombre.',
    sameAsImported: 'Es el archivo JSON que se está importando. Elige otro nombre.',
    fileIsOpen: 'Ese archivo está abierto. Elige otro nombre.',
    sameAsOpenReview: 'Es el archivo de revisión abierto. Elige otro nombre.',
    chooseFolderFirst: 'Elige primero una carpeta de destino.',
    folderGone: 'La carpeta de destino ya no existe:\n{path}',
    newerVersion:
      'Este archivo se guardó con una versión más reciente de Review Assistant. Actualiza la aplicación.',
    sqliteNotReview: 'Es una base de datos SQLite, pero no un archivo de revisión.',
    notReview: 'Este archivo no es un archivo de revisión.',
    notJson: 'Este archivo no es un JSON válido.',
    notOldJson:
      'Este archivo JSON no lo guardó el antiguo Review Assistant (necesita "columns" y "rows").',
    crashed: 'Review Assistant se ha cerrado inesperadamente',
    lateEdit: 'Cambio no guardado: se abrió otro archivo antes de que llegara',
    columnExists: 'Ya existe una columna llamada «{name}»',
    tabExists: 'Ya existe una pestaña llamada «{name}»'
  },
  addons: {
    themeMissing: 'Ese tema no está instalado',
    addTitle: 'Añadir un tema de Obsidian',
    themeFilter: 'Tema de Obsidian',
    replaceTitle: '¿Sustituir el tema?',
    replaceMessage: 'Ya hay instalado un tema llamado «{name}». ¿Sustituirlo?',
    replace: 'Sustituir',
    addFailed: 'No se pudo añadir el tema',
    vaultThemeDelete: 'Los temas de un almacén no se pueden eliminar aquí',
    vaultTitle: 'Elige tu almacén de Obsidian',
    notVault: 'No es un almacén de Obsidian',
    notVaultDetail:
      'Esa carpeta no tiene una carpeta .obsidian. Elige la carpeta del almacén en sí.',
    pluginMissing: 'Ese complemento no está instalado',
    pluginInvalid: 'Este complemento no tiene un manifiesto válido',
    noThemeColours:
      'Este archivo no tiene colores de tema (variables CSS en body, .theme-light o .theme-dark).',
    noManifest: 'Sin manifest.json',
    invalidManifest: 'Manifiesto no válido'
  },
  assistantMain: {
    noKey: 'No hay clave de API. Configura una en Configuración → Preferencias.',
    checkFailed: 'Falló la comprobación de la clave: {reason}',
    connected: 'Conectado',
    unavailable: 'El asistente no está disponible',
    attachTitle: 'Adjuntar archivos',
    attachFilter: 'Texto, Markdown o PDF',
    attachFailed: {
      one: 'No se pudo adjuntar un archivo',
      other: 'No se pudieron adjuntar algunos archivos'
    },
    otherFile: 'Ahora hay otro archivo abierto',
    stillReplying: 'El asistente aún está respondiendo en esta pestaña',
    fileGone: 'Un archivo adjunto ya no está disponible. Vuelve a adjuntarlo.',
    tooLarge:
      'Este mensaje es demasiado grande para el modelo. Quita la etiqueta de la pestaña o algunos archivos, o elige un modelo con más contexto.',
    stopped: 'Detenido',
    emptyReply: 'La respuesta estaba vacía',
    noSafeStorage: 'Este equipo no puede guardar la clave de forma segura, así que no se guardó'
  },
  providers: {
    noKey: 'No hay ninguna clave de API guardada',
    keyRefused: 'La clave fue rechazada',
    noCredit: 'La cuenta no tiene saldo',
    tooMany: 'Demasiadas solicitudes; vuelve a intentarlo en un momento',
    answered: 'El proveedor respondió {status}',
    unreachable: 'No se pudo conectar con {host}',
    emptyBody: 'El proveedor envió una respuesta vacía',
    reportedError: 'El proveedor informó de un error',
    notAllowed: 'Esta clave no puede usar ese modelo',
    noSuchModel: 'Anthropic no ofrece ese modelo',
    overloaded: 'Claude está sobrecargado; vuelve a intentarlo en un momento',
    anthropicAnswered: 'Anthropic respondió{status}',
    declined: 'Claude se negó a responder{why}. Prueba a formular la pregunta de otra manera.'
  },
  attachments: {
    wrongType: 'solo archivos .txt, .md y .pdf',
    tooBig: 'más de 20 MB',
    noText: 'no se encontró texto (¿un PDF escaneado?)',
    notUtf8: 'no es texto UTF-8'
  },
  import: {
    completeTitle: 'Importación completada',
    completeMessage: 'Importado: {rows}, {columns} y {tabs}.',
    rows: { one: '{count} fila', other: '{count} filas' },
    columns: { one: '{count} columna', other: '{count} columnas' },
    tabs: { one: '{count} pestaña', other: '{count} pestañas' },
    savedAs: 'Guardado como {path}',
    changes: 'Cambios hechos durante la importación:',
    typeNames: {
      text: 'texto',
      dropdown: 'lista desplegable',
      checkbox: 'casilla',
      date: 'fecha',
      number: 'número'
    },
    width: '«{label}»: ancho cambiado de {from} px a {to} px.',
    unknownType: '«{label}»: tipo desconocido «{type}», importado como texto.',
    emptyDropdown: '«{label}»: lista desplegable sin opciones, importada como texto.',
    addedOptions: {
      one: '«{label}»: se añadió {count} opción usada en las filas: {options}.',
      other: '«{label}»: se añadieron {count} opciones usadas en las filas: {options}.'
    },
    swapped: '«{label}»: el mínimo y el máximo estaban al revés, así que se intercambiaron.',
    widened: '«{label}»: rango ampliado de {min}–{max} a {lo}–{hi} para que quepan los valores.',
    columnRenamed: 'Columna «{from}» renombrada como «{to}».',
    strayValues: 'Los valores bajo «{name}» (que no es una columna) no se importaron.',
    cleared: {
      one: '«{label}»: {count} valor que no encajaba en una columna de tipo {type} se dejó vacío.',
      other:
        '«{label}»: {count} valores que no encajaban en una columna de tipo {type} se dejaron vacíos.'
    },
    tallRows: {
      one: '{count} fila de más de {max} px se ajustó a {max} px.',
      other: '{count} filas de más de {max} px se ajustaron a {max} px.'
    },
    tabRenamed: 'Pestaña «{from}» renombrada como «{to}».',
    missingRows: {
      one: 'Pestaña «{label}»: se omitió {count} fila que ya no está en el archivo.',
      other: 'Pestaña «{label}»: se omitieron {count} filas que ya no están en el archivo.'
    }
  },
  hotkeys: {
    names: {
      newRow: 'Nueva fila',
      newColumn: 'Nueva columna',
      saveAs: 'Guardar como',
      toggleAssistant: 'Mostrar/ocultar el asistente'
    },
    fixed: {
      open: 'Abrir',
      preferences: 'Preferencias',
      selectAll: 'Seleccionar todo',
      copy: 'Copiar',
      cut: 'Cortar',
      paste: 'Pegar',
      undo: 'Deshacer',
      redo: 'Rehacer',
      search: 'Buscar',
      closeWindow: 'Cerrar la ventana',
      menus: 'los menús (Alt + primera letra de un menú, en cualquier idioma de la aplicación)'
    },
    useKey: 'Usa una letra, un número o una tecla F',
    addModifier: 'Añade {key} o Alt',
    usedBy: 'Ya está ocupado por {what}',
    resetTitle: 'Atajos cambiados',
    resetMessage: {
      one: 'Se restableció un atajo',
      other: 'Se restablecieron algunos atajos'
    },
    resetLine: '{name}: {key} está ahora ocupado por {usedBy}, así que vuelve a ser {now}.',
    resetHint: 'Puedes elegir otro en Configuración > Preferencias.'
  },
  claudeDesktopMain: {
    title: 'Claude Desktop',
    scriptMissing: 'Falta el script de Claude Desktop en esta compilación.',
    scriptMissingHint: 'Ejecuta «npm run build:mcp» y vuelve a intentarlo.',
    saveTitle: 'Guardar la extensión para Claude Desktop',
    fileName: 'Review Assistant',
    filter: 'Extensión de Claude Desktop',
    saveFailed: 'No se pudo guardar la extensión.',
    inUse: 'En uso por otra instancia de Review Assistant.',
    couldNotStart: 'No se pudo iniciar: {reason}'
  }
}

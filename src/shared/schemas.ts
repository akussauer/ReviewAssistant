// Zod schemas for every IPC payload. Main validates each incoming payload with these,
// because the renderer is treated as untrusted input (like a web form posting to a server).
// `satisfies z.ZodType<T>` makes TypeScript check that each schema matches its type in ipc.ts.
import { z } from 'zod'
import {
  APP_FOLDERS,
  COLUMN_TYPES,
  EXPORT_MODES,
  fixedShortcut,
  IF_EXISTS,
  MARKDOWN_SCOPES,
  HOTKEY_NAMES,
  MARKDOWN_KINDS,
  PROVIDERS,
  MAX_SPELLCHECK_LANGUAGES,
  type AssistantSettings,
  type ConnectionInput,
  type ExportKind,
  type ColumnExport,
  type MarkdownExportInput,
  type MarkdownSettings,
  type SendInput,
  type Settings,
  type CellValue,
  type ColumnCreateInput,
  type ColumnOptionsInput,
  type ColumnUpdateInput,
  type RowCreateInput,
  type TabCreateInput,
  type TabView,
  type TabUpdateInput
} from './ipc'
import { UI_LANGUAGES } from './i18n/locales'

export const NoInput = z.undefined()

export const Id = z.number().int().positive()
export const IdList = z.array(Id)
export const PathInput = z.string().min(1)

const Label = z.string().trim().min(1, 'Name cannot be empty').max(200)

export const CellValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null()
]) satisfies z.ZodType<CellValue>

const ColumnOptionsInputSchema = z.object({
  choices: z
    .array(z.object({ id: z.string().min(1).optional(), label: z.string().trim().min(1) }))
    .optional(),
  // Same range as the reference app's spin boxes.
  min: z.number().int().min(-999999).max(999999).optional(),
  max: z.number().int().min(-999999).max(999999).optional()
}) satisfies z.ZodType<ColumnOptionsInput>

export const ColumnCreateSchema = z.object({
  label: Label,
  type: z.enum(COLUMN_TYPES),
  options: ColumnOptionsInputSchema,
  width: z.number().int().min(20).max(5000).optional(),
  index: z.number().int().min(0).optional()
}) satisfies z.ZodType<ColumnCreateInput>

export const ColumnUpdateSchema = z.object({
  id: Id,
  label: Label.optional(),
  type: z.enum(COLUMN_TYPES).optional(),
  options: ColumnOptionsInputSchema.optional(),
  width: z.number().int().min(20).max(5000).optional()
}) satisfies z.ZodType<ColumnUpdateInput>

export const RowCreateSchema = z
  .object({ before: Id.optional(), after: Id.optional(), tabId: Id.optional() })
  .refine((v) => v.before === undefined || v.after === undefined, 'Use before or after, not both')
  .optional() satisfies z.ZodType<RowCreateInput | undefined>

export const UpdateCellSchema = z.object({
  rowId: Id,
  columnId: Id,
  value: CellValueSchema,
  generation: z.number().int().optional()
})
export const SetHeightSchema = z.object({ rowId: Id, height: z.number().int().min(16).max(5000) })
export const SetCheckedSchema = z.object({ rowIds: IdList, checked: z.boolean() })
export const CheckAllSchema = z.boolean()

export const SearchBarSchema = z.boolean()
export const AppFolderSchema = z.enum(APP_FOLDERS)

const TabType = z.enum(['review', 'synthesis'])
const View = z.looseObject({
  sort: z.object({ columnId: Id, desc: z.boolean() }).nullable().optional(),
  search: z.string().max(2000).optional(),
  filters: z.record(z.string(), z.string().max(2000)).optional()
}) satisfies z.ZodType<TabView>

export const TabCreateSchema = z.object({
  label: Label,
  type: TabType,
  rowIds: IdList.optional()
}) satisfies z.ZodType<TabCreateInput>

export const TabUpdateSchema = z.object({
  id: Id,
  label: Label.optional(),
  type: TabType.optional(),
  assistantEnabled: z.boolean().optional(),
  assistantWidth: z.number().int().min(200).max(5000).nullable().optional(),
  assistantModel: z.string().min(1).max(300).nullable().optional(),
  view: View.optional()
}) satisfies z.ZodType<TabUpdateInput>

export const SeedCountSchema = z.number().int().min(1).max(100_000)

export const TabRowsSchema = z.object({ tabId: Id, rowIds: IdList })

export const ExportKindSchema = z.enum(['csv', 'json']) satisfies z.ZodType<ExportKind>

const ColumnExportSchema = z.object({
  mode: z.enum(EXPORT_MODES),
  property: z.string().max(100).optional()
}) satisfies z.ZodType<ColumnExport>

export const MarkdownSettingsSchema = z.object({
  scope: z.enum(MARKDOWN_SCOPES),
  fileNameColumnId: Id.nullable(),
  ifExists: z.enum(IF_EXISTS),
  tagsFromTabs: z.boolean(),
  extraTags: z.string().max(2000),
  source: z.boolean(),
  header: z.string().max(20_000)
}) satisfies z.ZodType<MarkdownSettings>

export const MarkdownExportSchema = z.object({
  rowIds: IdList.min(1, 'No rows to export').max(100_000),
  settings: MarkdownSettingsSchema,
  columns: z.array(z.object({ id: Id, export: ColumnExportSchema })).max(1000)
}) satisfies z.ZodType<MarkdownExportInput>

// A hotkey: Ctrl/Cmd or Alt (optionally Shift), then a letter, digit or F1–F12.
export const AcceleratorSchema = z
  .string()
  .regex(
    /^(CmdOrCtrl\+)?(Alt\+)?(Shift\+)?([A-Z0-9]|F[1-9]|F1[0-2])$/,
    'Use Ctrl or Alt with a letter, digit or F-key'
  )
  .refine((a) => /CmdOrCtrl|Alt/.test(a), 'Add Ctrl or Alt')
  .refine((a) => !fixedShortcut(a), 'Already used by a fixed shortcut')

export const ThemeSchema = z.enum(['light', 'dark', 'system'])
export const UiLanguageSchema = z.enum(UI_LANGUAGES)

export const HexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a colour like #0E80A3')

// A menu item's position in the application menu (plan M10c), e.g. "0.3".
export const MenuClickSchema = z.object({
  id: z.string().regex(/^\d{1,3}(\.\d{1,3}){0,4}$/),
  label: z.string().max(1000)
})
export const TitleBarColoursSchema = z.object({ color: HexColour, symbolColor: HexColour })

export const ProviderSchema = z.enum(PROVIDERS)

// '' = the provider's usual address. Only http(s), so a typo can't point at a file.
const BaseUrl = z
  .string()
  .trim()
  .max(500)
  .refine((u) => u === '' || /^https?:\/\/[^\s]+$/i.test(u), 'Use an http:// or https:// address')

const ModelId = z.string().min(1).max(300)

export const AssistantSettingsSchema = z.object({
  provider: ProviderSchema,
  baseUrl: BaseUrl,
  enabledModels: z.array(ModelId).max(500),
  defaultModel: ModelId.nullable(),
  fallbackContext: z.number().int().min(1_000).max(10_000_000),
  showMeter: z.boolean(),
  showCosts: z.boolean()
}) satisfies z.ZodType<AssistantSettings>

// A Chromium spellcheck code, e.g. "de-DE", "es-419", "en-GB-oxendict", "hy". Main also
// drops ones the spellchecker doesn't offer.
export const SpellcheckCode = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
export const SpellcheckLanguagesSchema = z
  .array(SpellcheckCode)
  .max(MAX_SPELLCHECK_LANGUAGES)
  .refine((codes) => new Set(codes).size === codes.length, 'A language is chosen twice')

export const SettingsSchema = z.object({
  theme: ThemeSchema,
  uiLanguage: UiLanguageSchema,
  spellcheckLanguages: SpellcheckLanguagesSchema,
  markdownColour: HexColour,
  markdownColourOverride: z.boolean(),
  markdownColours: z.partialRecord(z.enum(MARKDOWN_KINDS), HexColour),
  searchHighlightColour: HexColour,
  searchHighlightOverride: z.boolean(),
  hotkeys: z
    .object({
      newRow: AcceleratorSchema,
      newColumn: AcceleratorSchema,
      saveAs: AcceleratorSchema,
      toggleAssistant: AcceleratorSchema
    })
    .refine(
      (h) => new Set(Object.values(h)).size === HOTKEY_NAMES.length,
      'Each hotkey must be different'
    ),
  assistant: AssistantSettingsSchema,
  claudeDesktop: z.boolean()
}) satisfies z.ZodType<Settings>

// The key being typed in Preferences. Trimmed, since pasting often adds a space.
const ApiKey = z.string().trim().min(1, 'Enter a key').max(1000)

export const ConnectionInputSchema = z.object({
  provider: ProviderSchema,
  baseUrl: BaseUrl,
  key: ApiKey.optional()
}) satisfies z.ZodType<ConnectionInput>

export const SetKeySchema = z.object({ provider: ProviderSchema, key: ApiKey.nullable() })

// A chat message: generous, but it has to fit in a request.
export const SendInputSchema = z.object({
  tabId: Id,
  text: z.string().trim().min(1, 'Type a message').max(200_000),
  rowIds: IdList.nullable(),
  fileIds: z.array(z.string().uuid()).max(50),
  model: ModelId,
  generation: z.number().int()
}) satisfies z.ZodType<SendInput>

export const FileIdSchema = z.string().uuid()

// A folder name inside our Themes/Plugins folders (main also checks it's one it listed).
export const FolderName = z
  .string()
  .min(1)
  .max(255)
  .refine((f) => !/[\\/]/.test(f) && f !== '.' && f !== '..', 'Not a folder name')

export const ThemeIdSchema = z
  .string()
  .regex(/^(local|vault):/, 'Not a theme id')
  .refine((id) => FolderName.safeParse(id.slice(id.indexOf(':') + 1)).success, 'Not a theme id')
export const ActiveThemeIdSchema = ThemeIdSchema.nullable()

export const PluginEnabledSchema = z.object({ folder: FolderName, enabled: z.boolean() })

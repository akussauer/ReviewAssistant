// Zod schemas for every IPC payload. Main validates each incoming payload with these,
// because the renderer is treated as untrusted input (like a web form posting to a server).
// `satisfies z.ZodType<T>` makes TypeScript check that each schema matches its type in ipc.ts.
import { z } from 'zod'
import {
  COLUMN_TYPES,
  type CellValue,
  type ColumnCreateInput,
  type ColumnOptionsInput,
  type ColumnUpdateInput,
  type RowCreateInput,
  type TabCreateInput,
  type TabView,
  type TabUpdateInput
} from './ipc'

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

const TabType = z.enum(['review', 'synthesis'])
const View = z.looseObject({
  sort: z.object({ columnId: Id, desc: z.boolean() }).nullable().optional()
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
  view: View.optional()
}) satisfies z.ZodType<TabUpdateInput>

export const SeedCountSchema = z.number().int().min(1).max(100_000)

export const TabRowsSchema = z.object({ tabId: Id, rowIds: IdList })

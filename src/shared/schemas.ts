// Zod schemas for every IPC payload. Main validates each incoming payload with these,
// because the renderer is treated as untrusted input (like a web form posting to a server).
import { z } from 'zod'

export const NoInput = z.undefined()

export const CellValueSchema = z.union([z.string(), z.number(), z.null()])

export const UpdateArticleInput = z.object({
  id: z.number().int().positive(),
  patch: z.record(z.string(), CellValueSchema)
})

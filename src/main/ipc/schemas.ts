import { z } from 'zod'

export const UpdateArticleInput = z.object({
  id: z.number().int().positive(),
  patch: z.record(z.string(), z.union([z.string(), z.number(), z.null()]))
})
import { z } from 'zod';

export const itemSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().max(500).optional(),
    amount: z.number().finite().optional(),
    monthly: z.number().finite().optional(),
  })
  .passthrough();

export const archiveItemSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().max(500).optional(),
    year: z.number().int().min(1900).max(2200).optional(),
    months: z.array(z.number().finite()).length(12).optional(),
  })
  .passthrough();

export type ItemInput = z.infer<typeof itemSchema>;
export type ArchiveItemInput = z.infer<typeof archiveItemSchema>;

export const toItem = (input: ItemInput) => ({
  id: input.id,
  name: input.name ?? '',
  amount: input.amount ?? 0,
  monthly: input.monthly ?? 0,
});

export const toArchiveItem = (input: ArchiveItemInput) => ({
  id: input.id,
  name: input.name ?? '',
  year: input.year ?? new Date().getFullYear(),
  months: input.months ?? new Array<number>(12).fill(0),
});

export const budgetPlanSchema = z
  .object({
    items: z.array(z.unknown()),
    updatedAt: z.string().datetime().optional(),
  })
  .strict();

export const collectionSchema = z.enum(['assets', 'liabilities', 'income', 'income_archive']);

export type CollectionParam = z.infer<typeof collectionSchema>;

export const syncOperationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('upsert'),
    operationId: z.string().optional(),
    collection: collectionSchema,
    item: z.union([itemSchema, archiveItemSchema]),
  }),
  z.object({
    op: z.literal('delete'),
    operationId: z.string().optional(),
    collection: collectionSchema,
    itemId: z.string().min(1),
  }),
  z.object({
    op: z.literal('clear'),
    operationId: z.string().optional(),
    collection: collectionSchema,
  }),
  z.object({
    op: z.literal('budget_plan'),
    operationId: z.string().optional(),
    items: z.array(z.unknown()),
    updatedAt: z.string().optional(),
  }),
]);

export type SyncOperation = z.infer<typeof syncOperationSchema>;

export const syncRequestSchema = z
  .object({
    clientId: z.string().min(1).max(200),
    operations: z.array(syncOperationSchema).min(1).max(500),
  })
  .strict();

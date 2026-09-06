import { z } from "zod";

export const CURRENCIES = ["IQD", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const moneySchema = z.object({
  currency: z.enum(CURRENCIES),
  value: z.number().positive(),
});

export type Money = z.infer<typeof moneySchema>;

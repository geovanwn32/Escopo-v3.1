/**
 * @fileOverview Zod schemas and TypeScript types for the createAccountingEntries flow.
 * These are in a separate file to avoid exporting non-functions from a 'use server' file.
 */

import { z } from 'genkit';

export const CreateAccountingEntriesInputSchema = z.object({
  userId: z.string().describe('The ID of the user.'),
  companyId: z.string().describe('The ID of the company.'),
  year: z.number().describe('The year of the launches to process.'),
  month: z.number().describe('The month of the launches to process.'),
});
export type CreateAccountingEntriesInput = z.infer<typeof CreateAccountingEntriesInputSchema>;

export const CreateAccountingEntriesOutputSchema = z.object({
    success: z.boolean().describe('Whether the operation was successful.'),
    message: z.string().describe('A message describing the result.'),
    entriesCreated: z.number().describe('The number of accounting entries created.'),
});
export type CreateAccountingEntriesOutput = z.infer<typeof CreateAccountingEntriesOutputSchema>;

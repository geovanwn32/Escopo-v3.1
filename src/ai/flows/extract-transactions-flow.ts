
'use server';
/**
 * @fileOverview An AI flow to extract bank statement transactions from text.
 *
 * - extractBankTransactions - Extracts transactions from a file buffer.
 * - BankTransaction - The schema for a single extracted transaction.
 * - BankTransactionExtractionInput - The input schema for the flow.
 * - BankTransactionExtractionOutput - The output schema for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BankTransactionSchema = z.object({
  date: z.string().describe('The date of the transaction in YYYY-MM-DD format.'),
  description: z.string().describe('The full description of the transaction as it appears on the statement.'),
  amount: z.number().describe('The value of the transaction. Positive for credits/income, negative for debits/expenses.'),
  type: z.enum(['credit', 'debit']).describe('The type of transaction: credit (income) or debit (expense).'),
});
export type BankTransaction = z.infer<typeof BankTransactionSchema>;

const BankTransactionExtractionInputSchema = z.object({
  textContent: z.string().describe("The full text content extracted from a bank statement file (PDF, TXT, CSV, etc.)."),
});
export type BankTransactionExtractionInput = z.infer<typeof BankTransactionExtractionInputSchema>;

const BankTransactionExtractionOutputSchema = z.object({
  transactions: z.array(BankTransactionSchema),
});
export type BankTransactionExtractionOutput = z.infer<typeof BankTransactionExtractionOutputSchema>;


const prompt = ai.definePrompt({
    name: 'extractBankTransactionsPrompt',
    input: {schema: BankTransactionExtractionInputSchema },
    output: {schema: BankTransactionExtractionOutputSchema},
    prompt: `You are an expert financial analyst specializing in parsing bank statements. Your task is to extract all individual transactions from the provided text content.

    Analyze the text content below and identify each transaction line. For each transaction, extract the following details:
    1.  **date**: The date the transaction occurred. Standardize it to YYYY-MM-DD format.
    2.  **description**: The full, unchanged description of the transaction.
    3.  **amount**: The numerical value of the transaction. Use a positive number for credits (entradas, depósitos) and a negative number for debits (saídas, pagamentos, saques).
    4.  **type**: Classify the transaction as either 'credit' or 'debit'.

    Ignore summary lines, headers, footers, and any text that is not a specific transaction.

    Bank Statement Content:
    \`\`\`
    {{{textContent}}}
    \`\`\`
    `,
});

const extractBankTransactionsFlow = ai.defineFlow(
  {
    name: 'extractBankTransactionsFlow',
    inputSchema: BankTransactionExtractionInputSchema,
    outputSchema: BankTransactionExtractionOutputSchema,
  },
  async (input) => {
    
    if (!input.textContent) {
        throw new Error("Text content is empty.");
    }

    const {output} = await prompt(input);

    if (!output) {
      throw new Error("The AI model failed to return an output.");
    }
    return output;
  }
);

// Export a wrapper function to be called from the server-side component.
export async function extractBankTransactions(input: BankTransactionExtractionInput): Promise<BankTransactionExtractionOutput> {
    return extractBankTransactionsFlow(input);
}

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
import * as XLSX from 'xlsx';
import pdf from 'pdf-parse';

const BankTransactionSchema = z.object({
  date: z.string().describe('The date of the transaction in YYYY-MM-DD format.'),
  description: z.string().describe('The full description of the transaction as it appears on the statement.'),
  amount: z.number().describe('The value of the transaction. Positive for credits/income, negative for debits/expenses.'),
  type: z.enum(['credit', 'debit']).describe('The type of transaction: credit (income) or debit (expense).'),
});
export type BankTransaction = z.infer<typeof BankTransactionSchema>;

const BankTransactionExtractionInputSchema = z.object({
  fileDataUri: z.string().describe("A file (PDF, TXT, CSV, XLSX) encoded as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  mimeType: z.string().describe("The MIME type of the file, e.g., 'application/pdf' or 'text/csv'."),
});
export type BankTransactionExtractionInput = z.infer<typeof BankTransactionExtractionInputSchema>;

const BankTransactionExtractionOutputSchema = z.object({
  transactions: z.array(BankTransactionSchema),
});
export type BankTransactionExtractionOutput = z.infer<typeof BankTransactionExtractionOutputSchema>;


const prompt = ai.definePrompt({
    name: 'extractBankTransactionsPrompt',
    input: {schema: z.object({ textContent: z.string() }) },
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
    
    const base64Data = input.fileDataUri.split(',')[1];
    const fileBuffer = Buffer.from(base64Data, 'base64');
    let textContent = '';

    if (input.mimeType.includes('spreadsheetml') || input.mimeType.includes('ms-excel') || input.mimeType.includes('csv')) {
        const workbook = XLSX.read(fileBuffer);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        textContent = XLSX.utils.sheet_to_csv(worksheet);
    } else if (input.mimeType === 'application/pdf') {
        const data = await pdf(fileBuffer);
        textContent = data.text;
    } else { // Assume plain text
        textContent = fileBuffer.toString('utf-8');
    }

    if (!textContent) {
        throw new Error("Could not extract text content from the file.");
    }

    const {output} = await prompt({ textContent });

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

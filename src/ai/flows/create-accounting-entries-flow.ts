
'use server';
/**
 * @fileOverview Flow to process fiscal launches and create accounting journal entries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as admin from 'firebase-admin';
import { CreateAccountingEntriesInput, CreateAccountingEntriesInputSchema, CreateAccountingEntriesOutput, CreateAccountingEntriesOutputSchema } from '@/ai/schemas/accounting-entries-schemas';

const AccountingEntrySchema = z.object({
    date: z.string().describe("The date of the entry in ISO 8601 format (YYYY-MM-DD)."),
    description: z.string().describe("A description of the transaction."),
    debit: z.object({
        account: z.string().describe("The debit account name or code (e.g., 'Caixa', 'Despesas com Juros')."),
        amount: z.number().describe("The amount to be debited."),
    }),
    credit: z.object({
        account: z.string().describe("The credit account name or code (e.g., 'Receita de Vendas', 'Fornecedores')."),
        amount: z.number().describe("The amount to be credited."),
    }),
    fiscalLaunchId: z.string().describe("The ID of the original fiscal launch document."),
});

const aiprompt = ai.definePrompt({
    name: 'createAccountingEntriesPrompt',
    input: { schema: z.object({ launches: z.string() }) },
    output: { schema: z.array(AccountingEntrySchema) },
    prompt: `
        You are an expert accountant for a small Brazilian business.
        Based on the following list of fiscal launches (in JSON format), generate the corresponding double-entry accounting journal entries (partidas dobradas).

        For each fiscal launch, create one accounting entry with a debit and a credit account.
        
        General Rules:
        - Use standard Brazilian accounting account names.
        - 'Saida' (sales/service provided) typically increases cash/receivables (debit) and revenue (credit).
        - 'Entrada' (purchases) typically increases inventory/expenses (debit) and cash/payables (credit).
        - 'Servico' (service provided by the company) is a type of 'Saida' and should generate revenue.
        - The description should be concise and informative.
        - The amount for debit and credit must be identical and positive.
        - **Crucially, you must include the 'fiscalLaunchId' field in your output, matching the 'id' of the original fiscal launch document.**

        Example for a Sale ('saida'):
        Launch: { "id": "xyz123", "type": "saida", "valorTotalNota": 500, "destinatario": { "nome": "Cliente A" } ... }
        Entry: 
        { 
          "date": "2024-01-15",
          "description": "Venda de mercadoria para Cliente A",
          "debit": { "account": "Caixa/Clientes", "amount": 500 },
          "credit": { "account": "Receita de Vendas", "amount": 500 },
          "fiscalLaunchId": "xyz123"
        }

        Example for a Purchase ('entrada'):
        Launch: { "id": "abc789", "type": "entrada", "valorTotalNota": 1000, "emitente": { "nome": "Fornecedor B" } ... }
        Entry: 
        { 
          "date": "2024-01-16",
          "description": "Compra de mercadoria de Fornecedor B",
          "debit": { "account": "Estoque/Despesas", "amount": 1000 },
          "credit": { "account": "Caixa/Fornecedores", "amount": 1000 },
          "fiscalLaunchId": "abc789"
        }

        Now, process these launches:
        {{{launches}}}
    `,
});

export async function createAccountingEntries(input: CreateAccountingEntriesInput): Promise<CreateAccountingEntriesOutput> {
    return createAccountingEntriesFlow(input);
}


const createAccountingEntriesFlow = ai.defineFlow(
  {
    name: 'createAccountingEntriesFlow',
    inputSchema: CreateAccountingEntriesInputSchema,
    outputSchema: CreateAccountingEntriesOutputSchema,
  },
  async (input) => {
    try {
        if (admin.apps.length === 0) {
            admin.initializeApp();
        }
        const db = admin.firestore();

        const { userId, companyId, year, month } = input;
        
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const launchesRef = db.collection(`users/${userId}/companies/${companyId}/launches`);
        const snapshot = await launchesRef
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .get();

        if (snapshot.empty) {
            return { success: true, message: 'Nenhum lançamento fiscal encontrado para o período.', entriesCreated: 0 };
        }

        const launches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const { output } = await aiprompt({ launches: JSON.stringify(launches) });
        
        if (!output || output.length === 0) {
            return { success: false, message: 'A IA não conseguiu gerar os lançamentos contábeis.', entriesCreated: 0 };
        }

        const batch = db.batch();
        const entriesRef = db.collection(`users/${userId}/companies/${companyId}/accountingEntries`);

        output.forEach(entry => {
            const docRef = entriesRef.doc();
            const entryWithTimestamp = {
                ...entry,
                date: admin.firestore.Timestamp.fromDate(new Date(entry.date)),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }
            batch.set(docRef, entryWithTimestamp);
        });

        await batch.commit();

        return {
            success: true,
            message: `Importação concluída com sucesso! ${output.length} lançamentos contábeis foram criados.`,
            entriesCreated: output.length,
        };

    } catch (error) {
        console.error("Error in createAccountingEntriesFlow:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return {
            success: false,
            message: `Erro interno do servidor: ${errorMessage}`,
            entriesCreated: 0,
        };
    }
  }
);

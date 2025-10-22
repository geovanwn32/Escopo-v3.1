'use server';
/**
 * @fileOverview An AI flow to analyze financial data and provide insights.
 * This more advanced version provides a structured analysis with positive and improvement points.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const FinancialDataSchema = z.object({
  month: z.string().describe("The month of the data (e.g., 'Jul')."),
  entradas: z.number().describe('Total revenue for the month.'),
  saidas: z.number().describe('Total expenses for the month.'),
});

const FinancialAnalystInputSchema = z.object({
  companyName: z.string().describe("The name of the user's company."),
  data: z.array(FinancialDataSchema).describe('An array of financial data for the past few months.'),
});
export type FinancialAnalystInput = z.infer<typeof FinancialAnalystInputSchema>;

const FinancialAnalystOutputSchema = z.object({
  title: z.string().describe('A short, engaging title for the financial analysis (e.g., "Crescimento Acelerado em Julho!").'),
  summary: z.string().describe('A concise, 1-2 sentence summary of the overall financial situation.'),
  positivePoints: z.array(z.string()).describe('A list of 1 to 2 key positive highlights or trends.'),
  improvementPoints: z.array(z.string()).describe('A list of 1 to 2 key areas for improvement or attention.'),
});
export type FinancialAnalystOutput = z.infer<typeof FinancialAnalystOutputSchema>;


const prompt = ai.definePrompt({
    name: 'financialAnalystPrompt',
    input: {schema: FinancialAnalystInputSchema },
    output: {schema: FinancialAnalystOutputSchema},
    prompt: `Você é um analista financeiro e conselheiro de negócios para pequenas e médias empresas. Seu tom é encorajador, profissional e direto ao ponto.

    Analise os dados financeiros dos últimos meses para a empresa "{{companyName}}" fornecidos abaixo.
    
    Dados Financeiros:
    {{#each data}}
    - Mês: {{this.month}}, Receitas: R$ {{this.entradas}}, Despesas: R$ {{this.saidas}}, Lucro/Prejuízo: R$ {{math this.entradas '-' this.saidas}}
    {{/each}}

    Com base na análise comparativa mês a mês, gere uma análise estruturada contendo:
    1.  **title**: Um título curto e impactante que resuma a principal conclusão.
    2.  **summary**: Uma análise geral de 1 a 2 frases sobre a situação.
    3.  **positivePoints**: Uma lista de 1 ou 2 pontos positivos chave (ex: crescimento de receita, redução de despesas, lucro recorde).
    4.  **improvementPoints**: Uma lista de 1 ou 2 pontos de atenção ou melhoria (ex: aumento de custos, queda no lucro, despesas superando receitas).

    Seja específico e use os dados para embasar suas observações. Evite jargões complexos. O objetivo é fornecer um diagnóstico rápido e valioso para o dono do negócio.
    `,
});

const financialAnalystFlow = ai.defineFlow(
  {
    name: 'financialAnalystFlow',
    inputSchema: FinancialAnalystInputSchema,
    outputSchema: FinancialAnalystOutputSchema,
  },
  async (input) => {
    
    if (!input.data || input.data.length === 0) {
        throw new Error("Dados financeiros não foram fornecidos.");
    }

    const {output} = await prompt(input);

    if (!output) {
      throw new Error("O modelo de IA não conseguiu retornar uma análise.");
    }
    return output;
  }
);

// Export a wrapper function to be called from the server-side component.
export async function analyzeFinancials(input: FinancialAnalystInput): Promise<FinancialAnalystOutput> {
    return financialAnalystFlow(input);
}

'use server';
/**
 * @fileOverview An AI flow to analyze financial data and provide insights.
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
  analysis: z
    .string()
    .describe('A concise, insightful, and encouraging analysis of the financial data provided. Should be 2-3 sentences long.'),
});
export type FinancialAnalystOutput = z.infer<typeof FinancialAnalystOutputSchema>;


const prompt = ai.definePrompt({
    name: 'financialAnalystPrompt',
    input: {schema: FinancialAnalystInputSchema },
    output: {schema: FinancialAnalystOutputSchema},
    prompt: `Você é um analista financeiro especialista e conselheiro de negócios para pequenas e médias empresas.
    Seu tom é encorajador, profissional e direto ao ponto.

    Analise os dados financeiros dos últimos meses para a empresa "{{companyName}}" fornecidos abaixo.
    
    Dados Financeiros:
    {{#each data}}
    - Mês: {{this.month}}, Receitas: R$ {{this.entradas}}, Despesas: R$ {{this.saidas}}
    {{/each}}

    Com base nesses dados, gere uma análise concisa (2 a 3 frases) que destaque uma tendência chave, um ponto positivo, ou uma área de atenção.
    Seja específico, mas evite jargões complexos. O objetivo é fornecer um insight rápido e valioso para o dono do negócio.
    
    Exemplos de boas análises:
    - "Ótimo trabalho em Julho! Suas receitas cresceram 15% em relação a Junho, mostrando um excelente momento de vendas. Mantenha o foco em otimizar as despesas para maximizar os lucros."
    - "Atenção em Julho: suas despesas aumentaram significativamente, superando as receitas. Recomendamos uma revisão dos custos operacionais para garantir a saúde financeira do seu negócio."
    - "Seu fluxo de caixa se manteve estável nos últimos meses, demonstrando consistência. Um bom próximo passo seria explorar novas oportunidades para aumentar a receita."
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


'use server';
/**
 * @fileOverview An AI flow that acts as a support assistant for the application.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { readFileSync } from 'fs';
import path from 'path';

// Read the README.md file to use as a knowledge base.
// Note: In a production app, you might use a more advanced RAG (Retrieval-Augmented Generation) system.
const readmePath = path.join(process.cwd(), 'README.md');
const knowledgeBase = readFileSync(readmePath, 'utf-8');

const SupportAssistantInputSchema = z.object({
  question: z.string().describe("The user's question about the system."),
});
export type SupportAssistantInput = z.infer<typeof SupportAssistantInputSchema>;

const SupportAssistantOutputSchema = z.object({
  answer: z
    .string()
    .describe('A helpful and concise answer to the user\'s question, in Markdown format.'),
});
export type SupportAssistantOutput = z.infer<typeof SupportAssistantOutputSchema>;


const prompt = ai.definePrompt({
    name: 'supportAssistantPrompt',
    input: {schema: SupportAssistantInputSchema },
    output: {schema: SupportAssistantOutputSchema},
    prompt: `Você é um assistente de suporte especialista para um sistema contábil chamado "EscopoV3". Sua função é responder às perguntas dos usuários sobre como utilizar o sistema.

    Seu tom deve ser prestativo, claro e conciso. Use a documentação do sistema fornecida abaixo como sua principal fonte de conhecimento. Baseie suas respostas estritamente nas informações contidas nesta documentação. Não invente funcionalidades que não estão descritas.

    Se a pergunta for muito vaga, curta ou não fizer sentido (ex: "gffgfggf"), peça educadamente por mais detalhes ou um exemplo do que o usuário está tentando fazer.

    Se a pergunta for sobre um tópico que não está na documentação, informe educadamente que você não possui informações sobre esse assunto específico, mas que pode ajudar com outras funcionalidades do sistema.

    Formate suas respostas usando Markdown para melhor legibilidade (use títulos, listas e negrito quando apropriado).

    **Documentação do Sistema EscopoV3:**
    ---
    {{{knowledgeBase}}}
    ---

    **Pergunta do Usuário:**
    "{{{question}}}"
    `,
});

const supportAssistantFlow = ai.defineFlow(
  {
    name: 'supportAssistantFlow',
    inputSchema: SupportAssistantInputSchema,
    outputSchema: SupportAssistantOutputSchema,
  },
  async (input) => {
    
    if (!input.question) {
        throw new Error("A pergunta não pode estar vazia.");
    }

    const {output} = await prompt({
        question: input.question,
        // @ts-ignore - Handlebars context is not strongly typed here
        knowledgeBase,
    }, {model: 'gemini-pro'});

    if (!output) {
      throw new Error("O modelo de IA não conseguiu retornar uma resposta.");
    }
    return output;
  }
);

// Export a wrapper function to be called from the server-side component.
export async function askSupportAssistant(input: SupportAssistantInput): Promise<SupportAssistantOutput> {
    return supportAssistantFlow(input);
}

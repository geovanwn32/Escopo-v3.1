
import type { UseFormReturn } from 'react-hook-form';

interface CnpjData {
    razao_social: string;
    nome_fantasia: string;
    cnae_fiscal: string;
    cnae_fiscal_descricao: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
    ddd_telefone_1: string;
    email: string;
    inscricao_estadual: string; // Added field from BrasilAPI
}

const formatCep = (cep: string = '') => cep?.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, "$1-$2");

/**
 * Creates a function to look up CNPJ data and populate a form.
 * This function calls an internal API proxy that intelligently queries multiple external APIs.
 * @param form - The react-hook-form instance to populate.
 * @param toast - The toast function for user feedback.
 * @returns A function that, when called, executes the lookup.
 */
export const createCnpjLookup = (
    form: UseFormReturn<any>, 
    toast: (options: { variant?: 'destructive' | 'default', title: string, description?: string }) => void
) => {
    return async () => {
        const inscricaoField = form.getValues("cpfCnpj") !== undefined ? "cpfCnpj" : "inscricao";
        const cnpjValue = form.getValues(inscricaoField);
        
        if (!cnpjValue) {
            toast({ variant: "destructive", title: "CNPJ não informado" });
            return { loading: false, success: false };
        }

        const cleanedCnpj = cnpjValue.replace(/\D/g, '');

        if (cleanedCnpj.length !== 14) {
            toast({
                variant: "destructive",
                title: "CNPJ Inválido",
                description: "A busca automática funciona apenas com CNPJs de 14 dígitos.",
            });
            return { loading: false, success: false };
        }

        try {
            const response = await fetch(`/api/cnpj/${cleanedCnpj}`);
            const data: CnpjData & { message?: string } = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'CNPJ não encontrado ou API indisponível.');
            }

            form.setValue("razaoSocial", data.razao_social || "", { shouldValidate: true });
            form.setValue("nomeFantasia", data.nome_fantasia || data.razao_social || "", { shouldValidate: true });
            form.setValue("cnaePrincipalCodigo", String(data.cnae_fiscal || ""), { shouldValidate: true });
            form.setValue("cnaePrincipalDescricao", data.cnae_fiscal_descricao || "", { shouldValidate: true });
            form.setValue("cep", formatCep(data.cep || ""), { shouldValidate: true });
            form.setValue("logradouro", data.logradouro || "", { shouldValidate: true });
            form.setValue("numero", data.numero || "", { shouldValidate: true });
            form.setValue("complemento", data.complemento || "", { shouldValidate: true });
            form.setValue("bairro", data.bairro || "", { shouldValidate: true });
            form.setValue("cidade", data.municipio || "", { shouldValidate: true });
            form.setValue("uf", data.uf || "", { shouldValidate: true });
            form.setValue("telefone", data.ddd_telefone_1 || "", { shouldValidate: true });
            form.setValue("email", data.email || "", { shouldValidate: true });
            // Specifically set inscricaoEstadual if the form has it
            if(form.getValues("inscricaoEstadual") !== undefined) {
               form.setValue("inscricaoEstadual", data.inscricao_estadual || "", { shouldValidate: true });
            }

            toast({
                title: "Dados da Empresa Carregados!",
                description: "Os campos foram preenchidos com as informações encontradas.",
            });
            
            return { success: true };

        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erro ao buscar CNPJ",
                description: (error as Error).message,
            });
            return { success: false };
        }
    };
};

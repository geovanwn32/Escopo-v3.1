import type { UseFormReturn } from 'react-hook-form';

// Interface para a resposta da BrasilAPI
interface BrasilAPIData {
    razao_social: string;
    nome_fantasia: string;
    cnae_fiscal: number;
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
    inscricoes_estaduais: {
        inscricao_estadual: string;
        uf: string;
    }[];
}

// Interface para a resposta da ReceitaWS
interface ReceitaWSData {
  nome: string;
  fantasia: string;
  atividade_principal: { code: string; text: string }[];
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  telefone: string;
  email: string;
  status: string;
  message?: string;
}

const formatCep = (cep: string = '') => cep?.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, "$1-$2");

// Mapeia a resposta de qualquer uma das APIs para o formato unificado que o frontend espera
function mapToFrontendFormat(data: Partial<BrasilAPIData & ReceitaWSData>) {
    // A Inscrição Estadual da BrasilAPI é um array, pegamos a primeira ativa se houver
    const activeIE = data.inscricoes_estaduais?.find(ie => ie.uf === data.uf);

    return {
        razaoSocial: data.razao_social || data.nome || "",
        nomeFantasia: data.nome_fantasia || data.fantasia || data.razao_social || data.nome || "",
        cnaePrincipalCodigo: String(data.cnae_fiscal || (data.atividade_principal && data.atividade_principal[0]?.code?.replace(/\D/g, '')) || ""),
        cnaePrincipalDescricao: data.cnae_fiscal_descricao || (data.atividade_principal && data.atividade_principal[0]?.text) || "",
        cep: formatCep(data.cep || ""),
        logradouro: data.logradouro || "",
        numero: data.numero || "",
        complemento: data.complemento || "",
        bairro: data.bairro || "",
        cidade: data.municipio || "",
        uf: data.uf || "",
        telefone: data.ddd_telefone_1 || data.telefone || "",
        email: data.email || "",
        inscricaoEstadual: activeIE?.inscricao_estadual || '',
    };
}


/**
 * Creates a function to look up CNPJ data and populate a form.
 * This function now calls external APIs directly from the client with a fallback mechanism.
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
            return;
        }

        const cleanedCnpj = cnpjValue.replace(/\D/g, '');

        if (cleanedCnpj.length !== 14) {
            toast({
                variant: "destructive",
                title: "CNPJ Inválido",
                description: "A busca automática funciona apenas com CNPJs de 14 dígitos.",
            });
            return;
        }

        let finalData: Partial<BrasilAPIData & ReceitaWSData> = {};
        let lastError: Error | null = null;
        let success = false;

        // --- Tentativa 1: ReceitaWS ---
        try {
            // NOTE: The 'jsonp' approach circumvents CORS issues by using a script tag.
            const data = await new Promise<ReceitaWSData>((resolve, reject) => {
                const script = document.createElement('script');
                const callbackName = `receitaws_callback_${Date.now()}`;
                window[callbackName] = (data: ReceitaWSData) => {
                    delete window[callbackName];
                    document.body.removeChild(script);
                    resolve(data);
                };
                script.src = `https://www.receitaws.com.br/v1/cnpj/${cleanedCnpj}?callback=${callbackName}`;
                script.onerror = () => {
                    delete window[callbackName];
                    document.body.removeChild(script);
                    reject(new Error('ReceitaWS falhou. Verifique o CNPJ ou a conexão.'));
                };
                document.body.appendChild(script);
            });

            if (data.status === "ERROR") {
                throw new Error(data.message || 'ReceitaWS retornou um erro.');
            }
            
            finalData = { ...finalData, ...data };
            success = true;

        } catch (error) {
            console.warn(`[CNPJ_LOOKUP] ReceitaWS falhou: ${(error as Error).message}. Tentando fallback.`);
            lastError = error as Error;
        }
        
        // --- Tentativa 2: BrasilAPI (Fallback e dados complementares) ---
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanedCnpj}`);
            if (response.ok) {
                const data = await response.json();
                finalData = { ...finalData, ...data };
                success = true; // Mark as success even if only this one worked
            } else if (!success) { // Only throw if the first API also failed
                 const errorData = await response.json();
                 throw new Error(errorData.message || `BrasilAPI falhou com status ${response.status}`);
            }
        } catch (error) {
             console.error(`[CNPJ_LOOKUP] BrasilAPI também falhou:`, (error as Error).message);
             lastError = error as Error;
        }

        // --- Processar e preencher o formulário ---
        if (success) {
            const mappedData = mapToFrontendFormat(finalData);

            Object.keys(mappedData).forEach(key => {
                const formKey = key as keyof typeof mappedData;
                if (form.getValues(formKey) !== undefined) {
                    form.setValue(formKey, mappedData[formKey], { shouldValidate: true });
                }
            });

            toast({
                title: "Dados da Empresa Carregados!",
                description: "Os campos foram preenchidos com as informações encontradas.",
            });
        } else {
             toast({
                variant: "destructive",
                title: "Erro ao buscar CNPJ",
                description: lastError?.message || "Ambas as APIs de consulta falharam.",
            });
        }
    };
};

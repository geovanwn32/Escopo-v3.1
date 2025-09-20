// Inspired by: https://github.com/the-via/receitaws-react/blob/master/src/useReceitaWS.js

function fetchJsonp(url: string, options?: any) {
    const callbackName = `jsonp_${Math.round(100000 * Math.random())}`;
    const script = document.createElement('script');

    return new Promise((resolve, reject) => {
        script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${callbackName}`;
        script.onerror = reject;

        (window as any)[callbackName] = (data: any) => {
            delete (window as any)[callbackName];
            document.body.removeChild(script);
            resolve(data);
        };

        document.body.appendChild(script);
    });
}

interface CnpjData {
    razaoSocial: string;
    nomeFantasia: string;
    cnaePrincipal: string;
    inscricaoEstadual: string;
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    email: string;
    telefone: string;
}

export async function lookupCnpj(cnpj: string): Promise<CnpjData> {
    const cleanedCnpj = cnpj.replace(/\D/g, '');
    if (cleanedCnpj.length !== 14) {
        throw new Error("O CNPJ deve conter 14 dígitos.");
    }

    let lastError: Error | null = null;
    let combinedData: Partial<CnpjData> = {};

    // --- 1. Attempt with ReceitaWS via JSONP proxy ---
    try {
        const url = `https://www.receitaws.com.br/v1/cnpj/${cleanedCnpj}`;
        const data: any = await fetchJsonp(url);
        
        if (data.status === 'ERROR') {
            throw new Error(data.message || 'CNPJ não encontrado na ReceitaWS.');
        }
        
        combinedData = {
            razaoSocial: data.nome,
            nomeFantasia: data.fantasia || data.nome,
            cep: data.cep?.replace('.', ''),
            logradouro: data.logradouro,
            numero: data.numero,
            bairro: data.bairro,
            cidade: data.municipio,
            uf: data.uf,
            email: data.email,
            telefone: data.telefone,
            cnaePrincipal: data.atividade_principal?.[0]?.code || '',
        };
    } catch (error) {
        console.error("[CNPJ_LOOKUP] ReceitaWS falhou:", (error as Error).message);
        lastError = error as Error;
    }

    // --- 2. Attempt with BrasilAPI (especially for Inscricao Estadual) ---
    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanedCnpj}`);
        if (response.ok) {
            const data = await response.json();
            
            // Merge BrasilAPI data, giving preference to already filled data from ReceitaWS
            combinedData.razaoSocial = combinedData.razaoSocial || data.razao_social;
            combinedData.nomeFantasia = combinedData.nomeFantasia || data.nome_fantasia;
            combinedData.cnaePrincipal = combinedData.cnaePrincipal || (data.cnae_fiscal || '').toString();
            combinedData.cep = combinedData.cep || data.cep;
            combinedData.logradouro = combinedData.logradouro || data.logradouro;
            combinedData.numero = combinedData.numero || data.numero;
            combinedData.bairro = combinedData.bairro || data.bairro;
            combinedData.cidade = combinedData.cidade || data.municipio;
            combinedData.uf = combinedData.uf || data.uf;
            combinedData.email = combinedData.email || data.email;
            combinedData.telefone = combinedData.telefone || data.ddd_telefone_1;
            
            // BrasilAPI is the primary source for this
            if (data.estabelecimentos && data.estabelecimentos.length > 0) {
                 combinedData.inscricaoEstadual = data.estabelecimentos[0].inscricao_estadual || '';
            }
        }
    } catch (error) {
        console.error("[CNPJ_LOOKUP] BrasilAPI falhou:", (error as Error).message);
        lastError = error as Error;
    }
    
    // If after all attempts, we still don't have a company name, throw an error.
    if (!combinedData.razaoSocial) {
        throw lastError || new Error("Não foi possível buscar os dados do CNPJ em nenhuma das fontes. Verifique o número e sua conexão.");
    }

    return combinedData as CnpjData;
}

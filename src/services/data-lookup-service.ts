
// Inspired by: https://github.com/the-via/receitaws-react/blob/master/src/useReceitaWS.js

function fetchJsonp(url: string, options?: any) {
    const callbackName = `jsonp_${Math.round(100000 * Math.random())}`;
    const script = document.createElement('script');

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('JSONP request timed out.'));
        }, 5000); // 5 second timeout

        script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${callbackName}`;
        script.onerror = reject;

        (window as any)[callbackName] = (data: any) => {
            clearTimeout(timeoutId);
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
    cnaePrincipalDescricao: string;
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

    // --- 1. Attempt with BrasilAPI (more reliable for client-side) ---
    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanedCnpj}`);
        if (!response.ok) {
            if (response.status === 404) throw new Error("CNPJ não encontrado na BrasilAPI.");
            throw new Error(`BrasilAPI falhou: ${response.statusText}`);
        }
        const data = await response.json();
        
        combinedData = {
            razaoSocial: data.razao_social,
            nomeFantasia: data.nome_fantasia || data.razao_social,
            cnaePrincipal: (data.cnae_fiscal || '').toString(),
            cnaePrincipalDescricao: data.cnae_fiscal_descricao,
            cep: (data.cep || '').replace(/\D/g, ''),
            logradouro: data.logradouro,
            numero: data.numero,
            bairro: data.bairro,
            cidade: data.municipio,
            uf: data.uf,
            email: data.email,
            telefone: data.ddd_telefone_1 || data.ddd_telefone_2,
            inscricaoEstadual: data.estabelecimentos?.[0]?.inscricao_estadual || '',
        };
        // If we get a good result here, we can consider it done.
        return combinedData as CnpjData;

    } catch (error) {
        console.error(`[CNPJ_LOOKUP] BrasilAPI falhou:`, (error as Error).message);
        lastError = error as Error;
    }


    // --- 2. Fallback to ReceitaWS via JSONP if BrasilAPI fails ---
    // Only try this if BrasilAPI failed, as it has stricter rate limits.
    if (!combinedData.razaoSocial) {
        try {
            console.log("[CNPJ_LOOKUP] Tentando fallback com ReceitaWS...");
            const url = `https://www.receitaws.com.br/v1/cnpj/${cleanedCnpj}`;
            const data: any = await fetchJsonp(url);
            
            if (data.status === 'ERROR') {
                throw new Error(data.message || 'CNPJ não encontrado na ReceitaWS.');
            }
            
            combinedData = {
                razaoSocial: data.nome,
                nomeFantasia: data.fantasia || data.nome,
                cnaePrincipal: data.atividade_principal?.[0]?.code,
                cnaePrincipalDescricao: data.atividade_principal?.[0]?.text,
                cep: (data.cep || '').replace(/\D/g, ''),
                logradouro: data.logradouro,
                numero: data.numero,
                bairro: data.bairro,
                cidade: data.municipio,
                uf: data.uf,
                email: data.email,
                telefone: data.telefone,
                inscricaoEstadual: combinedData.inscricaoEstadual, // Keep IE from BrasilAPI if it was found
            };
        } catch (error) {
            console.error(`[CNPJ_LOOKUP] ReceitaWS também falhou:`, (error as Error).message);
            lastError = error as Error;
        }
    }
    
    // If after all attempts, we still don't have a company name, throw an error.
    if (!combinedData.razaoSocial) {
        throw lastError || new Error("Não foi possível buscar os dados do CNPJ. Verifique o número e a conexão.");
    }

    return combinedData as CnpjData;
}


/**
 * @fileoverview Firebase Cloud Function for CNPJ lookup.
 * This function acts as a reliable proxy, querying multiple external APIs
 * to fetch company data and returning it in a unified format.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import fetch from "node-fetch";

// Interfaces for external API responses
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
    inscricoes_estaduais?: {
        inscricao_estadual: string;
        uf: string;
    }[];
}

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

/**
 * Maps data from either BrasilAPI or ReceitaWS to a unified frontend format.
 */
function mapToFrontendFormat(data: Partial<BrasilAPIData & ReceitaWSData>) {
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


export const cnpjLookup = onCall(async (request) => {
    const cnpj = request.data.cnpj?.replace(/\D/g, '');
    if (!cnpj || typeof cnpj !== 'string' ) {
        throw new HttpsError('invalid-argument', 'O CNPJ/CPF é obrigatório.');
    }
    
    if (cnpj.length === 11) {
        throw new HttpsError('invalid-argument', 'A busca automática não funciona para CPF.');
    }

    if (cnpj.length !== 14) {
        throw new HttpsError('invalid-argument', 'O CNPJ deve conter 14 dígitos.');
    }

    logger.info(`Buscando CNPJ: ${cnpj}`);
    let finalData: Partial<BrasilAPIData & ReceitaWSData> = {};
    let lastError: string | null = null;

    // --- Tentativa 1: ReceitaWS ---
    try {
        const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`);
        if (response.ok) {
            const data = await response.json() as ReceitaWSData;
            if (data.status === "ERROR") {
                throw new Error(data.message || 'ReceitaWS retornou um erro.');
            }
            finalData = { ...finalData, ...data };
            logger.info("Dados obtidos da ReceitaWS.");
        } else {
            throw new Error(`ReceitaWS falhou com status ${response.status}`);
        }
    } catch (error) {
        logger.warn(`Falha na ReceitaWS: ${(error as Error).message}`);
        lastError = (error as Error).message;
    }
    
    // --- Tentativa 2: BrasilAPI (Fallback e para dados complementares) ---
    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
        if (response.ok) {
            const data = await response.json() as BrasilAPIData;
            finalData = { ...data, ...finalData }; // Prioriza ReceitaWS, mas complementa com BrasilAPI
            logger.info("Dados complementados/obtidos da BrasilAPI.");
             if(lastError) lastError = null; // Clear error if this one succeeded
        } else {
             if (!Object.keys(finalData).length) { // Only throw if we have no data at all
                 const errorData = await response.json();
                 throw new Error((errorData as any).message || `BrasilAPI falhou com status ${response.status}`);
             }
        }
    } catch (error) {
        logger.warn(`Falha na BrasilAPI: ${(error as Error).message}`);
        if (!Object.keys(finalData).length) { // Keep error only if we have no data
            lastError = (error as Error).message;
        }
    }

    if (!Object.keys(finalData).length) {
        throw new HttpsError('not-found', lastError || 'Não foi possível encontrar dados para o CNPJ informado em nenhuma das fontes.');
    }

    return mapToFrontendFormat(finalData);
});

/**
 * @fileoverview Firebase Cloud Function to look up CNPJ data from Minha Receita API.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

interface CnpjData {
  razao_social: string;
  nome_fantasia: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  email: string;
  ddd_telefone_1: string;
  descricao_situacao_cadastral: string;
}

/**
 * A callable Cloud Function that fetches CNPJ data from the Minha Receita API.
 */
export const cnpjLookup = onCall(async (request) => {
  const cnpj = request.data.cnpj;
  if (!cnpj || typeof cnpj !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "O CNPJ é obrigatório e deve ser uma string."
    );
  }

  const cleanedCnpj = cnpj.replace(/\D/g, "");

  if (cleanedCnpj.length !== 14) {
    if (cleanedCnpj.length === 11) {
       return { success: false, message: "A busca é válida apenas para CNPJ. Por favor, insira um CNPJ." };
    }
    throw new HttpsError("invalid-argument", "O CNPJ deve ter 14 dígitos.");
  }

  logger.info(`Buscando CNPJ: ${cleanedCnpj}`);

  try {
    const response = await fetch(
      `https://minhareceita.org/${cleanedCnpj}`
    );

    if (!response.ok) {
        if (response.status === 404) {
             throw new HttpsError("not-found", "CNPJ não encontrado na base de dados.");
        }
      throw new HttpsError("unavailable", `A API Minha Receita retornou um erro: ${response.statusText}`);
    }

    const data: CnpjData = await response.json();
    
    if (data.descricao_situacao_cadastral !== 'ATIVA') {
        logger.warn(`CNPJ ${cleanedCnpj} não está ativo. Situação: ${data.descricao_situacao_cadastral}`);
    }

    // Mapeando para o formato esperado pelo frontend
    const mappedData = {
      razaoSocial: data.razao_social,
      nomeFantasia: data.nome_fantasia || data.razao_social,
      cnaePrincipal: data.cnae_fiscal.toString(),
      cnaePrincipalDescricao: data.cnae_fiscal_descricao,
      cep: data.cep,
      logradouro: data.logradouro,
      numero: data.numero,
      bairro: data.bairro,
      cidade: data.municipio,
      uf: data.uf,
      email: data.email,
      telefone: data.ddd_telefone_1,
    };
    
    return { success: true, data: mappedData };
  } catch (error) {
    logger.error("Erro ao buscar CNPJ na Minha Receita API:", error);
    if (error instanceof HttpsError) {
        throw error;
    }
    throw new HttpsError("internal", "Erro interno ao processar a busca de CNPJ.");
  }
});

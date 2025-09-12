
import { NextResponse } from 'next/server';

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
    inscricao_estadual_ativa: boolean;
    inscricao_estadual_situacao_cadastral: string;
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

// Mapeia a resposta de qualquer uma das APIs para o formato unificado que o frontend espera
function mapToFrontendFormat(data: Partial<BrasilAPIData & ReceitaWSData>) {
    // A Inscrição Estadual da BrasilAPI é um array, pegamos a primeira ativa se houver
    const activeIE = data.inscricoes_estaduais?.find(ie => ie.uf === data.uf);

    return {
        razao_social: data.razao_social || data.nome,
        nome_fantasia: data.nome_fantasia || data.fantasia || data.razao_social || data.nome,
        cnae_fiscal: data.cnae_fiscal || (data.atividade_principal && data.atividade_principal[0]?.code?.replace(/\D/g, '')),
        cnae_fiscal_descricao: data.cnae_fiscal_descricao || (data.atividade_principal && data.atividade_principal[0]?.text),
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        municipio: data.municipio,
        uf: data.uf,
        ddd_telefone_1: data.ddd_telefone_1 || data.telefone,
        email: data.email,
        inscricao_estadual: activeIE?.inscricao_estadual || '',
    };
}

export async function GET(
  request: Request,
  { params }: { params: { cnpj: string } }
) {
  const cnpj = params.cnpj;

  if (!cnpj || cnpj.length !== 14) {
    return NextResponse.json({ message: 'CNPJ inválido.' }, { status: 400 });
  }
  
  let finalData: Partial<BrasilAPIData & ReceitaWSData> = {};
  let lastError: Error | null = null;


  // --- Tentativa 1: ReceitaWS (mais detalhes, mas com limite de taxa) ---
  try {
    const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, {
      next: { revalidate: 86400 } // Cache por 24 horas
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `ReceitaWS falhou com status ${response.status}`);
    }

    const data: ReceitaWSData = await response.json();
    if (data.status === "ERROR") {
        throw new Error(data.message || 'ReceitaWS retornou um erro.');
    }
    
    finalData = { ...finalData, ...data };

  } catch (receitaWsError) {
    console.warn(`[CNPJ_PROXY] ReceitaWS falhou para ${cnpj}. Tentando BrasilAPI. Erro:`, (receitaWsError as Error).message);
    lastError = receitaWsError as Error;
  }

  // --- Tentativa 2: BrasilAPI (obter dados complementares como IE) ---
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
       next: { revalidate: 86400 } // Cache por 24 horas
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        // Não lançar erro aqui se a primeira API já funcionou, apenas registrar
        console.warn(`[CNPJ_PROXY] BrasilAPI falhou para ${cnpj}: ${errorData.message}`);
    } else {
       const data: BrasilAPIData = await response.json();
       finalData = { ...finalData, ...data };
    }
    
  } catch (brasilApiError) {
     console.error(`[CNPJ_PROXY] BrasilAPI falhou criticamente para ${cnpj}:`, (brasilApiError as Error).message);
     lastError = brasilApiError as Error;
  }
  
  // Se após todas as tentativas, não tivermos dados essenciais, retorne erro.
  if (!finalData.razao_social && !finalData.nome) {
      const errorMessage = lastError?.message || 'Não foi possível consultar o CNPJ. Ambas as APIs de consulta falharam.';
      return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
  
  const mappedData = mapToFrontendFormat(finalData);
  return NextResponse.json(mappedData, { status: 200 });
}

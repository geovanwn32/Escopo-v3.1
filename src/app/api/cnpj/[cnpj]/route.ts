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
    // Outros campos da BrasilAPI podem ser adicionados aqui se necessário
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

  // --- Tentativa 1: ReceitaWS (mais detalhes, mas com limite de taxa) ---
  try {
    const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, {
      next: { revalidate: 86400 } // Cache por 24 horas
    });
    
    const data: ReceitaWSData = await response.json();

    if (response.ok && data.status !== "ERROR") {
      const mappedData = mapToFrontendFormat(data);
      return NextResponse.json(mappedData, { status: 200 });
    }
    // Se a ReceitaWS retornar erro 429 (Too Many Requests) ou outro erro, o catch irá pegar e tentar a BrasilAPI.
    if (!response.ok) {
        throw new Error(data.message || `ReceitaWS falhou com status ${response.status}`);
    }

  } catch (receitaWsError) {
    console.warn(`[CNPJ_PROXY] ReceitaWS falhou para ${cnpj}. Tentando BrasilAPI. Erro:`, (receitaWsError as Error).message);
  }

  // --- Tentativa 2 (Fallback): BrasilAPI ---
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
       next: { revalidate: 86400 } // Cache por 24 horas
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `BrasilAPI falhou com status ${response.status}`);
    }
    
    const data: BrasilAPIData = await response.json();
    const mappedData = mapToFrontendFormat(data);
    return NextResponse.json(mappedData, { status: 200 });
    
  } catch (brasilApiError) {
    console.error(`[CNPJ_PROXY] Ambas as APIs falharam para ${cnpj}:`, (brasilApiError as Error).message);
    return NextResponse.json({ message: 'Não foi possível consultar o CNPJ. Ambas as APIs de consulta falharam.' }, { status: 500 });
  }
}

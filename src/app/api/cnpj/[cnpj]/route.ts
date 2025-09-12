
import { NextResponse } from 'next/server';

interface Atividade {
  code: string;
  text: string;
}

interface ReceitaWSData {
  nome: string;
  fantasia: string;
  atividade_principal: Atividade[];
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


// Mapeia a resposta da ReceitaWS para o formato esperado pelo frontend (que era baseado na BrasilAPI)
function mapReceitaWSToFrontend(data: ReceitaWSData) {
    return {
        razao_social: data.nome,
        nome_fantasia: data.fantasia || data.nome,
        cnae_fiscal: data.atividade_principal[0]?.code?.replace(/\D/g, ''),
        cnae_fiscal_descricao: data.atividade_principal[0]?.text,
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        municipio: data.municipio,
        uf: data.uf,
        ddd_telefone_1: data.telefone,
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

  try {
    // Usando a API ReceitaWS, que é mais estável
    const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, {
      next: { revalidate: 86400 } // Revalidate cache once a day
    });
    
    // A ReceitaWS retorna status 200 mesmo para erros, então precisamos checar o corpo da resposta
    const data: ReceitaWSData = await response.json();

    if (data.status === "ERROR") {
        const errorMessage = data.message || 'Erro ao consultar o CNPJ na API externa.';
        return NextResponse.json({ message: errorMessage }, { status: 404 });
    }

    if (!response.ok) {
        const errorMessage = data.message || 'Erro desconhecido na API de CNPJ.';
        return NextResponse.json({ message: errorMessage }, { status: response.status });
    }

    // Mapeia os dados para o formato que o frontend espera
    const mappedData = mapReceitaWSToFrontend(data);

    return NextResponse.json(mappedData, { status: 200 });

  } catch (error) {
    console.error(`[CNPJ_API_PROXY] Error fetching CNPJ ${cnpj}:`, error);
    return NextResponse.json({ message: 'Erro interno no servidor ao consultar o CNPJ.' }, { status: 500 });
  }
}

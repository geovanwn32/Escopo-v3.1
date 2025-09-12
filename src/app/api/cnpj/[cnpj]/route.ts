
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { cnpj: string } }
) {
  const cnpj = params.cnpj;

  if (!cnpj || cnpj.length !== 14) {
    return NextResponse.json({ message: 'CNPJ inválido.' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      next: { revalidate: 86400 } // Revalidate cache once a day
    });

    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || 'Erro ao consultar o CNPJ na API externa.';
        // Pass through the status code from BrasilAPI if available
        return NextResponse.json({ message: errorMessage }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error(`[CNPJ_API_PROXY] Error fetching CNPJ ${cnpj}:`, error);
    return NextResponse.json({ message: 'Erro interno no servidor ao consultar o CNPJ.' }, { status: 500 });
  }
}

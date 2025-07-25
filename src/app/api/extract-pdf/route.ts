
import { NextResponse } from 'next/server';
import pdf from 'pdf-parse/lib/pdf-parse.js';

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ message: 'Nenhum arquivo encontrado.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const pdfData = await pdf(buffer);

    return NextResponse.json({ text: pdfData.text }, { status: 200 });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ message: 'Erro ao processar o PDF.', error: e.message }, { status: 500 });
  }
}

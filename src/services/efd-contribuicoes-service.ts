

import type { Company } from '@/types/company';
import { format, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { collection, getDocs, query, where, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Launch, EfdFile } from '@/types';

const formatValue = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0,00';
  return value.toFixed(2).replace('.', ',');
};

const formatDate = (date: Date): string => {
  if (!date || !(date instanceof Date) || !isValid(date)) {
    return '';
  }
  return format(date, 'ddMMyyyy');
};

const sanitizeString = (str: string | undefined | null): string => {
    if (!str) return '';
    // Remove special pipe characters and trim, then convert to uppercase
    return str.replace(/[|]/g, '').trim().toUpperCase();
}

interface ServiceResult {
    success: boolean;
    message?: string;
}

/**
 * Generates the EFD Contribuições TXT file content based on a specific layout.
 * This version handles data fetching for a full file generation.
 */
export async function generateEfdContribuicoesTxt(
    userId: string,
    company: Company,
    period: string,
    semMovimento: boolean,
    tipoEscrituracao: '0' | '1' = '0'
): Promise<ServiceResult> {
    const [monthStr, yearStr] = period.split('/');
    if (!monthStr || !yearStr) {
        return { success: false, message: "Período inválido." };
    }
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    let launches: Launch[] = [];
    if (!semMovimento) {
        const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);
        const q = query(launchesRef, 
            where('date', '>=', Timestamp.fromDate(startDate)),
            where('date', '<=', Timestamp.fromDate(endDate))
        );
        const snapshot = await getDocs(q);
        launches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as Timestamp).toDate() } as Launch));
    }
    
    if (!semMovimento && launches.length === 0) {
        return { success: false, message: "Nenhum lançamento fiscal encontrado no período para gerar o arquivo com movimento." };
    }

    const allLines: string[] = [];

    // --- Bloco 0 ---
    const bloco0Lines = [];
    // Adicionado IND_NAT_PJ e campo vazio para SUFRAMA
    bloco0Lines.push(`|0000|008|${tipoEscrituracao}|0|${company.regimeTributario === 'mei' ? '99' : '00'}|${formatDate(startDate)}|${formatDate(endDate)}|${sanitizeString(company.razaoSocial)}|${company.cnpj?.replace(/\D/g, '')}|${company.uf}|${company.cidade ? '5201405' : ''}|${company.inscricaoMunicipal || ''}||0|`);
    bloco0Lines.push('|0001|' + (semMovimento ? '1' : '0') + '|'); 
    
    // -- Registro 0100 - Contabilista
    bloco0Lines.push(`|0100|CONTADOR EXEMPLO|00000000000|00000000|contador@example.com|62999999999|5201405|RUA TESTE|123|CENTRO|`);
    
    // --- Registro 0110 - Regimes
    bloco0Lines.push(`|0110|${company.metodoApropriacaoCredito || '1'}|${company.tipoContribuicao || '1'}|${company.incidenciaTributaria || '1'}|`);
    
    // --- Registro 0140 - Cadastro de Participantes ---
    const partners = new Map<string, { nome: string; uf: string; ie: string; codMun: string }>();
    launches.forEach(launch => {
        const partnerInfo = launch.type === 'entrada' ? launch.emitente : (launch.destinatario || launch.tomador);
        const cnpj = partnerInfo?.cnpj?.replace(/\D/g, '');
        if (cnpj && !partners.has(cnpj)) {
            partners.set(cnpj, {
                nome: sanitizeString(partnerInfo.nome),
                uf: '',
                ie: '',
                codMun: ''
            });
        }
    });
    
    if (partners.size > 0) {
        bloco0Lines.push(`|0140|${company.cnpj?.replace(/\D/g, '')}|${sanitizeString(company.razaoSocial)}|${company.cnpj?.replace(/\D/g, '')}|${company.inscricaoEstadual || ''}|5201405|${company.inscricaoMunicipal || ''}|`);
        partners.forEach((partner, cnpj) => {
             // Removido o campo IE duplicado e garantido o codMun
            bloco0Lines.push(`|0140|${cnpj}|${partner.nome}|${cnpj}|${partner.ie || ''}|${partner.codMun || ''}|${''}|`);
        });
    }

    // -- Registro 0500 - Plano de Contas
    // Placeholder - would need to fetch chart of accounts
    // bloco0Lines.push('|0500|...|');
    

    bloco0Lines.push('|0990|' + (bloco0Lines.length + 1) + '|');
    allLines.push(...bloco0Lines);

    // --- Bloco A (Serviços) ---
    const servicos = launches.filter(l => l.type === 'servico' && l.status !== 'Cancelado');
    const blocoALines = [];
    blocoALines.push('|A001|' + (servicos.length > 0 ? '0' : '1') + '|');
    if (servicos.length > 0) {
        blocoALines.push(`|A010|${company.cnpj?.replace(/\D/g, '')}|`); // Empresa é o prestador
        servicos.forEach(s => {
            const tomadorCnpj = s.tomador?.cnpj?.replace(/\D/g, '') || '';
            blocoALines.push(
                `|A100|2|01|${s.serie || ''}|${s.numeroNfse || ''}|${s.chaveNfe || ''}|${formatDate(s.date as Date)}|${formatDate(s.date as Date)}|${formatValue(s.valorServicos)}|${formatValue(s.valorPis)}|${formatValue(s.valorCofins)}|0|0|`
            );
        });
    }
    blocoALines.push('|A990|' + (blocoALines.length + 1) + '|');
    allLines.push(...blocoALines);
    
    // --- Bloco C (Produtos) ---
    const produtos = launches.filter(l => l.type === 'saida' && l.status !== 'Cancelado');
    const blocoCLines = [];
    blocoCLines.push('|C001|' + (produtos.length > 0 ? '0' : '1') + '|');
     if (produtos.length > 0) {
        blocoCLines.push(`|C010|${company.cnpj?.replace(/\D/g, '')}|0|`);
        produtos.forEach(p => {
             const destCnpj = p.destinatario?.cnpj?.replace(/\D/g, '') || '';
             blocoCLines.push(
                `|C100|0|1|${destCnpj}|55|01|${p.serie || ''}|${p.numeroNfse || ''}|${p.chaveNfe}|${formatDate(p.date as Date)}|${formatDate(p.date as Date)}|${formatValue(p.valorTotalNota)}|1|0|0|${formatValue(p.valorTotalNota)}|9|${formatValue(p.valorTotalNota)}|${formatValue(p.valorPis)}|${formatValue(p.valorCofins)}|`
             );
        });
    }
    blocoCLines.push('|C990|' + (blocoCLines.length + 1) + '|');
    allLines.push(...blocoCLines);

    // --- Blocos Vazios ---
    allLines.push('|D001|1|', '|D990|2|');
    allLines.push('|F001|1|', '|F990|2|');
    allLines.push('|I001|1|', '|I990|2|');

    // --- Bloco M ---
    const totalPis = launches.reduce((acc, l) => acc + (l.valorPis || 0), 0);
    const totalCofins = launches.reduce((acc, l) => acc + (l.valorCofins || 0), 0);
    const hasPisCofins = totalPis > 0 || totalCofins > 0;
    
    const blocoMLines = [];
    blocoMLines.push('|M001|' + (hasPisCofins ? '0' : '1') + '|');
    if(hasPisCofins) {
        blocoMLines.push(`|M200|${formatValue(totalPis)}|0|0|0|${formatValue(totalPis)}|01|`);
        blocoMLines.push(`|M600|${formatValue(totalCofins)}|0|0|0|${formatValue(totalCofins)}|01|`);
    }
    blocoMLines.push('|M990|' + (blocoMLines.length + 1) + '|');
    allLines.push(...blocoMLines);

    allLines.push('|P001|1|', '|P990|2|');
    allLines.push('|1001|1|', '|1990|2|');

    // --- Bloco 9 ---
    const recordCounts: { [key: string]: number } = {};
    allLines.forEach(line => {
        const recordType = line.split('|')[1];
        if (recordType) {
            recordCounts[recordType] = (recordCounts[recordType] || 0) + 1;
        }
    });

    const bloco9Lines = [];
    bloco9Lines.push('|9001|0|');
    
    const sortedRecordTypes = Object.keys(recordCounts).sort();
    sortedRecordTypes.forEach(record => {
        bloco9Lines.push(`|9900|${record}|${recordCounts[record]}|`);
    });
    
    bloco9Lines.push(`|9900|9001|1|`);
    bloco9Lines.push(`|9900|9900|${sortedRecordTypes.length + 4}|`);
    bloco9Lines.push(`|9900|9990|1|`);
    bloco9Lines.push(`|9900|9999|1|`);
    
    bloco9Lines.sort((a, b) => a.localeCompare(b)); 

    const totalLinesInBlock9 = bloco9Lines.length + 1;
    bloco9Lines.push(`|9990|${allLines.length + 1}|`); // Corrected reference
    
    const totalLinesInFile = allLines.length + totalLinesInBlock9 + 1;
    bloco9Lines.push(`|9999|${totalLinesInFile}|`);

    const finalFileContent = [...allLines, ...bloco9Lines].join('\r\n') + '\r\n';
    
    const fileName = `EFD_CONTRIBUICOES_${company.cnpj?.replace(/\D/g, '')}_${monthStr}${yearStr}.txt`;
    const blob = new Blob([finalFileContent], { type: 'text/plain;charset=iso-8859-1' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Save record to Firestore
    try {
        const fileRecord: Omit<EfdFile, 'id'> = {
            fileName,
            period,
            type: tipoEscrituracao,
            isSemMovimento: semMovimento,
            createdAt: serverTimestamp(),
            userId,
            companyId: company.id
        };
        const efdFilesRef = collection(db, `users/${userId}/companies/${company.id}/efdFiles`);
        await addDoc(efdFilesRef, fileRecord);
    } catch (e) {
        console.error("Error saving file record to Firestore:", e);
        // Do not block the user, just log the error
    }
    
    return { success: true, message: `Arquivo ${fileName} gerado e download iniciado.` };
}

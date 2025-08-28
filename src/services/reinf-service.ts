
import type { Company } from '@/types/company';
import { format, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { collection, getDocs, query, where, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Launch, ReinfFile } from '@/types';

const formatValue = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0,00';
  return value.toFixed(2).replace('.', ',');
};

const formatDate = (date: Date): string => {
  if (!date || !(date instanceof Date) || !isValid(date)) {
    return '';
  }
  return format(date, 'yyyy-MM-dd');
};

const sanitizeString = (str: string | undefined | null): string => {
    if (!str) return '';
    return str.replace(/[|]/g, '').trim().toUpperCase();
}

interface ServiceResult {
    success: boolean;
    message?: string;
}

const generateEventId = (cnpj: string) => {
    const timestamp = new Date().getTime();
    return `ID1${cnpj}${timestamp}`;
}

/**
 * Generates the EFD-Reinf XML content.
 */
export async function generateReinfXml(
    userId: string,
    company: Company,
    period: string
): Promise<ServiceResult> {
    const [monthStr, yearStr] = period.split('/');
    if (!monthStr || !yearStr) {
        return { success: false, message: "Período inválido." };
    }
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    const companyCnpj = company.cnpj?.replace(/\D/g, '') || '';

    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    // Fetch service notes taken with INSS withholding
    const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);
    const q = query(launchesRef, 
        where('type', '==', 'servico'),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
    );

    const snapshot = await getDocs(q);
    // Filter for INSS withholding in memory to avoid complex index
    const servicesTaken = snapshot.docs
        .map(doc => doc.data() as Launch)
        .filter(launch => launch.valorInss && launch.valorInss > 0);


    if (servicesTaken.length === 0) {
        return { success: false, message: "Nenhuma nota de serviço com retenção de INSS encontrada no período." };
    }
    
    const eventR1000Id = generateEventId(companyCnpj);
    let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/envioLoteEventos/v1_05_01">
  <loteEventos>
    <evento id="${eventR1000Id}">
      <Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtInfoContribuinte/v1_05_01">
        <evtInfoContri id="${eventR1000Id}">
          <ideEvento>
            <tpAmb>2</tpAmb>
            <procEmi>1</procEmi>
            <verProc>1.0</verProc>
          </ideEvento>
          <ideContri>
            <tpInsc>1</tpInsc>
            <nrInsc>${companyCnpj}</nrInsc>
          </ideContri>
          <infoContri>
            <inclusao>
              <idePeriodo>
                <iniValid>${format(startDate, 'yyyy-MM')}</iniValid>
              </idePeriodo>
              <infoCadastro>
                <classTrib>99</classTrib>
                <indEscrituracao>1</indEscrituracao>
                <indDesoneracao>0</indDesoneracao>
                <indAcordoIsenMulta>0</indAcordoIsenMulta>
                <indSitPJ>0</indSitPJ>
                <contato>
                  <nmCtt>${sanitizeString(company.razaoSocial)}</nmCtt>
                  <cpfCtt>${'00000000000'}</cpfCtt>
                  <foneFixo>${company.telefone?.replace(/\D/g, '') || ''}</foneFixo>
                  <email>${company.email || ''}</email>
                </contato>
              </infoCadastro>
            </inclusao>
          </infoContri>
        </evtInfoContri>
      </Reinf>
    </evento>`;
    
    servicesTaken.forEach(service => {
        const eventR2010Id = generateEventId(companyCnpj);
        const prestadorCnpj = service.prestador?.cnpj?.replace(/\D/g, '') || '';
        xmlContent += `
    <evento id="${eventR2010Id}">
      <Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtServTom/v1_05_01">
        <evtServTom id="${eventR2010Id}">
          <ideEvento>
            <perApur>${format(startDate, 'yyyy-MM')}</perApur>
          </ideEvento>
          <ideContri>
            <tpInsc>1</tpInsc>
            <nrInsc>${companyCnpj}</nrInsc>
          </ideContri>
          <idePrestServ>
            <cnpjPrestador>${prestadorCnpj}</cnpjPrestador>
            <vlrTotalBruto>${formatValue(service.valorServicos)}</vlrTotalBruto>
            <vlrTotalBaseRet>${formatValue(service.valorServicos)}</vlrTotalBaseRet>
            <vlrTotalRetPrinc>${formatValue(service.valorInss)}</vlrTotalRetPrinc>
            <indCPRB>0</indCPRB>
            <infoNFS>
              <serie>${'S'}</serie>
              <numDocto>${service.numeroNfse}</numDocto>
              <dtEmissao>${formatDate(service.date as Date)}</dtEmissao>
              <vlrBruto>${formatValue(service.valorServicos)}</vlrBruto>
            </infoNFS>
          </idePrestServ>
        </evtServTom>
      </Reinf>
    </evento>`;
    });

    const eventR2099Id = generateEventId(companyCnpj);
     xmlContent += `
    <evento id="${eventR2099Id}">
        <Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtFechamento/v1_05_01">
            <evtFecha id="${eventR2099Id}">
                <ideEvento>
                    <perApur>${format(startDate, 'yyyy-MM')}</perApur>
                </ideEvento>
                <ideContri>
                    <tpInsc>1</tpInsc>
                    <nrInsc>${companyCnpj}</nrInsc>
                </ideContri>
                <ideRespInf>
                    <nmResp>Contador</nmResp>
                    <cpfResp>00000000000</cpfResp>
                    <telefone>62999999999</telefone>
                    <email>contador@email.com</email>
                </ideRespInf>
                <infoFech>
                    <evtServTom>S</evtServTom>
                </infoFech>
            </evtFecha>
        </Reinf>
    </evento>
  </loteEventos>
</Reinf>`;

    const fileName = `REINF_${company.cnpj?.replace(/\D/g, '')}_${monthStr}${yearStr}.xml`;
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    try {
        const fileRecord: Omit<ReinfFile, 'id'> = {
            fileName,
            period,
            type: 'R-2010',
            createdAt: serverTimestamp(),
            userId,
            companyId: company.id
        };
        const reinfFilesRef = collection(db, `users/${userId}/companies/${company.id}/reinfFiles`);
        await addDoc(reinfFilesRef, fileRecord);
    } catch (e) {
        console.error("Error saving file record to Firestore:", e);
    }
    
    return { success: true, message: `Arquivo ${fileName} gerado e download iniciado.` };
}

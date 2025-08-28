
import type { Company } from '@/types/company';
import { format, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { collection, getDocs, query, where, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Launch, ReinfFile } from '@/types';

// #region Helper Functions
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

const generateEventId = (cnpj: string) => {
    const timestamp = new Date().getTime();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `ID1${cnpj}${timestamp}${randomSuffix}`.slice(0, 36);
}
// #endregion

// #region Event Generation Functions

/**
 * Gera o XML do evento R-1000 (Informações do Contribuinte).
 */
const generateR1000 = (company: Company, period: string): string => {
    const eventId = generateEventId(company.cnpj.replace(/\D/g, ''));
    return `
    <evento id="${eventId}">
      <Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtInfoContribuinte/v1_05_01">
        <evtInfoContri id="${eventId}">
          <ideEvento>
            <tpAmb>2</tpAmb>
            <procEmi>1</procEmi>
            <verProc>1.0</verProc>
          </ideEvento>
          <ideContri>
            <tpInsc>1</tpInsc>
            <nrInsc>${company.cnpj.replace(/\D/g, '')}</nrInsc>
          </ideContri>
          <infoContri>
            <inclusao>
              <idePeriodo>
                <iniValid>${period}</iniValid>
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
                  <foneFixo>${(company.telefone || '').replace(/\D/g, '')}</foneFixo>
                  <email>${company.email || ''}</email>
                </contato>
              </infoCadastro>
            </inclusao>
          </infoContri>
        </evtInfoContri>
      </Reinf>
    </evento>`;
};

/**
 * Gera os XMLs do evento R-2010 (Serviços Tomados).
 */
const generateR2010 = (companyCnpj: string, servicesTaken: Launch[], period: string): string => {
    return servicesTaken.map(service => {
        const eventId = generateEventId(companyCnpj);
        const prestadorCnpj = service.prestador?.cnpj?.replace(/\D/g, '') || '';
        return `
    <evento id="${eventId}">
      <Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtServTom/v1_05_01">
        <evtServTom id="${eventId}">
          <ideEvento>
            <perApur>${period}</perApur>
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
    }).join('');
};

/**
 * Gera os XMLs do evento R-2020 (Serviços Prestados).
 */
const generateR2020 = (companyCnpj: string, servicesProvided: Launch[], period: string): string => {
    return servicesProvided.map(service => {
        const eventId = generateEventId(companyCnpj);
        const tomadorCnpj = service.tomador?.cnpj?.replace(/\D/g, '') || '';
        return `
    <evento id="${eventId}">
      <Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtServPrest/v1_05_01">
        <evtServPrest id="${eventId}">
          <ideEvento>
            <perApur>${period}</perApur>
          </ideEvento>
          <ideContri>
            <tpInsc>1</tpInsc>
            <nrInsc>${companyCnpj}</nrInsc>
          </ideContri>
          <ideTomador>
            <tpInsc>1</tpInsc>
            <nrInsc>${tomadorCnpj}</nrInsc>
            <vlrTotalBruto>${formatValue(service.valorServicos)}</vlrTotalBruto>
            <vlrTotalBaseRet>${formatValue(service.valorServicos)}</vlrTotalBaseRet>
            <vlrTotalRetPrinc>${formatValue(service.valorInss)}</vlrTotalRetPrinc>
            <infoProcRet>
              <!-- Placeholder for legal process info -->
            </infoProcRet>
          </ideTomador>
        </evtServPrest>
      </Reinf>
    </evento>`;
    }).join('');
};

/**
 * Gera o XML do evento R-2099 (Fechamento).
 */
const generateR2099 = (companyCnpj: string, period: string, hasR2010: boolean, hasR2020: boolean): string => {
    const eventId = generateEventId(companyCnpj);
    return `
    <evento id="${eventId}">
        <Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtFechamento/v1_05_01">
            <evtFecha id="${eventId}">
                <ideEvento>
                    <perApur>${period}</perApur>
                </ideEvento>
                <ideContri>
                    <tpInsc>1</tpInsc>
                    <nrInsc>${companyCnpj}</nrInsc>
                </ideContri>
                <ideRespInf>
                    <nmResp>Contador Exemplo</nmResp>
                    <cpfResp>00000000000</cpfResp>
                    <telefone>62999999999</telefone>
                    <email>contador@example.com</email>
                </ideRespInf>
                <infoFech>
                    <evtServTom>${hasR2010 ? 'S' : 'N'}</evtServTom>
                    <evtServPrest>${hasR2020 ? 'S' : 'N'}</evtServPrest>
                    <evtAssocDespRec>N</evtAssocDespRec>
                    <evtAssocDespRep>N</evtAssocDespRep>
                    <evtComProd>N</evtComProd>
                    <evtCPRB>N</evtCPRB>
                    <evtAquisProd>N</evtAquisProd>
                    <evtRecursoClubes>N</evtRecursoClubes>
                </infoFech>
            </evtFecha>
        </Reinf>
    </evento>`;
};
// #endregion

/**
 * Orchestrates the generation of the complete EFD-Reinf XML file.
 */
export async function generateReinfXml(
    userId: string,
    company: Company,
    periodStr: string
): Promise<ServiceResult> {
    const [monthStr, yearStr] = periodStr.split('/');
    if (!monthStr || !yearStr) {
        return { success: false, message: "Período inválido." };
    }
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    const companyCnpj = company.cnpj?.replace(/\D/g, '') || '';
    const apiPeriod = `${year}-${monthStr}`;

    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    // Fetch all launches for the period
    const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);
    const q = query(launchesRef, where('date', '>=', startDate), where('date', '<=', endDate));
    const snapshot = await getDocs(q);
    const launches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as Timestamp).toDate() } as Launch));

    // Filter for specific events
    const servicesTaken = launches.filter(l => l.type === 'entrada' && (l.valorInss || 0) > 0);
    const servicesProvided = launches.filter(l => l.type === 'servico' && (l.valorInss || 0) > 0);

    if (servicesTaken.length === 0 && servicesProvided.length === 0) {
        return { success: false, message: "Nenhuma nota fiscal com retenção de INSS (serviços tomados ou prestados) foi encontrada no período." };
    }

    let xmlEvents = '';
    xmlEvents += generateR1000(company, apiPeriod);
    if (servicesTaken.length > 0) {
        xmlEvents += generateR2010(companyCnpj, servicesTaken, apiPeriod);
    }
    if (servicesProvided.length > 0) {
        xmlEvents += generateR2020(companyCnpj, servicesProvided, apiPeriod);
    }
    xmlEvents += generateR2099(companyCnpj, apiPeriod, servicesTaken.length > 0, servicesProvided.length > 0);

    const finalXml = `<?xml version="1.0" encoding="UTF-8"?>
<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/envioLoteEventos/v1_05_01">
  <loteEventos>${xmlEvents}
  </loteEventos>
</Reinf>`;

    const fileName = `REINF_${companyCnpj}_${monthStr}${yearStr}.xml`;
    const blob = new Blob([finalXml], { type: 'application/xml;charset=utf-8' });
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
            period: periodStr,
            type: 'R-2099', // Closing event
            createdAt: serverTimestamp(),
            userId,
            companyId: company.id
        };
        const reinfFilesRef = collection(db, `users/${userId}/companies/${company.id}/reinfFiles`);
        await addDoc(reinfFilesRef, fileRecord);
    } catch (e) {
        console.error("Error saving file record to Firestore:", e);
    }
    
    return { success: true, message: `Arquivo ${fileName} gerado com sucesso.` };
}


import type { Company } from '@/types/company';
import { format, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { collection, getDocs, query, where, Timestamp, addDoc, serverTimestamp, writeBatch, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Launch, ReinfFile } from '@/types';

// #region Helper Functions
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

// #region XML Generation Functions

/**
 * Gera o XML do evento R-1000 (Informações do Contribuinte).
 */
const generateR1000Xml = (company: Company, period: string): { eventId: string, payload: string } => {
    const eventId = generateEventId(company.cnpj.replace(/\D/g, ''));
    const payload = `
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
</Reinf>`;
    return { eventId, payload };
};

const generateR2010Xml = (companyCnpj: string, service: Launch, period: string): { eventId: string, payload: string } => {
    const eventId = generateEventId(companyCnpj);
    const prestadorCnpj = service.prestador?.cnpj?.replace(/\D/g, '') || '';
    const payload = `
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
      <vlrTotalBruto>${(service.valorServicos || 0).toFixed(2)}</vlrTotalBruto>
      <vlrTotalBaseRet>${(service.valorServicos || 0).toFixed(2)}</vlrTotalBaseRet>
      <vlrTotalRetPrinc>${(service.valorInss || 0).toFixed(2)}</vlrTotalRetPrinc>
      <indCPRB>0</indCPRB>
      <infoNFS>
        <serie>${'S'}</serie>
        <numDocto>${service.numeroNfse}</numDocto>
        <dtEmissao>${format(service.date as Date, 'yyyy-MM-dd')}</dtEmissao>
        <vlrBruto>${(service.valorServicos || 0).toFixed(2)}</vlrBruto>
      </infoNFS>
    </idePrestServ>
  </evtServTom>
</Reinf>`;
    return { eventId, payload };
};

const generateR2020Xml = (companyCnpj: string, service: Launch, period: string): { eventId: string, payload: string } => {
    const eventId = generateEventId(companyCnpj);
    const tomadorCnpj = service.tomador?.cnpj?.replace(/\D/g, '') || '';
    const payload = `
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
      <vlrTotalBruto>${(service.valorServicos || 0).toFixed(2)}</vlrTotalBruto>
      <vlrTotalBaseRet>${(service.valorServicos || 0).toFixed(2)}</vlrTotalBaseRet>
      <vlrTotalRetPrinc>${(service.valorInss || 0).toFixed(2)}</vlrTotalRetPrinc>
    </ideTomador>
  </evtServPrest>
</Reinf>`;
    return { eventId, payload };
};


const generateR2099Xml = (companyCnpj: string, period: string): { eventId: string, payload: string } => {
    const eventId = generateEventId(companyCnpj);
    const payload = `
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
            <evtServTom>S</evtServTom>
            <evtServPrest>S</evtServPrest>
            <evtAssocDespRec>N</evtAssocDespRec>
            <evtAssocDespRep>N</evtAssocDespRep>
            <evtComProd>N</evtComProd>
            <evtCPRB>N</evtCPRB>
            <evtAquisProd>N</evtAquisProd>
            <evtRecursoClubes>N</evtRecursoClubes>
        </infoFech>
    </evtFecha>
</Reinf>`;
    return { eventId, payload };
};
// #endregion

interface ServiceResult {
    success: boolean;
    message?: string;
}

export async function generateReinfEvents(
    userId: string,
    company: Company,
    periodStr: string
): Promise<ServiceResult> {
    const [monthStr, yearStr] = periodStr.split('/');
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    const apiPeriod = `${year}-${monthStr}`;
    const companyCnpj = company.cnpj?.replace(/\D/g, '') || '';

    const reinfFilesRef = collection(db, `users/${userId}/companies/${company.id}/reinfFiles`);
    const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);

    // --- 1. Clean up existing pending events for the period ---
    const qPending = query(reinfFilesRef, where('period', '==', periodStr), where('status', '==', 'pending'));
    const pendingSnap = await getDocs(qPending);
    if (!pendingSnap.empty) {
        const deleteBatch = writeBatch(db);
        pendingSnap.docs.forEach(doc => deleteBatch.delete(doc.ref));
        await deleteBatch.commit();
    }

    // --- 2. Fetch data for new events ---
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));
    const qLaunches = query(launchesRef, where('date', '>=', startDate), where('date', '<=', endDate));
    const launchesSnap = await getDocs(qLaunches);
    const allLaunches = launchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Launch));
    
    const servicesTaken = allLaunches.filter(l => l.type === 'entrada' && (l.valorInss || 0) > 0);
    const servicesProvided = allLaunches.filter(l => l.type === 'servico' && (l.valorInss || 0) > 0);

    // --- 3. Generate new events and save them ---
    const saveBatch = writeBatch(db);
    let eventsGeneratedCount = 0;

    // R-1000 (always generate if no other event exists for the period)
    const qR1000 = query(reinfFilesRef, where('type', '==', 'R-1000'));
    const r1000Snap = await getDocs(qR1000);
    if (r1000Snap.empty) {
        const { eventId, payload } = generateR1000Xml(company, apiPeriod);
        const r1000Ref = doc(reinfFilesRef);
        saveBatch.set(r1000Ref, { eventId, period: periodStr, type: 'R-1000', status: 'pending', relatedLaunchIds: [], createdAt: serverTimestamp(), userId, companyId: company.id, payload });
        eventsGeneratedCount++;
    }

    // R-2010
    if (servicesTaken.length > 0) {
        const { eventId, payload } = generateR2010Xml(companyCnpj, servicesTaken[0], apiPeriod); // Simplified: one event per type for now
        const r2010Ref = doc(reinfFilesRef);
        saveBatch.set(r2010Ref, { eventId, period: periodStr, type: 'R-2010', status: 'pending', relatedLaunchIds: servicesTaken.map(s => s.id), createdAt: serverTimestamp(), userId, companyId: company.id, payload });
        eventsGeneratedCount++;
    }

    // R-2020
    if (servicesProvided.length > 0) {
        const { eventId, payload } = generateR2020Xml(companyCnpj, servicesProvided[0], apiPeriod); // Simplified: one event per type
        const r2020Ref = doc(reinfFilesRef);
        saveBatch.set(r2020Ref, { eventId, period: periodStr, type: 'R-2020', status: 'pending', relatedLaunchIds: servicesProvided.map(s => s.id), createdAt: serverTimestamp(), userId, companyId: company.id, payload });
        eventsGeneratedCount++;
    }
    
    // R-2099
    if (eventsGeneratedCount > 0 || (servicesTaken.length === 0 && servicesProvided.length === 0)) { // Generate closure if other events were made or if no movement
        const { eventId, payload } = generateR2099Xml(companyCnpj, apiPeriod);
        const r2099Ref = doc(reinfFilesRef);
        saveBatch.set(r2099Ref, { eventId, period: periodStr, type: 'R-2099', status: 'pending', relatedLaunchIds: [], createdAt: serverTimestamp(), userId, companyId: company.id, payload });
        eventsGeneratedCount++;
    }

    if (eventsGeneratedCount === 0) {
        return { success: false, message: "Nenhum dado encontrado para gerar eventos Reinf no período." };
    }

    await saveBatch.commit();
    return { success: true, message: `${eventsGeneratedCount} novos eventos foram gerados e estão prontos para envio.` };
}

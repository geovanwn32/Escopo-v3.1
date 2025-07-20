
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EsocialEvent, EsocialEventType } from '@/types/esocial';
import type { Company, EstablishmentData } from '@/types/company';

/**
 * Generates and saves a specific eSocial table event using real company data.
 * This service reads company details and generates an XML string for the event payload.
 */
export async function generateAndSaveEsocialEvent(
    userId: string,
    company: Company,
    eventType: EsocialEventType
) {
    const eventsRef = collection(db, `users/${userId}/companies/${company.id}/esocialEvents`);

    let payload = `<?xml version="1.0" encoding="UTF-8"?><eSocial><evtTabela><ideEvento>...</ideEvento></evtTabela></eSocial>`; // Default placeholder

    if (eventType === 'S-1005') {
        const establishmentRef = doc(db, `users/${userId}/companies/${company.id}/esocial`, 'establishment');
        const establishmentSnap = await getDoc(establishmentRef);
        const establishmentData = establishmentSnap.exists() ? establishmentSnap.data() as EstablishmentData : null;

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const eventId = `ID1${company.cnpj}${today.getTime()}`;

        const caepfInfo = establishmentData?.nrCaepf 
          ? `<infoCaepf><nrCaepf>${establishmentData.nrCaepf}</nrCaepf></infoCaepf>`
          : `<infoCaepf />`;

        payload = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtTabEstab/v_S_01_02_00">
  <evtTabEstab id="${eventId}">
    <ideEvento>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${company.cnpj}</nrInsc>
    </ideEmpregador>
    <infoEstab>
      <inclusao>
        <ideEstab>
          <tpInsc>1</tpInsc>
          <nrInsc>${company.cnpj}</nrInsc>
          <iniValid>${year}-${month}</iniValid>
        </ideEstab>
        <dadosEstab>
          <cnaePrincipal>${company.cnaePrincipalCodigo || '0000000'}</cnaePrincipal>
          <aliqRat>${establishmentData?.aliqRat || 0}</aliqRat>
          <fap>${establishmentData?.fap || 0}</fap>
          ${caepfInfo}
          <infoObra/>
          <infoTrab>
            <infoApr>
              <nrInsc>${establishmentData?.nrInscApr || ''}</nrInsc>
            </infoApr>
            <infoPCD>
              <contrPCD>${establishmentData?.contrataPCD ? 'S' : 'N'}</contrPCD>
            </infoPCD>
          </infoTrab>
        </dadosEstab>
      </inclusao>
    </infoEstab>
  </evtTabEstab>
</eSocial>`;
    }

    const newEvent: Omit<EsocialEvent, 'id' | 'createdAt'> = {
        type: eventType,
        status: 'pending',
        errorDetails: null,
        payload,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
    };

    await addDoc(eventsRef, newEvent);
}

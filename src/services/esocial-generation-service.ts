
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EsocialEvent, EsocialEventType } from '@/types/esocial';
import type { Company } from '@/types/company';

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

    // Generate a more detailed payload for S-1005
    if (eventType === 'S-1005') {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const eventId = `ID1${company.cnpj}${today.getTime()}`;

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
          <aliqRat>0</aliqRat>
          <fap>0</fap>
          <infoCaepf/>
          <infoObra/>
          <infoTrab>
            <infoApr>
              <nrInsc/>
            </infoApr>
            <infoPCD/>
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
        payload, // Use the generated payload
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
    };

    await addDoc(eventsRef, newEvent);
}

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Employee } from '@/types/employee';
import type { Admission } from '@/types/admission';
import { format } from 'date-fns';

export async function generateAdmissionEvent(
    userId: string,
    company: Company,
    employee: Employee,
    admissionData: Omit<Admission, 'id' | 'employeeId' | 'employeeName' | 'admissionDate'>
) {
    const eventsRef = collection(db, `users/${userId}/companies/${company.id}/esocialEvents`);
    const admissionsRef = collection(db, `users/${userId}/companies/${company.id}/admissions`);
    const today = new Date();
    const eventId = `ID1${company.cnpj}${today.getTime()}`;

    const payload = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAdmissao/v_S_01_02_00">
  <evtAdmissao id="${eventId}">
    <ideEvento>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${company.cnpj}</nrInsc>
    </ideEmpregador>
    <trabalhador>
      <cpfTrab>${employee.cpf}</cpfTrab>
      <nmTrab>${employee.nomeCompleto}</nmTrab>
      <sexo>${employee.sexo === 'masculino' ? 'M' : 'F'}</sexo>
      <racaCor>1</racaCor>
      <estCiv>${employee.estadoCivil === 'casado' ? '2' : '1'}</estCiv>
      <grauInstr>07</grauInstr>
      <nmSoc>NÃO INFORMADO</nmSoc>
      <nascimento>
        <dtNascto>${format(employee.dataNascimento, 'yyyy-MM-dd')}</dtNascto>
        <codMunic>9999999</codMunic>
        <uf>GO</uf>
        <paisNascto>105</paisNascto>
        <paisNac>105</paisNac>
      </nascimento>
      <endereco>
        <brasil>
          <tpLograd>RUA</tpLograd>
          <dscLograd>${employee.logradouro}</dscLograd>
          <nrLograd>${employee.numero}</nrLograd>
          <bairro>${employee.bairro}</bairro>
          <cep>${employee.cep}</cep>
          <codMunic>9999999</codMunic>
          <uf>${employee.uf}</uf>
        </brasil>
      </endereco>
      <trabImig>
        <tmpResid>1</tmpResid>
        <condIng>1</condIng>
      </trabImig>
      <infoDeficiencia>
        <defFisica>N</defFisica>
        <defVisual>N</defVisual>
        <defAuditiva>N</defAuditiva>
        <defMental>N</defMental>
        <defIntelectual>N</defIntelectual>
        <reabReadap>N</reabReadap>
      </infoDeficiencia>
      <contato>
        <emailPric>${employee.email || ''}</emailPric>
      </contato>
    </trabalhador>
    <vinculo>
      <matricula>1</matricula>
      <tpRegTrab>${admissionData.tipoRegimeTrabalhista}</tpRegTrab>
      <tpRegPrev>${admissionData.tipoRegimePrevidenciario}</tpRegPrev>
      <cadIni>N</cadIni>
      <infoRegimeTrab>
        <infoCeletista>
          <dtAdm>${format(employee.dataAdmissao, 'yyyy-MM-dd')}</dtAdm>
          <tpAdmissao>1</tpAdmissao>
          <indAdmissao>1</indAdmissao>
          <tpRegJor>1</tpRegJor>
          <natAtividade>${admissionData.naturezaAtividade}</natAtividade>
        </infoCeletista>
      </infoRegimeTrab>
      <infoContrato>
        <codCargo>${employee.cargo}</codCargo>
        <codFuncao>${employee.cargo}</codFuncao>
        <codCateg>${admissionData.categoriaTrabalhador}</codCateg>
        <remuneracao>
          <vrSalFx>${employee.salarioBase.toFixed(2)}</vrSalFx>
          <undSalFixo>1</undSalFixo>
        </remuneracao>
        <duracao>
          <tpContr>1</tpContr>
        </duracao>
        <localTrabalho>
          <localTrabGeral>
            <tpInsc>1</tpInsc>
            <nrInsc>${company.cnpj}</nrInsc>
          </localTrabGeral>
        </localTrabalho>
        <horContratual>
          <qtdHrsSem>44</qtdHrsSem>
          <tpJornada>1</tpJornada>
          <dscTpJorn>DIÁRIA</dscTpJorn>
        </horContratual>
      </infoContrato>
    </vinculo>
  </evtAdmissao>
</eSocial>`;

    // Save the admission record
    const admissionRecord: Omit<Admission, 'id' | 'createdAt'> = {
        employeeId: employee.id!,
        employeeName: employee.nomeCompleto,
        admissionDate: employee.dataAdmissao,
        ...admissionData,
        updatedAt: serverTimestamp(),
    };
    const admissionDocRef = await addDoc(admissionsRef, {
        ...admissionRecord,
        createdAt: serverTimestamp()
    });

    // Save the eSocial event record
    const newEvent = {
        eventId,
        type: 'S-2200' as const,
        status: 'pending' as const,
        payload,
        errorDetails: null,
        relatedDocId: admissionDocRef.id,
        relatedCollection: 'admissions',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
    };
    await addDoc(eventsRef, newEvent);
}

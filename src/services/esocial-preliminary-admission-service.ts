import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Employee } from '@/types/employee';
import type { PreliminaryAdmission } from '@/types/preliminary-admission';
import { format } from 'date-fns';

export async function generatePreliminaryAdmissionEvent(
    userId: string,
    company: Company,
    employee: Employee
) {
    const eventsRef = collection(db, `users/${userId}/companies/${company.id}/esocialEvents`);
    const preliminaryAdmissionsRef = collection(db, `users/${userId}/companies/${company.id}/preliminaryAdmissions`);
    const today = new Date();
    const eventId = `ID1${company.cnpj}${today.getTime()}`;

    if (!employee.cpf || !employee.dataNascimento || !employee.dataAdmissao) {
        throw new Error("Dados essenciais do funcionário (CPF, Data de Nascimento, Data de Admissão) não encontrados.");
    }

    const payload = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAdmPrelim/v_S_01_02_00">
  <evtAdmPrelim id="${eventId}">
    <ideEvento>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${company.cnpj}</nrInsc>
    </ideEmpregador>
    <infoRegPrelim>
      <cpfTrab>${employee.cpf}</cpfTrab>
      <dtNascto>${format(employee.dataNascimento, 'yyyy-MM-dd')}</dtNascto>
      <dtAdm>${format(employee.dataAdmissao, 'yyyy-MM-dd')}</dtAdm>
      <matricula>1</matricula>
      <codCateg>101</codCateg>
      <vrSalFx>${employee.salarioBase.toFixed(2)}</vrSalFx>
      <undSalFixo>1</undSalFixo>
      <tpContr>1</tpContr>
    </infoRegPrelim>
  </evtAdmPrelim>
</eSocial>`;

    const preliminaryAdmissionRecord: Omit<PreliminaryAdmission, 'id' | 'createdAt'> = {
        employeeId: employee.id!,
        employeeName: employee.nomeCompleto,
        admissionDate: employee.dataAdmissao,
        cpf: employee.cpf,
        birthDate: employee.dataNascimento,
        updatedAt: serverTimestamp(),
    };
    const admissionDocRef = await addDoc(preliminaryAdmissionsRef, {
        ...preliminaryAdmissionRecord,
        createdAt: serverTimestamp()
    });

    const newEvent = {
        eventId,
        type: 'S-2190' as const,
        status: 'pending' as const,
        payload,
        errorDetails: null,
        relatedDocId: admissionDocRef.id,
        relatedCollection: 'preliminaryAdmissions',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
    };
    await addDoc(eventsRef, newEvent);
}

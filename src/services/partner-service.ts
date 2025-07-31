
import { collection, query, where, getDocs, addDoc, writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Partner } from "@/types/partner";

/**
 * Checks for an existing partner by CPF/CNPJ and adds them if they don't exist.
 * This is an "upsert" operation focused on creation.
 * It does not update existing partners.
 * @param userId - The ID of the authenticated user.
 * @param companyId - The ID of the active company.
 * @param partnerData - An object containing partner details.
 */
export async function upsertPartnerFromLaunch(
  userId: string,
  companyId: string,
  partnerData: Pick<Partner, 'cpfCnpj' | 'razaoSocial' | 'type'>
): Promise<void> {
  if (!userId || !companyId || !partnerData.cpfCnpj) {
    console.error("User ID, Company ID, or Partner CPF/CNPJ is missing. Cannot upsert partner.");
    return;
  }
  
  const partnersRef = collection(db, `users/${userId}/companies/${companyId}/partners`);
  const q = query(partnersRef, where("cpfCnpj", "==", partnerData.cpfCnpj.replace(/\D/g, '')));
  
  const querySnapshot = await getDocs(q);

  // If the partner doesn't exist, create a new one.
  if (querySnapshot.empty) {
    const newPartner: Omit<Partner, 'id'> = {
      cpfCnpj: partnerData.cpfCnpj.replace(/\D/g, ''),
      razaoSocial: partnerData.razaoSocial,
      nomeFantasia: partnerData.razaoSocial, // Use a sensible default
      type: partnerData.type,
      // Initialize other fields as empty or with defaults
      inscricaoEstadual: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: '',
      email: '',
      telefone: '',
    };
    await addDoc(partnersRef, newPartner);
  }
}

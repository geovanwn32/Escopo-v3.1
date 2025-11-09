
import { collection, addDoc, writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ContaContabil } from "@/types/conta-contabil";
import { v4 as uuidv4 } from 'uuid'; // Import UUID generator

interface CompanyData {
    nomeFantasia: string;
    razaoSocial: string;
    cnpj: string;
}

const defaultChartOfAccounts: Omit<ContaContabil, 'id'>[] = [
  // ATIVO
  { codigo: "1", nome: "ATIVO", tipo: "sintetica", natureza: "ativo" },
  { codigo: "1.1", nome: "ATIVO CIRCULANTE", tipo: "sintetica", natureza: "ativo" },
  { codigo: "1.1.1", nome: "Caixa e Equivalentes de Caixa", tipo: "sintetica", natureza: "ativo" },
  { codigo: "1.1.1.01", nome: "Caixa Geral", tipo: "analitica", natureza: "ativo" },
  { codigo: "1.1.1.02", nome: "Bancos Conta Movimento", tipo: "analitica", natureza: "ativo" },
  { codigo: "1.1.1.03", nome: "Aplicações Financeiras de Liquidez Imediata", tipo: "analitica", natureza: "ativo" },
  { codigo: "1.1.2", nome: "Clientes", tipo: "sintetica", natureza: "ativo" },
  { codigo: "1.1.2.01", nome: "Clientes a Receber", tipo: "analitica", natureza: "ativo" },
  { codigo: "1.1.3", nome: "Estoques", tipo: "sintetica", natureza: "ativo" },
  { codigo: "1.1.3.01", nome: "Mercadorias para Revenda", tipo: "analitica", natureza: "ativo" },
  
  // PASSIVO
  { codigo: "2", nome: "PASSIVO", tipo: "sintetica", natureza: "passivo" },
  { codigo: "2.1", nome: "PASSIVO CIRCULANTE", tipo: "sintetica", natureza: "passivo" },
  { codigo: "2.1.1", nome: "Fornecedores", tipo: "sintetica", natureza: "passivo" },
  { codigo: "2.1.1.01", nome: "Fornecedores Nacionais", tipo: "analitica", natureza: "passivo" },
  { codigo: "2.1.2", nome: "Obrigações Sociais e Trabalhistas", tipo: "sintetica", natureza: "passivo" },
  { codigo: "2.1.2.01", nome: "Salários e Ordenados a Pagar", tipo: "analitica", natureza: "passivo" },
  { codigo: "2.1.2.02", nome: "INSS a Recolher", tipo: "analitica", natureza: "passivo" },
  { codigo: "2.1.2.03", nome: "FGTS a Recolher", tipo: "analitica", natureza: "passivo" },
  { codigo: "2.1.3", nome: "Obrigações Tributárias", tipo: "sintetica", natureza: "passivo" },
  { codigo: "2.1.3.01", nome: "Simples Nacional a Recolher", tipo: "analitica", natureza: "passivo" },
  { codigo: "2.1.3.02", nome: "IRRF a Recolher", tipo: "analitica", natureza: "passivo" },

  // PATRIMÔNIO LÍQUIDO
  { codigo: "2.3", nome: "PATRIMÔNIO LÍQUIDO", tipo: "sintetica", natureza: "patrimonio_liquido" },
  { codigo: "2.3.1", nome: "Capital Social", tipo: "sintetica", natureza: "patrimonio_liquido" },
  { codigo: "2.3.1.01", nome: "Capital Social Subscrito", tipo: "analitica", natureza: "patrimonio_liquido" },
  { codigo: "2.3.2", nome: "Reservas de Lucros", tipo: "sintetica", natureza: "patrimonio_liquido" },
  { codigo: "2.3.2.01", nome: "Lucros ou Prejuízos Acumulados", tipo: "analitica", natureza: "patrimonio_liquido" },

  // RECEITAS
  { codigo: "3", nome: "RECEITAS", tipo: "sintetica", natureza: "receita" },
  { codigo: "3.1", nome: "RECEITA BRUTA", tipo: "sintetica", natureza: "receita" },
  { codigo: "3.1.1", nome: "Receita de Vendas e/ou Serviços", tipo: "sintetica", natureza: "receita" },
  { codigo: "3.1.1.01", nome: "Receita de Venda de Mercadorias", tipo: "analitica", natureza: "receita" },
  { codigo: "3.1.1.02", nome: "Receita de Prestação de Serviços", tipo: "analitica", natureza: "receita" },
  { codigo: "3.1.1.03", nome: "Receitas a Classificar", tipo: "analitica", natureza: "receita" },

  // DESPESAS
  { codigo: "4", nome: "DESPESAS", tipo: "sintetica", natureza: "despesa" },
  { codigo: "4.1", nome: "DESPESAS OPERACIONAIS", tipo: "sintetica", natureza: "despesa" },
  { codigo: "4.1.1", nome: "Despesas com Pessoal", tipo: "sintetica", natureza: "despesa" },
  { codigo: "4.1.1.01", nome: "Salários e Ordenados", tipo: "analitica", natureza: "despesa" },
  { codigo: "4.1.1.02", nome: "Pró-labore", tipo: "analitica", natureza: "despesa" },
  { codigo: "4.1.1.03", nome: "INSS", tipo: "analitica", natureza: "despesa" },
  { codigo: "4.1.1.04", nome: "FGTS", tipo: "analitica", natureza: "despesa" },
  { codigo: "4.1.2", nome: "Despesas Administrativas", tipo: "sintetica", natureza: "despesa" },
  { codigo: "4.1.2.01", nome: "Aluguéis e Condomínios", tipo: "analitica", natureza: "despesa" },
  { codigo: "4.1.2.02", nome: "Água, Energia e Telefone", tipo: "analitica", natureza: "despesa" },
  { codigo: "4.1.2.03", nome: "Material de Escritório", tipo: "analitica", natureza: "despesa" },
  { codigo: "4.1.2.04", nome: "Despesas com Veículos", tipo: "analitica", natureza: "despesa" },
  { codigo: "4.1.2.05", nome: "Despesas a Classificar", tipo: "analitica", natureza: "despesa" },
  { codigo: "4.1.3", nome: "Despesas Tributárias", tipo: "sintetica", natureza: "despesa" },
  { codigo: "4.1.3.01", nome: "Impostos e Taxas", tipo: "analitica", natureza: "despesa" },
];

/**
 * Creates a new company and populates it with a default chart of accounts and a unique pseudo-IP.
 * @param userId The ID of the user creating the company.
 * @param companyData The basic data for the new company.
 */
export async function createCompanyWithDefaults(
  userId: string,
  companyData: CompanyData
): Promise<void> {
  // 1. Create the company document with a pseudo-IP
  const companiesRef = collection(db, `users/${userId}/companies`);
  const companyDocRef = await addDoc(companiesRef, {
    ...companyData,
    pseudoIp: uuidv4(), // Generate a unique identifier
  });

  // 2. Create the chart of accounts in a batch
  const chartOfAccountsRef = collection(db, `users/${userId}/companies/${companyDocRef.id}/contasContabeis`);
  const batch = writeBatch(db);

  defaultChartOfAccounts.forEach(account => {
    const docRef = doc(chartOfAccountsRef); // Auto-generate ID for each account
    batch.set(docRef, account);
  });

  await batch.commit();
}

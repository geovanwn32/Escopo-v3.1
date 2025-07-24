
export interface BankTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
}

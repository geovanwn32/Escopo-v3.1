
import { collection, getDocs, query, where, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, subMonths, getDay, getDate } from 'date-fns';
import type { Notification } from '@/types';

/**
 * Checks for payroll and tax deadlines for the previous month and creates notifications if they are missed.
 * This function is designed to be called once per day per company.
 * 
 * @param userId - The ID of the authenticated user.
 * @param companyId - The ID of the active company.
 */
export async function checkDeadlines(userId: string, companyId: string) {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // Check if the verification for this company has already run today
    const lastCheck = sessionStorage.getItem(`deadlineCheck_${companyId}`);
    if (lastCheck === todayStr) {
        return; // Already checked today
    }

    // Determine the previous month's period string (e.g., "07/2024")
    const prevMonthDate = subMonths(today, 1);
    const periodToCheck = format(prevMonthDate, 'MM/yyyy');

    const dayOfMonth = getDate(today);

    // --- Check 1: Payroll Deadline (after the 7th) ---
    if (dayOfMonth >= 7) {
        await checkPayroll(userId, companyId, periodToCheck);
    }

    // --- Check 2: Tax Deadline (after the 15th) ---
    if (dayOfMonth >= 15) {
        await checkTaxes(userId, companyId, periodToCheck);
    }
    
    // Mark that the check has been performed for today
    sessionStorage.setItem(`deadlineCheck_${companyId}`, todayStr);
}

/**
 * Checks if payroll has been calculated for the given period.
 */
async function checkPayroll(userId: string, companyId: string, period: string) {
    const payrollsRef = collection(db, `users/${userId}/companies/${companyId}/payrolls`);
    const q = query(payrollsRef, where('period', '==', period), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        // No payroll found, check if notification already exists
        await createNotificationIfNotExists(
            userId, 
            companyId, 
            `payroll_deadline_${period.replace('/', '-')}`, 
            {
                title: '⚠️ Lembrete: Folha de Pagamento',
                message: `A folha de pagamento da competência ${period} ainda não foi calculada. O prazo é o 7º dia do mês.`,
                type: 'warning',
            }
        );
    }
}

/**
 * Checks if taxes (PGDAS) have been calculated for the given period.
 */
async function checkTaxes(userId: string, companyId: string, period: string) {
    const pgdasRef = collection(db, `users/${userId}/companies/${companyId}/pgdas`);
    const q = query(pgdasRef, where('period', '==', period), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        // No PGDAS calculation found, check if notification already exists
        await createNotificationIfNotExists(
            userId, 
            companyId, 
            `tax_deadline_${period.replace('/', '-')}`,
            {
                title: '🚨 Alerta: Apuração de Impostos',
                message: `A apuração de impostos (Simples Nacional) da competência ${period} não foi realizada. O prazo é o dia 15.`,
                type: 'error',
            }
        );
    }
}

/**
 * Creates a notification only if a notification with a similar key doesn't already exist.
 * The key is based on the type of check and the period.
 */
async function createNotificationIfNotExists(
    userId: string, 
    companyId: string, 
    notificationKey: string, 
    notificationData: Omit<Notification, 'id' | 'isRead' | 'createdAt' | 'userId'>
) {
    const notificationsRef = collection(db, `users/${userId}/companies/${companyId}/notifications`);
    
    // Use a specific field in the notification to check for existence
    const q = query(notificationsRef, where('notificationKey', '==', notificationKey), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        const newNotification: Omit<Notification, 'id'> = {
            ...notificationData,
            notificationKey, // Store the unique key
            isRead: false,
            createdAt: serverTimestamp(),
            userId,
        };
        await addDoc(notificationsRef, newNotification);
    }
}

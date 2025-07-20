
import { collection, query, where, getDocs, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Produto } from "@/types/produto";

/**
 * Checks for existing products and adds new ones from a fiscal launch.
 * This is an "upsert" operation: it inserts if the product code doesn't exist.
 * It does not update existing products.
 * @param userId - The ID of the authenticated user.
 * @param companyId - The ID of the active company.
 * @param products - An array of product data extracted from an XML file.
 */
export async function upsertProductsFromLaunch(
  userId: string,
  companyId: string,
  products: Produto[]
): Promise<void> {
  if (!userId || !companyId) {
    console.error("User ID or Company ID is missing. Cannot upsert products.");
    return;
  }
  
  if (!products || products.length === 0) {
    return;
  }

  const productsRef = collection(db, `users/${userId}/companies/${companyId}/produtos`);
  
  // Create a set of existing product codes for quick lookup
  const querySnapshot = await getDocs(productsRef);
  const existingCodes = new Set(querySnapshot.docs.map(doc => doc.data().codigo));

  // Filter out products that already exist
  const newProducts = products.filter(p => p.codigo && !existingCodes.has(p.codigo));

  if (newProducts.length === 0) {
    return;
  }

  // Use a batch write for efficiency
  const batch = writeBatch(db);
  newProducts.forEach(productData => {
    const newProductRef = doc(productsRef); // Firestore will generate a new ID
    batch.set(newProductRef, productData);
  });

  await batch.commit();
}

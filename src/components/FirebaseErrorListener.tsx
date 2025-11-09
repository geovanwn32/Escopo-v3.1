
'use client';

import { useEffect, useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      console.error(
        'Firestore Permission Error Caught by Listener:',
        error.toJSON()
      );
      
      const errorMessage = `Acesso negado ao tentar ${error.operation} em '${error.path}'. Verifique as regras de segurança.`;

      // Use a toast or another UI element to show the error to the user
      // This is more user-friendly than crashing or just logging to console.
      toast({
        variant: 'destructive',
        title: 'Erro de Permissão do Firestore',
        description: errorMessage,
        duration: 10000,
      });

      // You can also throw the error here if you want it to be caught by Next.js's error overlay
      // during development. This can be very useful for debugging.
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  // This component does not render anything itself
  return null;
}

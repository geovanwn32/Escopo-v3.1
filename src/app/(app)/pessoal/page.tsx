
"use client";
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const PessoalPageWrapper = dynamic(() => import('@/components/pessoal/pessoal-page-wrapper'), {
    ssr: false,
    loading: () => <div className="flex h-full w-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>
});

export default function PessoalPage() {
    return <PessoalPageWrapper />;
}

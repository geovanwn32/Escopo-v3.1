
"use client";
import dynamic from "next/dynamic";
const PessoalPageWrapper = dynamic(() => import("@/components/pessoal/pessoal-page-wrapper"), { ssr: false });

export default function PessoalPage() {
    return <PessoalPageWrapper />;
}

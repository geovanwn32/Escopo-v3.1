
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LifeBuoy, Mail, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Central de Ajuda
          </DialogTitle>
          <DialogDescription>
            Precisa de ajuda? Aqui estão algumas opções de suporte.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-2">Documentação</h4>
                <p className="text-sm text-muted-foreground mb-3">
                    Ainda não temos uma documentação completa, mas estamos trabalhando nisso. Em breve, você encontrará guias detalhados e tutoriais aqui.
                </p>
                <Button variant="outline" disabled>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Acessar Documentação (Em Breve)
                </Button>
            </div>
             <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-2">Suporte por Email</h4>
                <p className="text-sm text-muted-foreground mb-3">
                    Para questões urgentes ou problemas técnicos, entre em contato conosco diretamente por email.
                </p>
                <Button asChild>
                    <Link href="mailto:suporte@escopo.com.br">
                        <Mail className="mr-2 h-4 w-4" />
                        suporte@escopo.com.br
                    </Link>
                </Button>
            </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

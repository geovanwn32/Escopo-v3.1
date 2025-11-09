
"use client";

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, listAll, deleteObject, getDownloadURL } from 'firebase/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Archive, HardDriveDownload, Trash2, ShieldCheck } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';


interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
}

interface BackupFile {
    name: string;
    path: string;
    url: string;
    createdAt: Date;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export function BackupModal({ isOpen, onClose, userId, companyId }: BackupModalProps) {
    const [loading, setLoading] = useState(false);
    const [loadingList, setLoadingList] = useState(true);
    const [backups, setBackups] = useState<BackupFile[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        if (!isOpen) return;

        const fetchBackups = async () => {
            setLoadingList(true);
            try {
                const storage = getStorage();
                const backupFolderRef = ref(storage, `backups/${userId}/${companyId}`);
                const res = await listAll(backupFolderRef);
                
                const filesData = await Promise.all(
                    res.items.map(async (itemRef) => {
                        const url = await getDownloadURL(itemRef);
                        const metadata = await itemRef.getMetadata();
                        return {
                            name: itemRef.name,
                            path: itemRef.fullPath,
                            url,
                            createdAt: new Date(metadata.timeCreated),
                        };
                    })
                );
                
                // Sort by most recent first
                filesData.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
                setBackups(filesData);

            } catch (error) {
                console.error("Error listing backups:", error);
                toast({ variant: 'destructive', title: 'Erro ao listar backups.' });
            } finally {
                setLoadingList(false);
            }
        };

        fetchBackups();
    }, [isOpen, userId, companyId, toast]);

    const handleCreateBackup = async () => {
        setLoading(true);
        try {
            const functions = getFunctions();
            const backupCompanyData = httpsCallable(functions, 'backupCompanyData');
            const result = await backupCompanyData({ companyId });

            toast({ title: "Backup Iniciado!", description: "O backup da empresa foi criado com sucesso. A lista será atualizada." });
            
            // Refetch list to show new backup
            const storage = getStorage();
            const backupFolderRef = ref(storage, `backups/${userId}/${companyId}`);
            const res = await listAll(backupFolderRef);
            const filesData = await Promise.all(res.items.map(async (itemRef) => ({
                name: itemRef.name,
                path: itemRef.fullPath,
                url: await getDownloadURL(itemRef),
                createdAt: new Date((await itemRef.getMetadata()).timeCreated)
            })));
             filesData.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
            setBackups(filesData);

        } catch (error) {
            console.error("Error creating backup:", error);
            toast({ variant: "destructive", title: "Erro ao criar backup", description: (error as any).message });
        } finally {
            setLoading(false);
        }
    };
    
    const handleDeleteBackup = async (filePath: string) => {
        setLoading(true);
        try {
            const storage = getStorage();
            const fileRef = ref(storage, filePath);
            await deleteObject(fileRef);
            
            setBackups(prev => prev.filter(b => b.path !== filePath));
            toast({ title: 'Backup excluído com sucesso!' });

        } catch(error) {
             console.error("Error deleting backup:", error);
             toast({ variant: "destructive", title: "Erro ao excluir backup" });
        } finally {
            setLoading(false);
        }
    };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Backup e Restauração de Dados</DialogTitle>
          <DialogDescription>
            Crie backups manuais dos dados da sua empresa ou restaure a partir de um ponto anterior.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-green-600"/>
                        Criar Novo Ponto de Restauração
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Clique no botão abaixo para gerar um arquivo de backup completo com todos os dados da sua empresa (cadastros, lançamentos, etc). O arquivo será salvo de forma segura.
                    </p>
                    <Button onClick={handleCreateBackup} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Archive className="mr-2 h-4 w-4"/>}
                        Criar Backup Agora
                    </Button>
                </CardContent>
            </Card>

            <h3 className="text-lg font-semibold pt-4">Backups Existentes</h3>
            <div className="border rounded-md max-h-[40vh] overflow-y-auto">
                {loadingList ? (
                    <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : backups.length === 0 ? (
                    <p className="text-center text-muted-foreground p-8">Nenhum backup encontrado.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data de Criação</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {backups.map(backup => (
                                <TableRow key={backup.path}>
                                    <TableCell className="font-mono text-sm">{format(backup.createdAt, 'dd/MM/yyyy HH:mm:ss')}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button asChild variant="outline" size="sm">
                                            <a href={backup.url} target="_blank" download={backup.name}><HardDriveDownload className="mr-2 h-4 w-4"/>Baixar</a>
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm" disabled={loading}>
                                                    <Trash2 className="mr-2 h-4 w-4"/>Excluir
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirmar Exclusão?</AlertDialogTitle>
                                                    <AlertDialogDescription>Esta ação é irreversível. O arquivo de backup será permanentemente removido.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteBackup(backup.path)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
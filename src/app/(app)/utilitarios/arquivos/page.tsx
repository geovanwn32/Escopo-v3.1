
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { Company } from "@/types/company";
import type { StoredFile } from "@/types/file";
import { cn } from "@/lib/utils";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileArchive,
  Loader2,
  MoreHorizontal,
  Download,
  Trash2,
  UploadCloud,
  X,
  File as FileIcon,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface UploadingFile {
  name: string;
  progress: number;
}

export default function ArquivosPage() {
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const companyId = sessionStorage.getItem("activeCompanyId");
      if (user && companyId) {
        const companyDataString = sessionStorage.getItem(`company_${companyId}`);
        if (companyDataString) {
          setActiveCompany(JSON.parse(companyDataString));
        } else {
            setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user || !activeCompany) {
        setLoading(false);
        setStoredFiles([]);
        return;
    };

    setLoading(true);
    const filesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/files`);
    const q = query(filesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const filesData = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          } as StoredFile;
        });
        setStoredFiles(filesData);
        setLoading(false);
      }, (error) => {
        console.error("Erro ao buscar arquivos: ", error);
        toast({ variant: "destructive", title: "Erro ao buscar arquivos." });
        setLoading(false);
      });

    return () => unsubscribe();
  }, [user, activeCompany, toast]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFilesToUpload(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setFilesToUpload(prev => [...prev, ...Array.from(e.target.files)]);
    }
  }

  const removeFileFromQueue = (index: number) => {
    setFilesToUpload(prev => prev.filter((_, i) => i !== index));
  }
  
  const handleUpload = () => {
    if (!user || !activeCompany || filesToUpload.length === 0) return;
    
    filesToUpload.forEach(file => {
        const storagePath = `users/${user.uid}/companies/${activeCompany!.id}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        setUploadingFiles(prev => [...prev, { name: file.name, progress: 0 }]);
        
        uploadTask.on("state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadingFiles(prev => prev.map(f => f.name === file.name ? { ...f, progress } : f));
          },
          (error) => {
            console.error("Upload error:", error);
            toast({ variant: "destructive", title: "Erro no upload", description: `Falha ao enviar o arquivo ${file.name}.` });
            setUploadingFiles(prev => prev.filter(f => f.name !== file.name));
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const fileData: Omit<StoredFile, 'id'> = {
                name: file.name,
                url: downloadURL,
                type: file.type,
                size: file.size,
                storagePath: storagePath,
                createdAt: serverTimestamp(),
            };

            const filesRef = collection(db, `users/${user.uid}/companies/${activeCompany!.id}/files`);
            await addDoc(filesRef, fileData);
            
            // The onSnapshot listener will add the file to storedFiles automatically.
            setUploadingFiles(prev => prev.filter(f => f.name !== file.name));
          }
        );
    });
    setFilesToUpload([]); // Clear queue after starting uploads
  };
  
  const handleDelete = async (file: StoredFile) => {
      if (!user || !activeCompany || !file.id) return;
      const fileDocRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/files`, file.id);
      const storageRef = ref(storage, file.storagePath);
      try {
          await deleteObject(storageRef);
          await deleteDoc(fileDocRef);
          toast({ title: "Arquivo excluído", description: `O arquivo ${file.name} foi removido.` });
      } catch (error) {
          console.error("Erro ao excluir arquivo:", error);
          toast({ variant: "destructive", title: "Erro ao excluir", description: "Não foi possível remover o arquivo." });
      }
  };

  return (
    <div className="space-y-6">
       <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        multiple
      />
      <h1 className="text-2xl font-bold">Repositório de Arquivos</h1>
      
       <Card>
        <CardHeader>
          <CardTitle>Adicionar Novos Arquivos</CardTitle>
          <CardDescription>Arraste e solte os arquivos na área abaixo ou clique para selecionar.</CardDescription>
        </CardHeader>
        <CardContent>
             <div 
                className={cn(
                    "border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center transition-colors",
                    isDragging && "border-primary bg-primary/10",
                    !activeCompany && "cursor-not-allowed opacity-50"
                )}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => activeCompany && fileInputRef.current?.click()}
             >
                <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
                    <UploadCloud className="h-12 w-12"/>
                    <div>
                      <p className="font-semibold text-foreground">Arraste seus arquivos aqui</p>
                      <p className="text-sm">ou clique para selecionar</p>
                    </div>
                </div>
             </div>

            {filesToUpload.length > 0 && (
                <div className="mt-6 space-y-4">
                    <h4 className="text-lg font-medium">Fila de Upload ({filesToUpload.length})</h4>
                    <div className="space-y-2">
                        {filesToUpload.map((file, index) => (
                             <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <FileIcon className="h-5 w-5 text-muted-foreground"/>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{file.name}</span>
                                        <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFileFromQueue(index)}>
                                    <X className="h-4 w-4"/>
                                </Button>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2">
                         <Button variant="outline" onClick={() => setFilesToUpload([])}>Limpar Fila</Button>
                         <Button onClick={handleUpload}>Enviar Arquivos</Button>
                    </div>
                </div>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Arquivos da Empresa</CardTitle>
          <CardDescription>Gerencie documentos e arquivos importantes da sua empresa.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : storedFiles.length === 0 && uploadingFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                <FileArchive className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhum arquivo encontrado</h3>
              <p className="text-muted-foreground mt-2">
                {!activeCompany ? "Selecione uma empresa para começar." : 'Use a área acima para enviar seu primeiro arquivo.'}
              </p>
            </div>
          ) : (
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Arquivo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Data de Upload</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadingFiles.map((file) => (
                    <TableRow key={file.name}>
                        <TableCell className="font-medium">{file.name}</TableCell>
                        <TableCell colSpan={2}>
                            <Progress value={file.progress} className="w-[60%]" />
                        </TableCell>
                        <TableCell className="text-right"><Loader2 className="h-4 w-4 animate-spin ml-auto" /></TableCell>
                    </TableRow>
                ))}
                {storedFiles.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium max-w-sm truncate">{file.name}</TableCell>
                    <TableCell>{formatBytes(file.size)}</TableCell>
                    <TableCell>{file.createdAt ? format(file.createdAt as Date, 'dd/MM/yyyy HH:mm') : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                             <a href={file.url} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-4 w-4" /> Baixar
                             </a>
                          </DropdownMenuItem>
                           <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita e o arquivo será removido permanentemente.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(file)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

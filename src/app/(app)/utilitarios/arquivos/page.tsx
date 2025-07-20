
"use client";

import { useState, useEffect, useRef } from "react";
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
  PlusCircle,
  FileArchive,
  Loader2,
  MoreHorizontal,
  Download,
  Trash2,
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

export default function ArquivosPage() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
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
        setFiles([]);
        return;
    };

    setLoading(true);
    const filesRef = collection(
      db,
      `users/${user.uid}/companies/${activeCompany.id}/files`
    );
    const q = query(filesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const filesData = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
          } as StoredFile;
        });
        setFiles(filesData);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao buscar arquivos: ", error);
        toast({
          variant: "destructive",
          title: "Erro ao buscar arquivos.",
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, activeCompany, toast]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        Array.from(event.target.files).forEach(handleUpload);
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleUpload = (file: File) => {
    if (!user || !activeCompany) return;

    const storagePath = `users/${user.uid}/companies/${activeCompany.id}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(prev => ({...prev, [file.name]: progress}));
      },
      (error) => {
        console.error("Upload error:", error);
        toast({ variant: "destructive", title: "Erro no upload", description: `Falha ao enviar o arquivo ${file.name}.` });
        setUploadProgress(prev => {
            const newState = {...prev};
            delete newState[file.name];
            return newState;
        });
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

        const filesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/files`);
        await addDoc(filesRef, fileData);

        toast({ title: "Upload Concluído!", description: `O arquivo ${file.name} foi enviado.` });
        setUploadProgress(prev => {
            const newState = {...prev};
            delete newState[file.name];
            return newState;
        });
      }
    );
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

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }


  return (
    <div className="space-y-6">
       <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
      />
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Repositório de Arquivos</h1>
        <Button onClick={() => fileInputRef.current?.click()} disabled={!activeCompany}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Novo Arquivo
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Arquivos da Empresa</CardTitle>
          <CardDescription>
            Gerencie documentos e arquivos importantes da sua empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : files.length === 0 && Object.keys(uploadProgress).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                <FileArchive className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhum arquivo encontrado</h3>
              <p className="text-muted-foreground mt-2">
                {!activeCompany ? "Selecione uma empresa para começar." : 'Clique em "Adicionar Novo Arquivo" para enviar.'}
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
                {Object.entries(uploadProgress).map(([name, progress]) => (
                    <TableRow key={name}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell colSpan={2}>
                            <Progress value={progress} className="w-[60%]" />
                        </TableCell>
                        <TableCell className="text-right"><Loader2 className="h-4 w-4 animate-spin ml-auto" /></TableCell>
                    </TableRow>
                ))}
                {files.map((file) => (
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

    
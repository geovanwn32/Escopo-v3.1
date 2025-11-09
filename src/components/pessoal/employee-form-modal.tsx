
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, PlusCircle, Trash2 } from 'lucide-react';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import { Employee } from '@/types/employee';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { Timestamp } from 'firebase/firestore';


interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  employee: Employee | null;
}

const dependentSchema = z.object({
  nomeCompleto: z.string().min(1, "Nome é obrigatório"),
  dataNascimento: z.date({ required_error: "Data de nascimento é obrigatória." }),
  cpf: z.string().min(14, "CPF inválido").transform(val => val.replace(/\D/g, '')),
  isSalarioFamilia: z.boolean().default(false),
  isIRRF: z.boolean().default(false),
});

const employeeSchema = z.object({
  // Personal Data
  nomeCompleto: z.string().min(1, "Nome é obrigatório"),
  dataNascimento: z.date({ required_error: "Data de nascimento é obrigatória." }),
  cpf: z.string().min(14, "CPF inválido").transform(val => val.replace(/\D/g, '')),
  rg: z.string().min(1, "RG é obrigatório"),
  estadoCivil: z.string().min(1, "Estado civil é obrigatório"),
  sexo: z.string().min(1, "Sexo é obrigatório"),
  nomeMae: z.string().min(1, "Nome da mãe é obrigatório"),
  nomePai: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal('')),
  telefone: z.string().min(10, "Telefone inválido"),
  
  // Dependents
  dependentes: z.array(dependentSchema).optional(),

  // Address
  cep: z.string().min(9, "CEP inválido").transform(val => val.replace(/\D/g, '')),
  logradouro: z.string().min(1, "Logradouro é obrigatório"),
  numero: z.string().min(1, "Número é obrigatório"),
  complemento: z.string().optional(),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  uf: z.string().length(2, "UF inválida"),

  // Contract
  dataAdmissao: z.date({ required_error: "Data de admissão é obrigatória." }),
  cargo: z.string().min(1, "Cargo é obrigatório"),
  departamento: z.string().min(1, "Departamento é obrigatório"),
  salarioBase: z.string().min(1, "Salário é obrigatório").transform(v => String(v).replace(',', '.')),
  tipoContrato: z.string().min(1, "Tipo de contrato é obrigatório"),
  jornadaTrabalho: z.string().min(1, "Jornada é obrigatória"),
  ativo: z.boolean().default(true),
});

type FormData = z.infer<typeof employeeSchema>;

const formatCpf = (cpf: string = '') => cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const formatCep = (cep: string = '') => cep?.replace(/(\d{5})(\d{3})/, "$1-$2");

function EmployeeForm({ userId, companyId, employee, onClose }: Omit<EmployeeFormModalProps, 'isOpen'>) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const mode = employee ? 'edit' : 'create';
    
    const form = useForm<FormData>({
        resolver: zodResolver(employeeSchema),
        defaultValues: mode === 'create' 
          ? {
              ativo: true,
              dependentes: []
            }
          : {
              ...employee,
              cpf: formatCpf(employee?.cpf || ''),
              cep: formatCep(employee?.cep || ''),
              salarioBase: String(employee?.salarioBase || ''),
              ativo: employee?.ativo ?? true,
              dependentes: (employee?.dependentes || []).map(dep => ({
                ...dep, 
                cpf: formatCpf(dep.cpf),
                dataNascimento: dep.dataNascimento instanceof Timestamp 
                    ? dep.dataNascimento.toDate() 
                    : dep.dataNascimento,
              }))
            },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "dependentes"
    });

    const handleCepLookup = async (cep: string) => {
      const cleanedCep = cep.replace(/\D/g, '');
      if (cleanedCep.length !== 8) return;

      try {
          const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
          if (!response.ok) throw new Error('CEP não encontrado');
          const data = await response.json();
          if (data.erro) throw new Error('CEP inválido');

          form.setValue('logradouro', data.logradouro);
          form.setValue('bairro', data.bairro);
          form.setValue('cidade', data.localidade);
          form.setValue('uf', data.uf);
          form.setFocus('numero');

      } catch (error) {
          toast({
              variant: 'destructive',
              title: 'Erro ao buscar CEP',
              description: (error as Error).message || 'Não foi possível buscar o endereço.',
          });
      }
    };

    const onSubmit = async (values: FormData) => {
        setLoading(true);
        const cleanedCpf = values.cpf.replace(/\D/g, '');
        try {

            if (mode === 'create') {
                const employeesRef = collection(db, `users/${userId}/companies/${companyId}/employees`);
                const q = query(employeesRef, where("cpf", "==", cleanedCpf));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    toast({
                        variant: "destructive",
                        title: "CPF Duplicado",
                        description: `Já existe um funcionário cadastrado com este CPF.`,
                    });
                    return;
                }
            }

        const dataToSave = { ...values, salarioBase: parseFloat(values.salarioBase), cpf: cleanedCpf };
        
        if (mode === 'create') {
            const employeesRef = collection(db, `users/${userId}/companies/${companyId}/employees`);
            await addDoc(employeesRef, dataToSave);
            toast({
            title: "Funcionário Cadastrado!",
            description: `${values.nomeCompleto} foi adicionado com sucesso.`,
            });
        } else if (employee?.id) {
            const employeeRef = doc(db, `users/${userId}/companies/${companyId}/employees`, employee.id);
            await setDoc(employeeRef, dataToSave);
            toast({
            title: "Funcionário Atualizado!",
            description: `Os dados de ${values.nomeCompleto} foram atualizados.`,
            });
        }
        
        onClose();
        } catch (error) {
            console.error("Error saving employee:", error);
            toast({
                variant: "destructive",
                title: "Erro ao salvar",
                description: "Não foi possível salvar os dados do funcionário."
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <DialogHeader>
            <DialogTitle>{mode === 'create' ? 'Cadastro de Novo Funcionário' : 'Alterar Funcionário'}</DialogTitle>
            <DialogDescription>
                {mode === 'create' 
                ? "Preencha os dados abaixo para admitir um novo funcionário."
                : `Alterando os dados de ${employee?.nomeCompleto}.`
                }
            </DialogDescription>
            </DialogHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Tabs defaultValue="personal" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="personal">Dados Pessoais</TabsTrigger>
                    <TabsTrigger value="address">Endereço</TabsTrigger>
                    <TabsTrigger value="dependents">Dependentes</TabsTrigger>
                    <TabsTrigger value="contract">Dados do Contrato</TabsTrigger>
                </TabsList>
                
                <div className="max-h-[60vh] overflow-y-auto p-4">
                    <TabsContent value="personal" className="space-y-4">
                    <FormField control={form.control} name="nomeCompleto" render={({ field }) => ( <FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="dataNascimento" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Data de Nascimento</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="cpf" render={({ field }) => ( <FormItem><FormLabel>CPF</FormLabel><FormControl><Input {...field} onChange={(e) => {
                        const { value } = e.target;
                        e.target.value = value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3}s)(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                        field.onChange(e);
                        }} maxLength={14} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="rg" render={({ field }) => ( <FormItem><FormLabel>RG</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="telefone" render={({ field }) => ( <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="estadoCivil" render={({ field }) => ( <FormItem><FormLabel>Estado Civil</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="solteiro">Solteiro(a)</SelectItem><SelectItem value="casado">Casado(a)</SelectItem><SelectItem value="divorciado">Divorciado(a)</SelectItem><SelectItem value="viuvo">Viúvo(a)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="sexo" render={({ field }) => ( <FormItem><FormLabel>Sexo</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="masculino">Masculino</SelectItem><SelectItem value="feminino">Feminino</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                    <FormField control={form.control} name="nomeMae" render={({ field }) => ( <FormItem><FormLabel>Nome da Mãe</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="nomePai" render={({ field }) => ( <FormItem><FormLabel>Nome do Pai (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email (Opcional)</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem> )} />
                    </TabsContent>

                    <TabsContent value="address" className="space-y-4">
                    <FormField control={form.control} name="cep" render={({ field }) => ( <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} onChange={(e) => {
                        const { value } = e.target;
                        e.target.value = value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2');
                        field.onChange(e);
                        if(e.target.value.length === 9) handleCepLookup(e.target.value)
                        }} maxLength={9} /></FormControl><FormMessage /></FormItem> )} />
                    <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="logradouro" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Logradouro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="numero" render={({ field }) => ( <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="complemento" render={({ field }) => ( <FormItem><FormLabel>Complemento (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="bairro" render={({ field }) => ( <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="cidade" render={({ field }) => ( <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="uf" render={({ field }) => ( <FormItem><FormLabel>UF</FormLabel><FormControl><Input {...field} maxLength={2} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    </TabsContent>

                    <TabsContent value="dependents" className="space-y-4">
                    {fields.map((field, index) => (
                        <div key={field.id} className="p-4 border rounded-md relative space-y-4">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <FormField control={form.control} name={`dependentes.${index}.nomeCompleto`} render={({ field }) => ( <FormItem><FormLabel>Nome Completo do Dependente</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name={`dependentes.${index}.dataNascimento`} render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Data de Nascimento</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name={`dependentes.${index}.cpf`} render={({ field }) => ( <FormItem><FormLabel>CPF</FormLabel><FormControl><Input {...field} onChange={(e) => {
                            const { value } = e.target;
                            e.target.value = value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                            field.onChange(e);
                            }} maxLength={14} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <div className="flex items-center space-x-6">
                            <FormField control={form.control} name={`dependentes.${index}.isIRRF`} render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Dependente para IRRF</FormLabel><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name={`dependentes.${index}.isSalarioFamilia`} render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Dependente para Salário Família</FormLabel><FormMessage /></FormItem> )} />
                        </div>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => append({ nomeCompleto: '', dataNascimento: new Date(), cpf: '', isIRRF: true, isSalarioFamilia: false })}
                    >
                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Dependente
                    </Button>
                    </TabsContent>

                    <TabsContent value="contract" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="dataAdmissao" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Data de Admissão</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="cargo" render={({ field }) => ( <FormItem><FormLabel>Cargo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="departamento" render={({ field }) => ( <FormItem><FormLabel>Departamento</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="salarioBase" render={({ field }) => ( <FormItem><FormLabel>Salário Base (R$)</FormLabel><FormControl><Input {...field} onChange={e => {
                            const { value } = e.target;
                            e.target.value = value.replace(/[^0-9,.]/g, '').replace('.', ',');
                            field.onChange(e);
                        }} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="tipoContrato" render={({ field }) => ( <FormItem><FormLabel>Tipo de Contrato</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="clt">CLT</SelectItem><SelectItem value="pj">PJ</SelectItem><SelectItem value="estagio">Estágio</SelectItem><SelectItem value="temporario">Temporário</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="jornadaTrabalho" render={({ field }) => ( <FormItem><FormLabel>Jornada de Trabalho</FormLabel><FormControl><Input {...field} placeholder="Ex: 40 horas semanais" /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <FormField
                        control={form.control}
                        name="ativo"
                        render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                            <FormLabel className="text-base">Funcionário Ativo</FormLabel>
                            <FormDescription>
                                Funcionários inativos não aparecerão em novos cálculos.
                            </FormDescription>
                            </div>
                            <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                            </FormControl>
                        </FormItem>
                        )}
                    />
                    </TabsContent>
                </div>

                </Tabs>
                <DialogFooter className="pt-6">
                <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : <Save />}
                    {mode === 'create' ? 'Salvar Funcionário' : 'Salvar Alterações'}
                </Button>
                </DialogFooter>
            </form>
            </Form>
        </>
    );
}

export function EmployeeFormModal({ isOpen, onClose, userId, companyId, employee }: EmployeeFormModalProps) {
  const modalKey = employee?.id || 'new-employee';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl" key={modalKey}>
        <EmployeeForm 
            userId={userId} 
            companyId={companyId} 
            employee={employee} 
            onClose={onClose} 
        />
      </DialogContent>
    </Dialog>
  );
}

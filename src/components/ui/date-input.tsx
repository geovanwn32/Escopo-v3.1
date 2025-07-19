
"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { ptBR } from 'date-fns/locale'
import { Calendar as CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: Date;
  onChange?: (date?: Date) => void;
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const [textValue, setTextValue] = React.useState(value ? format(value, 'dd/MM/yyyy') : "");

    React.useEffect(() => {
        setTextValue(value ? format(value, 'dd/MM/yyyy') : "")
    }, [value])
    
    const handleDateChange = (date?: Date) => {
      if (onChange) {
        onChange(date);
      }
      setTextValue(date ? format(date, 'dd/MM/yyyy') : "");
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let str = e.target.value.replace(/\D/g, '');
      if (str.length > 2) str = str.substring(0,2) + '/' + str.substring(2);
      if (str.length > 5) str = str.substring(0,5) + '/' + str.substring(5,9);
      setTextValue(str);
      
      const parsedDate = parse(str, 'dd/MM/yyyy', new Date());
      if (isValid(parsedDate) && str.length === 10) {
        handleDateChange(parsedDate);
      } else if (str.length === 0) {
        handleDateChange(undefined)
      }
    };

    return (
        <Popover>
            <div className="relative">
                <Input
                    {...props}
                    ref={ref}
                    value={textValue}
                    onChange={handleInputChange}
                    placeholder="dd/mm/aaaa"
                    maxLength={10}
                    className={cn("pr-10", className)}
                />
                 <PopoverTrigger asChild>
                    <button type="button" className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    </button>
                 </PopoverTrigger>
            </div>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={value}
                    onSelect={handleDateChange}
                    initialFocus
                    locale={ptBR}
                />
            </PopoverContent>
        </Popover>
    )
  }
)
DateInput.displayName = "DateInput"

export { DateInput }

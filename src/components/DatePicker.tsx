'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = '选择日期',
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'inline-flex items-center rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground px-2.5 py-1.5 text-sm font-normal gap-1.5 w-full justify-start',
          !value && 'text-muted-foreground'
        )}
      >
        <CalendarIcon className="h-4 w-4" />
        {value ? format(value, 'yyyy-MM-dd') : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date)
            setOpen(false)
          }}
          locale={zhCN}
        />
      </PopoverContent>
    </Popover>
  )
}
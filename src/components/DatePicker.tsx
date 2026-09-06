'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatSystemDate } from '@/lib/time-format'

interface DatePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
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
        <span suppressHydrationWarning>{value ? formatSystemDate(value) : placeholder}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

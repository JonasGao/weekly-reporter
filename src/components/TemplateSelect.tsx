'use client'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { OfficialTemplate } from '@/lib/official-templates'
import type { Template } from '@/lib/db/schema'

interface TemplateSelectProps {
  officialTemplates: OfficialTemplate[]
  userTemplates: Template[]
  value: string
  onChange: (value: string) => void
}

export function TemplateSelect({ 
  officialTemplates, 
  userTemplates, 
  value, 
  onChange 
}: TemplateSelectProps) {
  return (
    <Select value={value} onValueChange={(val) => onChange(val as string)}>
      <SelectTrigger>
        <SelectValue placeholder="Select a template" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Official templates</SelectLabel>
          {officialTemplates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Personal templates</SelectLabel>
          {userTemplates.map((template) => (
            <SelectItem key={template.id} value={`user-${template.id}`}>
              {template.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { OfficialTemplateCard } from '@/components/OfficialTemplateCard'
import { UserTemplateCard } from '@/components/UserTemplateCard'
import type { OfficialTemplate } from '@/lib/official-templates'
import type { Template } from '@/lib/db/schema'

interface TemplateTabsProps {
  officialTemplates: OfficialTemplate[]
  userTemplates: Template[]
  onCloneOfficial: (templateId: string) => void
  onSaveAsOfficial: (templateId: string) => void
  onViewOfficial: (templateId: string) => void
  onDeleteUser: (id: number) => void
}

export function TemplateTabs({
  officialTemplates,
  userTemplates,
  onCloneOfficial,
  onSaveAsOfficial,
  onViewOfficial,
  onDeleteUser,
}: TemplateTabsProps) {
  return (
    <Tabs defaultValue="official" className="space-y-4">
      <TabsList>
        <TabsTrigger value="official">Official templates</TabsTrigger>
        <TabsTrigger value="user">Personal templates</TabsTrigger>
      </TabsList>
      
      <TabsContent value="official" className="space-y-4">
        {officialTemplates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No official templates
          </div>
        ) : (
          officialTemplates.map((template) => (
            <OfficialTemplateCard
              key={template.id}
              template={template}
              onClone={onCloneOfficial}
              onSaveAs={onSaveAsOfficial}
              onView={onViewOfficial}
            />
          ))
        )}
      </TabsContent>
      
      <TabsContent value="user" className="space-y-4">
        {userTemplates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No personal templates. Clone an official template or create one.
          </div>
        ) : (
          <>
            {userTemplates.map((template) => (
              <UserTemplateCard
                key={template.id}
                template={template}
                onDelete={onDeleteUser}
              />
            ))}
            <div className="flex justify-center">
              <Link href="/templates/new">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  New personal template
                </Button>
              </Link>
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  )
}

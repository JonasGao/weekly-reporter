'use client'

import { Briefcase, User, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ViewSwitcherProps {
  currentView: 'leadership' | 'personal'
  onViewChange: (view: 'leadership' | 'personal') => void
  isLoading?: boolean
}

export function ViewSwitcher({ currentView, onViewChange, isLoading }: ViewSwitcherProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-md border">
        <Button
          type="button"
          variant={currentView === 'leadership' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-r-none"
          onClick={() => onViewChange('leadership')}
          disabled={isLoading}
        >
          <Briefcase className="h-3.5 w-3.5" />
          领导版
        </Button>
        <Button
          type="button"
          variant={currentView === 'personal' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-l-none"
          onClick={() => onViewChange('personal')}
          disabled={isLoading}
        >
          <User className="h-3.5 w-3.5" />
          个人版
        </Button>
      </div>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
    </div>
  )
}

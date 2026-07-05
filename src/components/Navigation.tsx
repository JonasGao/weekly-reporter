'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Clock, FileText, Tag, FileStack, Cloud } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: '时间线', icon: Clock },
  { href: '/reports', label: '周报', icon: FileText },
  { href: '/tags', label: '标签', icon: Tag },
  { href: '/templates', label: '模板', icon: FileStack },
  { href: '/collect', label: '采集源', icon: Cloud },
]

export function Navigation() {
  const pathname = usePathname()
  
  return (
    <nav className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center gap-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || 
              (item.href !== '/' && pathname.startsWith(item.href))
            
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
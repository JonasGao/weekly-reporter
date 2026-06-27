'use client';

import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { VariableIcon } from 'lucide-react';

const SYSTEM_VARIABLES = [
  { name: '{{本周日期范围}}', description: '自动计算本周起止日期' },
  { name: '{{上周日期范围}}', description: '自动计算上周起止日期' },
  { name: '{{当前周数}}', description: '自动计算当前周数' },
  { name: '{{年份}}', description: '当前年份' },
  { name: '{{月份}}', description: '当前月份' },
];

const SECTION_VARIABLES = [
  { name: '{{核心成果}}', description: '核心成果区块骨架' },
  { name: '{{问题与风险}}', description: '问题与风险区块骨架' },
  { name: '{{下周计划}}', description: '下周计划区块骨架' },
  { name: '{{日常事务}}', description: '日常事务区块骨架' },
];

interface VariableToolbarProps {
  onInsertVariable: (variable: string) => void;
}

export function VariableToolbar({ onInsertVariable }: VariableToolbarProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
      >
        <VariableIcon className="h-4 w-4 mr-2" />
        插入变量
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>系统变量</DropdownMenuLabel>
          {SYSTEM_VARIABLES.map((variable) => (
            <DropdownMenuItem 
              key={variable.name}
              onClick={() => onInsertVariable(variable.name)}
            >
              <div className="flex flex-col">
                <span className="font-medium">{variable.name}</span>
                <span className="text-xs text-muted-foreground">{variable.description}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>区块变量</DropdownMenuLabel>
          {SECTION_VARIABLES.map((variable) => (
            <DropdownMenuItem 
              key={variable.name}
              onClick={() => onInsertVariable(variable.name)}
            >
              <div className="flex flex-col">
                <span className="font-medium">{variable.name}</span>
                <span className="text-xs text-muted-foreground">{variable.description}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
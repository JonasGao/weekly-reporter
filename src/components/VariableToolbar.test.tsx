import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariableToolbar } from './VariableToolbar';

describe('VariableToolbar', () => {
  describe('Basic Button', () => {
    it('should render button with "插入变量" text', () => {
      const onInsertVariable = vi.fn();
      
      render(<VariableToolbar onInsertVariable={onInsertVariable} />);
      
      expect(screen.getByRole('button', { name: /插入变量/i })).toBeInTheDocument();
    });

    it('should have VariableIcon in the button', () => {
      const onInsertVariable = vi.fn();
      
      render(<VariableToolbar onInsertVariable={onInsertVariable} />);
      
      const button = screen.getByRole('button', { name: /插入变量/i });
      // Check that the SVG icon is present
      expect(button.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Dropdown Menu', () => {
    it('should open dropdown when button is clicked', async () => {
      const onInsertVariable = vi.fn();
      
      render(<VariableToolbar onInsertVariable={onInsertVariable} />);
      
      const button = screen.getByRole('button', { name: /插入变量/i });
      fireEvent.click(button);
      
      // Dropdown should show system variables section label
      expect(screen.getByText('系统变量')).toBeInTheDocument();
      // Dropdown should show section variables section label
      expect(screen.getByText('区块变量')).toBeInTheDocument();
    });

    it('should display all 9 variables with their descriptions', async () => {
      const onInsertVariable = vi.fn();
      
      render(<VariableToolbar onInsertVariable={onInsertVariable} />);
      
      const button = screen.getByRole('button', { name: /插入变量/i });
      fireEvent.click(button);
      
      // System variables (5)
      expect(screen.getByText('{{本周日期范围}}')).toBeInTheDocument();
      expect(screen.getByText('自动计算本周起止日期')).toBeInTheDocument();
      expect(screen.getByText('{{上周日期范围}}')).toBeInTheDocument();
      expect(screen.getByText('自动计算上周起止日期')).toBeInTheDocument();
      expect(screen.getByText('{{当前周数}}')).toBeInTheDocument();
      expect(screen.getByText('自动计算当前周数')).toBeInTheDocument();
      expect(screen.getByText('{{年份}}')).toBeInTheDocument();
      expect(screen.getByText('当前年份')).toBeInTheDocument();
      expect(screen.getByText('{{月份}}')).toBeInTheDocument();
      expect(screen.getByText('当前月份')).toBeInTheDocument();
      
      // Section variables (4)
      expect(screen.getByText('{{核心成果}}')).toBeInTheDocument();
      expect(screen.getByText('核心成果区块骨架')).toBeInTheDocument();
      expect(screen.getByText('{{问题与风险}}')).toBeInTheDocument();
      expect(screen.getByText('问题与风险区块骨架')).toBeInTheDocument();
      expect(screen.getByText('{{下周计划}}')).toBeInTheDocument();
      expect(screen.getByText('下周计划区块骨架')).toBeInTheDocument();
      expect(screen.getByText('{{日常事务}}')).toBeInTheDocument();
      expect(screen.getByText('日常事务区块骨架')).toBeInTheDocument();
    });

    it('should call onInsertVariable callback when a variable is clicked', async () => {
      const onInsertVariable = vi.fn();
      
      render(<VariableToolbar onInsertVariable={onInsertVariable} />);
      
      const button = screen.getByRole('button', { name: /插入变量/i });
      fireEvent.click(button);
      
      // Click a system variable
      const weekRangeVariable = screen.getByText('{{本周日期范围}}');
      fireEvent.click(weekRangeVariable);
      
      expect(onInsertVariable).toHaveBeenCalledTimes(1);
      expect(onInsertVariable).toHaveBeenCalledWith('{{本周日期范围}}');
      
      // Reopen dropdown for the second variable
      fireEvent.click(button);
      
      // Click a section variable
      const coreResultsVariable = screen.getByText('{{核心成果}}');
      fireEvent.click(coreResultsVariable);
      
      expect(onInsertVariable).toHaveBeenCalledTimes(2);
      expect(onInsertVariable).toHaveBeenCalledWith('{{核心成果}}');
    });

    it('should close dropdown after selecting a variable', async () => {
      const onInsertVariable = vi.fn();
      
      render(<VariableToolbar onInsertVariable={onInsertVariable} />);
      
      const button = screen.getByRole('button', { name: /插入变量/i });
      fireEvent.click(button);
      
      // Verify dropdown is open
      expect(screen.getByText('系统变量')).toBeInTheDocument();
      
      // Click a variable
      const weekRangeVariable = screen.getByText('{{本周日期范围}}');
      fireEvent.click(weekRangeVariable);
      
      // Dropdown should close (variables no longer visible)
      expect(screen.queryByText('系统变量')).not.toBeInTheDocument();
    });
  });
});
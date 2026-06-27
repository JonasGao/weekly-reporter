import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewReportPage from './page';

// Mock next/navigation
const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock MilkdownEditor to avoid complex rendering
vi.mock('@/components/editor/MilkdownEditor', () => ({
  MilkdownEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="milkdown-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Mock CheckPanel
vi.mock('@/components/CheckPanel', () => ({
  CheckPanel: () => <div data-testid="check-panel">Check Panel</div>,
}));

// Mock ScorePanel
vi.mock('@/components/ScorePanel', () => ({
  ScorePanel: ({ onConfirm }: { onConfirm: () => void }) => (
    <button data-testid="score-panel-confirm" onClick={onConfirm}>
      Confirm
    </button>
  ),
}));

// Mock TemplateSelect
vi.mock('@/components/TemplateSelect', () => ({
  TemplateSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="template-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select template</option>
      <option value="official-1">Official Template 1</option>
      <option value="user-1">User Template 1</option>
    </select>
  ),
}));

describe('NewReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock for templates API
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/templates') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            official: [{ id: 'official-1', name: 'Official Template', content: 'Template content' }],
            user: [],
          }),
        });
      }
      if (url.includes('/api/templates/') && url.includes('/render')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            content: 'Rendered content',
            templateId: 'official-1',
          }),
        });
      }
      if (url === '/api/reports') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Unknown' }) });
    });
  });

  describe('VariableToolbar Integration', () => {
    it('should render VariableToolbar in the editor section', async () => {
      render(<NewReportPage />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /插入变量/i })).toBeInTheDocument();
      });
    });

    it('should insert variable when VariableToolbar button is clicked', async () => {
      render(<NewReportPage />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /插入变量/i })).toBeInTheDocument();
      });
      
      // Open dropdown
      const toolbarButton = screen.getByRole('button', { name: /插入变量/i });
      fireEvent.click(toolbarButton);
      
      // Click a variable
      const weekRangeVariable = screen.getByText('{{本周日期范围}}');
      fireEvent.click(weekRangeVariable);
      
      // Check toast was called
      const { toast } = await import('sonner');
      expect(toast.success).toHaveBeenCalledWith('已插入变量：{{本周日期范围}}');
      
      // Check editor content was updated
      const editor = screen.getByTestId('milkdown-editor');
      expect(editor.value).toContain('{{本周日期范围}}');
    });
  });

  describe('Template Selection', () => {
    it('should call render API when template is changed', async () => {
      render(<NewReportPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('template-select')).toBeInTheDocument();
      });
      
      // Change template
      const select = screen.getByTestId('template-select');
      fireEvent.change(select, { target: { value: 'user-1' } });
      
      await waitFor(() => {
        // Check that render API was called
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/templates/user-1/render')
        );
      });
    });
  });

  describe('Editor Key Refresh', () => {
    it('should update editorKey after inserting variable', async () => {
      render(<NewReportPage />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /插入变量/i })).toBeInTheDocument();
      });
      
      // Open dropdown and click variable
      const toolbarButton = screen.getByRole('button', { name: /插入变量/i });
      fireEvent.click(toolbarButton);
      const weekRangeVariable = screen.getByText('{{本周日期范围}}');
      fireEvent.click(weekRangeVariable);
      
      // Editor should be re-rendered with updated content
      const editor = screen.getByTestId('milkdown-editor');
      expect(editor.value).toContain('{{本周日期范围}}');
    });
  });
});
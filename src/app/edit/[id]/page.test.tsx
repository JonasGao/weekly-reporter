import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditReportPage from './page';

// Mock next/navigation
const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
};
const mockParams = {
  id: '1',
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => mockParams,
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

describe('EditReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock for reports API
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/reports/1') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 1,
            title: 'Test Report',
            content: 'Initial content',
            weekStart: '2024-01-01',
            weekEnd: '2024-01-07',
          }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Unknown' }) });
    });
  });

  describe('VariableToolbar Integration', () => {
    it('should render VariableToolbar in the editor section', async () => {
      render(<EditReportPage />);
      
      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '编辑周报' })).toBeInTheDocument();
      });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /插入变量/i })).toBeInTheDocument();
      });
    });

    it('should insert variable when VariableToolbar button is clicked', async () => {
      render(<EditReportPage />);
      
      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '编辑周报' })).toBeInTheDocument();
      });
      
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

  describe('Editor Key Refresh', () => {
    it('should update editorKey after inserting variable', async () => {
      render(<EditReportPage />);
      
      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '编辑周报' })).toBeInTheDocument();
      });
      
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

  describe('Page Loading', () => {
    it('should show loading state initially', () => {
      render(<EditReportPage />);
      
      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('should load report data after fetch', async () => {
      render(<EditReportPage />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Report')).toBeInTheDocument();
      });
      
      expect(screen.getByTestId('milkdown-editor')).toHaveValue('Initial content');
    });
  });
});
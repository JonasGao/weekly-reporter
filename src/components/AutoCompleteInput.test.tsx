import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { AutoCompleteInput } from './AutoCompleteInput'

// Wrapper component for controlled input testing
function ControlledAutoComplete(props: Omit<React.ComponentProps<typeof AutoCompleteInput>, 'value' | 'onChange'>) {
  const [value, setValue] = useState('')
  return <AutoCompleteInput {...props} value={value} onChange={setValue} />
}

describe('AutoCompleteInput', () => {
  const mockSuggestions = ['apple', 'banana', 'cherry', 'date']

  it('should render input with placeholder', () => {
    render(
      <AutoCompleteInput
        value=""
        onChange={() => {}}
        suggestions={mockSuggestions}
        placeholder="Select fruits"
      />
    )

    expect(screen.getByPlaceholderText('Select fruits')).toBeInTheDocument()
  })

  it('should show dropdown when typing', async () => {
    const user = userEvent.setup()

    render(
      <ControlledAutoComplete suggestions={mockSuggestions} />
    )

    const input = screen.getByRole('textbox')
    await user.type(input, 'a')

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeInTheDocument()
      expect(screen.getByText('banana')).toBeInTheDocument()
    })
  })

  it('should filter suggestions based on input', async () => {
    const user = userEvent.setup()

    render(
      <AutoCompleteInput
        value="ba"
        onChange={() => {}}
        suggestions={mockSuggestions}
      />
    )

    const input = screen.getByRole('textbox')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('banana')).toBeInTheDocument()
      expect(screen.queryByText('apple')).not.toBeInTheDocument()
    })
  })

  it('should call onChange when typing', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <AutoCompleteInput
        value=""
        onChange={handleChange}
        suggestions={mockSuggestions}
      />
    )

    const input = screen.getByRole('textbox')
    await user.type(input, 'a')

    expect(handleChange).toHaveBeenCalledWith('a')
  })

  it('should call onSelect when item clicked', async () => {
    const user = userEvent.setup()
    const handleSelect = vi.fn()

    render(
      <AutoCompleteInput
        value="a"
        onChange={() => {}}
        suggestions={mockSuggestions}
        onSelect={handleSelect}
      />
    )

    const input = screen.getByRole('textbox')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeInTheDocument()
    })

    await user.click(screen.getByText('apple'))

    expect(handleSelect).toHaveBeenCalledWith('apple')
  })

  it('should handle comma-separated values', async () => {
    const user = userEvent.setup()

    render(
      <AutoCompleteInput
        value="apple, "
        onChange={() => {}}
        suggestions={mockSuggestions}
      />
    )

    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.type(input, 'b')

    await waitFor(() => {
      expect(screen.getByText('banana')).toBeInTheDocument()
      // apple should be filtered out since it's already in the value
      expect(screen.queryByText('apple')).not.toBeInTheDocument()
    })
  })

  it('should support create option when allowCreate is true', async () => {
    const user = userEvent.setup()

    render(
      <AutoCompleteInput
        value="newfr"
        onChange={() => {}}
        suggestions={mockSuggestions}
        allowCreate
        createLabel={(text) => `+ Create "${text}"`}
      />
    )

    const input = screen.getByRole('textbox')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('+ Create "newfr"')).toBeInTheDocument()
    })
  })

  it('should not show create option when exact match exists', async () => {
    const user = userEvent.setup()

    render(
      <AutoCompleteInput
        value="apple"
        onChange={() => {}}
        suggestions={mockSuggestions}
        allowCreate
      />
    )

    const input = screen.getByRole('textbox')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeInTheDocument()
      expect(screen.queryByText(/\+ Create/)).not.toBeInTheDocument()
    })
  })

  it('should close dropdown on Escape', async () => {
    const user = userEvent.setup()

    render(
      <AutoCompleteInput
        value="a"
        onChange={() => {}}
        suggestions={mockSuggestions}
      />
    )

    const input = screen.getByRole('textbox')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeInTheDocument()
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText('apple')).not.toBeInTheDocument()
    })
  })

  it('should support custom renderItem', async () => {
    const user = userEvent.setup()

    render(
      <AutoCompleteInput
        value="a"
        onChange={() => {}}
        suggestions={mockSuggestions}
        renderItem={(item) => <span data-testid={`custom-${item}`}>🍎 {item}</span>}
      />
    )

    const input = screen.getByRole('textbox')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByTestId('custom-apple')).toHaveTextContent('🍎 apple')
    })
  })

  it('should respect disabled state', () => {
    render(
      <AutoCompleteInput
        value=""
        onChange={() => {}}
        suggestions={mockSuggestions}
        disabled
      />
    )

    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
  })
})

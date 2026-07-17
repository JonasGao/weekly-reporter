import { render, screen, fireEvent } from '@testing-library/react'
import { TagInput } from './TagInput'
import { describe, it, expect, vi } from 'vitest'

describe('TagInput', () => {
  it('renders with empty value', () => {
    const onChange = vi.fn()
    render(<TagInput value={[]} onChange={onChange} />)

    const input = screen.getByPlaceholderText('输入后按 Enter 添加')
    expect(input).toBeInTheDocument()
  })

  it('renders existing tags', () => {
    const onChange = vi.fn()
    render(<TagInput value={['tag1', 'tag2']} onChange={onChange} />)

    expect(screen.getByText('tag1')).toBeInTheDocument()
    expect(screen.getByText('tag2')).toBeInTheDocument()
  })

  it('adds tag on Enter key', () => {
    const onChange = vi.fn()
    render(<TagInput value={[]} onChange={onChange} />)

    const input = screen.getByPlaceholderText('输入后按 Enter 添加')
    fireEvent.change(input, { target: { value: 'new-tag' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['new-tag'])
  })

  it('trims whitespace before adding tag', () => {
    const onChange = vi.fn()
    render(<TagInput value={[]} onChange={onChange} />)

    const input = screen.getByPlaceholderText('输入后按 Enter 添加')
    fireEvent.change(input, { target: { value: '  new-tag  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['new-tag'])
  })

  it('prevents duplicate tags', () => {
    const onChange = vi.fn()
    render(<TagInput value={['existing']} onChange={onChange} />)

    const input = screen.getByPlaceholderText('输入后按 Enter 添加')
    fireEvent.change(input, { target: { value: 'existing' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not add empty tag', () => {
    const onChange = vi.fn()
    render(<TagInput value={[]} onChange={onChange} />)

    const input = screen.getByPlaceholderText('输入后按 Enter 添加')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes tag when delete button is clicked', () => {
    const onChange = vi.fn()
    render(<TagInput value={['tag1', 'tag2']} onChange={onChange} />)

    const deleteButtons = screen.getAllByRole('button')
    fireEvent.click(deleteButtons[0]) // Click first delete button

    expect(onChange).toHaveBeenCalledWith(['tag2'])
  })

  it('clears input after adding tag', () => {
    const onChange = vi.fn()
    render(<TagInput value={[]} onChange={onChange} />)

    const input = screen.getByPlaceholderText('输入后按 Enter 添加') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'new-tag' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(input.value).toBe('')
  })

  it('uses custom placeholder', () => {
    const onChange = vi.fn()
    render(<TagInput value={[]} onChange={onChange} placeholder="自定义提示" />)

    expect(screen.getByPlaceholderText('自定义提示')).toBeInTheDocument()
  })
})

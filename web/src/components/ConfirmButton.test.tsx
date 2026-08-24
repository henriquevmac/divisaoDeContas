import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ConfirmButton } from './ConfirmButton'

describe('ConfirmButton', () => {
  it('shows the idle label first', () => {
    render(<ConfirmButton label="Delete receipt" confirmLabel="Really delete?" onConfirm={() => {}} />)
    expect(screen.getByRole('button', { name: 'Delete receipt' })).toBeInTheDocument()
  })

  it('does not act on the first press', () => {
    const onConfirm = vi.fn()
    render(<ConfirmButton label="Delete receipt" confirmLabel="Really delete?" onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete receipt' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('asks for confirmation on the first press', () => {
    render(<ConfirmButton label="Delete receipt" confirmLabel="Really delete?" onConfirm={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete receipt' }))
    expect(screen.getByRole('button', { name: 'Really delete?' })).toBeInTheDocument()
  })

  it('acts on the second press', () => {
    const onConfirm = vi.fn()
    render(<ConfirmButton label="Delete receipt" confirmLabel="Really delete?" onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete receipt' }))
    fireEvent.click(screen.getByRole('button', { name: 'Really delete?' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('backs out via Cancel without acting', () => {
    const onConfirm = vi.fn()
    render(<ConfirmButton label="Delete receipt" confirmLabel="Really delete?" onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete receipt' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete receipt' })).toBeInTheDocument()
  })

  it('cannot be pressed while pending', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmButton
        label="Delete receipt"
        confirmLabel="Really delete?"
        pending
        onConfirm={onConfirm}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /deleting|delete receipt/i }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

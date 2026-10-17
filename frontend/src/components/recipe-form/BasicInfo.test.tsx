import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BasicInfo } from './BasicInfo'
import { RecipeFormProvider, useRecipeForm } from './RecipeFormContext'
import type { RecipeCreate } from '@/types/api'

vi.stubGlobal('fetch', vi.fn())

const StateInspector = () => {
  const { formData, handleInputChange, saveDraft, restoreDraft } = useRecipeForm()
  return (
    <div>
      <span data-testid="servings-state">{String(formData.servings)}</span>
      <span data-testid="prep-state">{String(formData.prep_time_mins)}</span>
      <span data-testid="prep-is-positive-zero">{String(Object.is(formData.prep_time_mins, 0))}</span>
      <span data-testid="prep-type">{typeof formData.prep_time_mins}</span>
      <span data-testid="cook-state">{String(formData.cook_time_mins)}</span>
      <span data-testid="cook-type">{typeof formData.cook_time_mins}</span>
      <button
        type="button"
        onClick={() => {
          const prepEl = document.getElementById('prep_time_mins') as HTMLInputElement
          const targetProxy = new Proxy(prepEl, {
            get(target, prop) {
              if (prop === 'value') return ' 45 '
              return Reflect.get(target, prop)
            },
            set(target, prop, val) {
              return Reflect.set(target, prop, val)
            }
          })
          handleInputChange({
            target: targetProxy
          } as React.ChangeEvent<HTMLInputElement>)
        }}
      >
        Paste Whitespace 45
      </button>
      <button
        type="button"
        onClick={() => {
          const prepEl = document.getElementById('prep_time_mins') as HTMLInputElement
          const targetProxy = new Proxy(prepEl, {
            get(target, prop) {
              if (prop === 'value') return 'Infinity'
              return Reflect.get(target, prop)
            },
            set(target, prop, val) {
              return Reflect.set(target, prop, val)
            }
          })
          handleInputChange({
            target: targetProxy
          } as React.ChangeEvent<HTMLInputElement>)
        }}
      >
        Input Infinity
      </button>
      <button type="button" onClick={saveDraft}>Save Draft</button>
      <button type="button" onClick={restoreDraft}>Restore Draft</button>
    </div>
  )
}

const renderBasicInfo = async (initialData?: Partial<RecipeCreate>) => {
  const utils = render(
    <RecipeFormProvider initialData={initialData} loading={false}>
      <BasicInfo />
      <StateInspector />
    </RecipeFormProvider>
  )
  await screen.findByLabelText(/Prep Time \(mins\)/i)
  await vi.waitFor(() => {
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  return utils
}

describe('BasicInfo Numeric Time Inputs (Issue #3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => []
    })
  })

  it('overwrites default 0 when typing digits sequentially (both userEvent and DOM 01/015 events)', async () => {
    const user = userEvent.setup()
    await renderBasicInfo()

    const prepInput = screen.getByLabelText(/Prep Time \(mins\)/i) as HTMLInputElement
    const cookInput = screen.getByLabelText(/Cook Time \(mins\)/i) as HTMLInputElement

    expect(prepInput.value).toBe('0')
    expect(cookInput.value).toBe('0')

    // 1. Browser DOM '01' -> '1', then '15' -> '15'
    fireEvent.change(prepInput, { target: { value: '01' } })
    expect(prepInput.value).toBe('1')
    expect(screen.getByTestId('prep-state').textContent).toBe('1')

    await user.type(prepInput, '5')
    expect(prepInput.value).toBe('15')
    expect(screen.getByTestId('prep-state').textContent).toBe('15')

    // 2. Sequential user.type on cookInput from default '0'
    fireEvent.change(cookInput, { target: { value: '01' } })
    expect(cookInput.value).toBe('1')
    await user.type(cookInput, '00')
    expect(cookInput.value).toBe('100')
    expect(screen.getByTestId('cook-state').textContent).toBe('100')
  })

  it('safely defaults back to 0 when cleared to empty string without NaN', async () => {
    await renderBasicInfo({ prep_time_mins: 15, cook_time_mins: 30 })

    const prepInput = screen.getByLabelText(/Prep Time \(mins\)/i) as HTMLInputElement
    fireEvent.change(prepInput, { target: { value: '' } })

    expect(prepInput.value).toBe('0')
    expect(screen.getByTestId('prep-state').textContent).toBe('0')
    expect(screen.getByTestId('prep-type').textContent).toBe('number')
    expect(screen.getByTestId('prep-is-positive-zero').textContent).toBe('true')
  })

  it('sanitizes non-numeric, negative, -0.1, and Infinity inputs safely back to +0', async () => {
    await renderBasicInfo({ prep_time_mins: 20 })

    const prepInput = screen.getByLabelText(/Prep Time \(mins\)/i) as HTMLInputElement

    fireEvent.change(prepInput, { target: { value: '-10' } })
    expect(prepInput.value).toBe('0')
    expect(screen.getByTestId('prep-state').textContent).toBe('0')

    fireEvent.change(prepInput, { target: { value: '-0.1' } })
    expect(prepInput.value).toBe('0')
    expect(screen.getByTestId('prep-state').textContent).toBe('0')
    expect(screen.getByTestId('prep-is-positive-zero').textContent).toBe('true')

    fireEvent.change(prepInput, { target: { value: 'abc' } })
    expect(prepInput.value).toBe('0')
    expect(screen.getByTestId('prep-state').textContent).toBe('0')

    fireEvent.change(prepInput, { target: { value: '--' } })
    expect(prepInput.value).toBe('0')
    expect(screen.getByTestId('prep-state').textContent).toBe('0')

    fireEvent.change(prepInput, { target: { value: '25' } })
    expect(prepInput.value).toBe('25')
    fireEvent.click(screen.getByRole('button', { name: /Input Infinity/i }))
    expect(prepInput.value).toBe('0')
    expect(screen.getByTestId('prep-state').textContent).toBe('0')
  })

  it('keeps single 0 (not 00) when user explicitly types 0 into default 0 field', async () => {
    await renderBasicInfo()

    const prepInput = screen.getByLabelText(/Prep Time \(mins\)/i) as HTMLInputElement
    expect(prepInput.value).toBe('0')

    fireEvent.change(prepInput, { target: { value: '00' } })
    expect(prepInput.value).toBe('0')
    expect(screen.getByTestId('prep-state').textContent).toBe('0')
  })

  it('preserves existing non-zero values when appending digits (25 -> 253)', async () => {
    const user = userEvent.setup()
    await renderBasicInfo({ prep_time_mins: 25 })

    const prepInput = screen.getByLabelText(/Prep Time \(mins\)/i) as HTMLInputElement
    expect(prepInput.value).toBe('25')

    await user.type(prepInput, '3')
    expect(prepInput.value).toBe('253')
    expect(screen.getByTestId('prep-state').textContent).toBe('253')
  })

  it('handles whitespace on the real input element and rounds decimal inputs to integer minutes', async () => {
    await renderBasicInfo()

    const prepInput = screen.getByLabelText(/Prep Time \(mins\)/i) as HTMLInputElement

    fireEvent.click(screen.getByRole('button', { name: /Paste Whitespace 45/i }))
    expect(prepInput.value).toBe('45')
    expect(screen.getByTestId('prep-state').textContent).toBe('45')

    fireEvent.change(prepInput, { target: { value: '1.5' } })
    expect(prepInput.value).toBe('2')
    expect(screen.getByTestId('prep-state').textContent).toBe('2')
  })

  it('caps input values at max limit 9999 and sets numeric attributes on Servings, Prep, and Cook inputs', async () => {
    await renderBasicInfo()

    const servingsInput = screen.getByLabelText(/Servings/i) as HTMLInputElement
    const prepInput = screen.getByLabelText(/Prep Time \(mins\)/i) as HTMLInputElement
    const cookInput = screen.getByLabelText(/Cook Time \(mins\)/i) as HTMLInputElement

    expect(servingsInput).toHaveAttribute('min', '1')
    expect(servingsInput).toHaveAttribute('max', '9999')
    expect(servingsInput).toHaveAttribute('inputMode', 'numeric')
    expect(prepInput).toHaveAttribute('min', '0')
    expect(prepInput).toHaveAttribute('max', '9999')
    expect(prepInput).toHaveAttribute('inputMode', 'numeric')
    expect(cookInput).toHaveAttribute('min', '0')
    expect(cookInput).toHaveAttribute('max', '9999')
    expect(cookInput).toHaveAttribute('inputMode', 'numeric')

    fireEvent.change(prepInput, { target: { value: '25000' } })
    expect(prepInput.value).toBe('9999')
    expect(screen.getByTestId('prep-state').textContent).toBe('9999')

    // Clearing servings to '' -> 0 then typing '04' overwrites 0 with 4
    fireEvent.change(servingsInput, { target: { value: '' } })
    expect(servingsInput.value).toBe('0')
    fireEvent.change(servingsInput, { target: { value: '04' } })
    expect(servingsInput.value).toBe('4')
    expect(screen.getByTestId('servings-state').textContent).toBe('4')
  })

  it('preserves integer types when saving and restoring draft from localStorage', async () => {
    const user = userEvent.setup()
    await renderBasicInfo()

    const prepInput = screen.getByLabelText(/Prep Time \(mins\)/i) as HTMLInputElement
    await user.type(prepInput, '35')
    expect(screen.getByTestId('prep-state').textContent).toBe('35')
    expect(screen.getByTestId('prep-type').textContent).toBe('number')

    fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }))
    fireEvent.change(prepInput, { target: { value: '0' } })
    expect(screen.getByTestId('prep-state').textContent).toBe('0')

    fireEvent.click(screen.getByRole('button', { name: /Restore Draft/i }))
    expect(screen.getByTestId('prep-state').textContent).toBe('35')
    expect(screen.getByTestId('prep-type').textContent).toBe('number')
    expect(prepInput.value).toBe('35')
  })
})

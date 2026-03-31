export const CURRENCY_CODE = 'GHS'
export const CURRENCY_SYMBOL = 'GH₵'

export function formatCurrency(amount: number): string {
  return `${CURRENCY_SYMBOL} ${amount.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function formatCurrencyCompact(amount: number): string {
  if (amount >= 1_000_000) {
    return `${CURRENCY_SYMBOL} ${(amount / 1_000_000).toFixed(1)}M`
  }
  if (amount >= 1_000) {
    return `${CURRENCY_SYMBOL} ${(amount / 1_000).toFixed(amount % 1_000 === 0 ? 0 : 1)}K`
  }
  return formatCurrency(amount)
}

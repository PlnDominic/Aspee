/**
 * Formats a number into a localized currency string.
 * @param amount The numerical value to format
 * @param currencyCode 'GHS' or 'USD' (Defaults to 'GHS')
 * @returns Formatted string (e.g., "GH₵ 1,234.56" or "$ 1,234.56")
 */
export const formatCurrency = (amount: number | string, currencyCode: string = 'GHS'): string => {
    const numValue = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Fallback for invalid numbers
    if (isNaN(numValue)) return `${currencyCode === 'USD' ? '$' : 'GH₵'} 0.00`;

    if (currencyCode === 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(numValue);
    }

    // Default to GHS
    // Intl.NumberFormat for GHS sometimes yields 'GHS' instead of the cedi symbol depending on the environment, 
    // so we manually prefix for consistency.
    const formatted = new Intl.NumberFormat('en-GH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numValue);
    
    return `GH₵ ${formatted}`;
};

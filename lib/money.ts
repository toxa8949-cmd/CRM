export const TAX_RATE = Number(process.env.TAX_RATE ?? '0.03')
export function money(value: unknown): string { return `${Number(value ?? 0).toFixed(2)} zł` }
export function calcTax(total: number): number { return Number((total * TAX_RATE).toFixed(2)) }

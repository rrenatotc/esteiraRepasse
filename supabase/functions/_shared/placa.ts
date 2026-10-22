// Cópia de src/shared/placa.ts para as Edge Functions (Deno não enxerga
// src/). Um teste garante que as duas batem.

const RE_ANTIGA = /^[A-Z]{3}[0-9]{4}$/
const RE_MERCOSUL = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/

export function placaParaMercosul(entrada: string): string | null {
  const placa = entrada.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (RE_MERCOSUL.test(placa)) return placa
  if (!RE_ANTIGA.test(placa)) return null
  return placa.slice(0, 4) + 'ABCDEFGHIJ'[Number(placa[4])] + placa.slice(5)
}

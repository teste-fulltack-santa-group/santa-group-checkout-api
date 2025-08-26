export function evaluateCardRisk(input: {
  amountCents: number;
  cpf: string;
  email: string;
  last4: string;
  brand: string;
}) {
  if (!/^\d{11}$/.test(input.cpf)) return { decision: "DECLINED", reason: "CPF inválido" };
  if (input.amountCents > 500_000) return { decision: "DECLINED", reason: "Ticket muito alto" };
  if (/@temporarymail\./i.test(input.email)) return { decision: "DECLINED", reason: "Email descartável" };
  if (["0000", "1234"].includes(input.last4)) return { decision: "DECLINED", reason: "Last4 suspeito" };
  return { decision: "APPROVED", reason: "OK" } as const;
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// O fuso precisa valer antes de qualquer Date: o app roda no Brasil (UTC−3).
process.env.TZ = "America/Sao_Paulo";
const { paraCSV } = await import("../src/resumo.js");

function sessaoNoturna() {
  const n = 12;
  return {
    id: "s_noite",
    // 22:00 de 15/10 em São Paulo.
    inicio: "2026-10-16T01:00:00.000Z",
    treino: "T1",
    vo2max: 35,
    pesoKg: 80,
    fases: [{ tipo: "bloco", rotulo: "Caminhada", segundos: 60, alvo: { de: 50, ate: 60 } }],
    amostras: { passo: 5, v: Array(n).fill(5), i: Array(n).fill(5), fc: Array(n).fill(null), f: Array(n).fill(0) },
  };
}

describe("CSV no fuso local", () => {
  it("treino à noite sai com a data do dia em que foi feito", () => {
    const [, linha] = paraCSV([sessaoNoturna()]).trim().split("\n");
    assert.ok(linha.startsWith("2026-10-15,T1,"), linha);
  });
});

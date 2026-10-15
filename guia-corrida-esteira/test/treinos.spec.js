import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLANO, TREINOS, montarFases, duracaoTotal, normalizarAlvo, semanaDoPlano, proximaSessao, modoDoTreino } from "../src/treinos.js";

describe("plano de 8 semanas", () => {
  it("tem 8 semanas, ids únicos e só treinos conhecidos", () => {
    assert.equal(PLANO.length, 8);
    const ids = PLANO.flatMap((s) => s.sessoes.map((x) => x.id));
    assert.equal(new Set(ids).size, ids.length);
    for (const s of PLANO.flatMap((w) => w.sessoes)) assert.ok(TREINOS[s.treino], s.id);
  });

  it("tem o teste T7 nas semanas 1, 4 e 8", () => {
    const comT7 = PLANO.filter((w) => w.sessoes.some((s) => s.treino === "T7")).map((w) => w.semana);
    assert.deepEqual(comT7, [1, 4, 8]);
  });

  it("monta fases para toda sessão do plano e para as alternativas", () => {
    for (const s of PLANO.flatMap((w) => w.sessoes)) {
      assert.ok(duracaoTotal(montarFases(s)) > 0, s.id);
      if (s.alternativa) assert.ok(duracaoTotal(montarFases(s.alternativa)) > 0, `${s.id} alt`);
    }
  });
});

describe("fases de cada treino", () => {
  it("T1: aquecimento, bloco com alvo e volta à calma", () => {
    const f = montarFases({ treino: "T1", minutos: 30, alvo: 55 });
    assert.deepEqual(f.map((x) => x.tipo), ["aquecimento", "bloco", "volta"]);
    assert.deepEqual(f[1].alvo, { de: 52, ate: 58 });
    assert.equal(duracaoTotal(f), 40 * 60);
  });

  it("T3 até 70%: 9 degraus de 3 min, 50→70→50", () => {
    const degraus = montarFases({ treino: "T3", topo: 70 }).filter((x) => x.tipo === "bloco");
    assert.deepEqual(degraus.map((d) => d.alvo.de + 2.5), [50, 55, 60, 65, 70, 65, 60, 55, 50]);
    assert.ok(degraus.every((d) => d.segundos === 180));
  });

  it("T3 com duas pirâmides não repete o degrau de 50% no meio", () => {
    const degraus = montarFases({ treino: "T3", topo: 70, repeticoes: 2 }).filter((x) => x.tipo === "bloco");
    assert.equal(degraus.length, 17);
    assert.equal(duracaoTotal(degraus), 51 * 60);
  });

  it("T4 nível 2: 8 tiros acima de 85% e 7 recuperações", () => {
    const f = montarFases({ treino: "T4", nivel: 2 });
    assert.equal(f.filter((x) => x.tipo === "tiro").length, 8);
    assert.equal(f.filter((x) => x.tipo === "recuperacao").length, 7);
    assert.ok(f.filter((x) => x.tipo === "tiro").every((x) => x.alvo.de === 85 && x.segundos === 60));
  });

  it("T7: 4 min a 0%, 4 min a 5% com coleta de FC nos minutos 3 e 4", () => {
    const f = montarFases({ treino: "T7" });
    assert.deepEqual(f.slice(0, 2).map((x) => [x.inclinacaoFixa, x.segundos]), [[0, 240], [5, 240]]);
    assert.deepEqual(f[1].coletarFc, [180, 240]);
  });

  it("devolve cópias: mexer numa sessão não altera a próxima", () => {
    const a = montarFases({ treino: "T1", minutos: 20, alvo: 50 });
    a[0].segundos = 1;
    assert.equal(montarFases({ treino: "T1", minutos: 20, alvo: 50 })[0].segundos, 300);
  });

  it("rejeita treino desconhecido", () => {
    assert.throws(() => montarFases({ treino: "T9" }), RangeError);
  });
});

describe("caminhada ou corrida", () => {
  it("cada treino diz qual equação usar", () => {
    assert.deepEqual(["T1", "T2", "T3", "T4", "T5", "T6", "T7"].map(modoDoTreino),
      ["caminhada", "corrida", "caminhada", "auto", "corrida", "caminhada", "caminhada"]);
    assert.equal(modoDoTreino("T9"), "auto");
  });
});

describe("calendário", () => {
  it("normaliza alvo numérico e faixa", () => {
    assert.deepEqual(normalizarAlvo(60), { de: 57, ate: 63 });
    assert.deepEqual(normalizarAlvo([50, 55]), { de: 50, ate: 55 });
    assert.equal(normalizarAlvo(undefined), null);
  });

  it("conta a semana do plano a partir do início, entre 1 e 8", () => {
    assert.equal(semanaDoPlano("2026-10-05", "2026-10-05"), 1);
    assert.equal(semanaDoPlano("2026-10-05", "2026-10-11"), 1);
    assert.equal(semanaDoPlano("2026-10-05", "2026-10-12"), 2);
    assert.equal(semanaDoPlano("2026-10-05", "2027-01-01"), 8);
    assert.equal(semanaDoPlano("2026-10-05", "2026-09-01"), 1);
  });

  it("sugere a próxima sessão obrigatória não feita", () => {
    assert.equal(proximaSessao(5, ["5A"]).id, "5B");
    assert.equal(proximaSessao(5, ["5A", "5B", "5C"]), null);
  });
});

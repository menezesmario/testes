import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as calc from "../src/calculadora.js";

const perto = (atual, esperado, tol = 0.05) =>
  assert.ok(Math.abs(atual - esperado) <= tol, `${atual} != ${esperado}`);

describe("frequência cardíaca", () => {
  it("estima a FC máxima pela fórmula de Tanaka", () => {
    assert.equal(calc.fcMaxEstimada(40), 180);
  });

  it("monta zonas por % da FC máxima quando não há FC de repouso", () => {
    const z = calc.zonasFC({ fcMax: 180 });
    assert.equal(z.length, 5);
    assert.deepEqual([z[1].min, z[1].max], [108, 126]);
    assert.equal(z[4].max, 180);
  });

  it("usa Karvonen quando a FC de repouso é informada", () => {
    const z = calc.zonasFC({ fcMax: 180, fcRepouso: 60 });
    assert.deepEqual([z[1].min, z[1].max], [132, 144]);
  });

  it("rejeita FC de repouso maior que a máxima", () => {
    assert.throws(() => calc.zonasFC({ fcMax: 150, fcRepouso: 160 }), RangeError);
  });
});

describe("custo de O2 na esteira (ACSM)", () => {
  it("caminhada no plano a 6 km/h", () => {
    perto(calc.vo2Esteira({ velocidadeKmh: 6, modo: "caminhada" }), 13.5);
  });

  it("caminhada 12-3-30 (4,8 km/h a 12%)", () => {
    perto(calc.vo2Esteira({ velocidadeKmh: 4.8, inclinacaoPct: 12 }), 28.78);
  });

  it("corrida a 10 km/h a 1%", () => {
    perto(calc.vo2Esteira({ velocidadeKmh: 10, inclinacaoPct: 1 }), 38.33);
  });

  it("escolhe a equação pela velocidade no modo automático", () => {
    const lenta = calc.vo2Esteira({ velocidadeKmh: 6 });
    const forcada = calc.vo2Esteira({ velocidadeKmh: 6, modo: "corrida" });
    assert.ok(forcada > lenta);
  });

  it("rejeita inclinação negativa e modo desconhecido", () => {
    assert.throws(() => calc.vo2Esteira({ velocidadeKmh: 5, inclinacaoPct: -1 }), RangeError);
    assert.throws(() => calc.vo2Esteira({ velocidadeKmh: 5, modo: "trote" }), RangeError);
  });
});

describe("números dos vídeos de referência", () => {
  // Painel da esteira no vídeo 1: 5 km/h = 3,4 METs; 5 km/h a 5% = 5,6 METs
  it("bate com o painel da esteira", () => {
    perto(calc.mets(calc.vo2Esteira({ velocidadeKmh: 5 })), 3.4, 0.05);
    perto(calc.mets(calc.vo2Esteira({ velocidadeKmh: 5, inclinacaoPct: 5 })), 5.6, 0.1);
  });

  it("monta as faixas de 50–70% e 85% (vídeo 2, VO2máx de 15 METs)", () => {
    const p = calc.prescricaoVO2(15 * calc.ML_POR_MET);
    perto(p.continuo.min, 7.5);
    perto(p.continuo.max, 10.5);
    perto(p.intervalado.min, 12.75);
  });
});

describe("prescrição pelo VO2máx", () => {
  it("acha a inclinação que leva a caminhada ao alvo de METs", () => {
    const inc = calc.inclinacaoParaMets({ velocidadeKmh: 5, mets: 7 });
    perto(inc, 8.44, 0.01);
    perto(calc.mets(calc.vo2Esteira({ velocidadeKmh: 5, inclinacaoPct: inc })), 7, 1e-9);
  });

  it("acha a velocidade de corrida para o alvo de METs", () => {
    const v = calc.velocidadeParaMets({ mets: 12, inclinacaoPct: 1 });
    perto(calc.mets(calc.vo2Esteira({ velocidadeKmh: v, inclinacaoPct: 1 })), 12, 1e-9);
  });

  it("estima o VO2máx pelo teste de Ebbeling", () => {
    // 3,5 mph, FC 130, 40 anos, homem -> ~44,3 ml/kg/min
    const vo2 = calc.vo2maxEbbeling({ velocidadeKmh: 3.5 * 1.609344, fcFinal: 130, idade: 40, sexo: "m" });
    perto(vo2, 44.26, 0.05);
  });

  it("recusa velocidades fora do protocolo de Ebbeling", () => {
    assert.throws(
      () => calc.vo2maxEbbeling({ velocidadeKmh: 9, fcFinal: 130, idade: 40, sexo: "m" }),
      RangeError,
    );
  });

  it("estima o VO2máx pela razão de FC (Uth)", () => {
    perto(calc.vo2maxUth({ fcMax: 180, fcRepouso: 60 }), 45.9);
  });
});

describe("conversões", () => {
  it("devolve a velocidade da corrida no plano com o mesmo VO2", () => {
    perto(calc.velocidadeEquivalentePlano(calc.vo2Esteira({ velocidadeKmh: 10 })), 10);
  });

  it("calcula METs e kcal por minuto", () => {
    perto(calc.mets(35), 10);
    perto(calc.kcalPorMinuto({ vo2: 35, pesoKg: 80 }), 14);
  });

  it("formata o ritmo em min/km", () => {
    assert.equal(calc.ritmo(10), "6:00/km");
    assert.equal(calc.ritmo(12), "5:00/km");
    assert.equal(calc.ritmo(4.8), "12:30/km");
  });
});

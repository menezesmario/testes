import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resumirSessao, minutosPorZona, serieSemanal, historicoVO2, paraCSV, inicioDaSemana } from "../src/resumo.js";
import { vo2Esteira } from "../src/calculadora.js";

// 10 min a 5 km/h e 10%, amostras de 5 s, fase única com alvo 60–75% de um VO2máx de 38.
function sessaoExemplo(extra = {}) {
  const n = 120;
  return {
    id: "s1",
    inicio: "2026-10-14T10:00:00.000Z",
    treino: "T1",
    vo2max: 38,
    pesoKg: 80,
    fcMax: 180,
    fcRepouso: 60,
    fases: [{ tipo: "bloco", rotulo: "Caminhada", segundos: 600, alvo: { de: 60, ate: 75 } }],
    amostras: {
      passo: 5,
      v: Array(n).fill(5),
      i: Array(n).fill(10),
      fc: Array.from({ length: n }, (_, k) => (k < 60 ? null : 140)),
      f: Array(n).fill(0),
    },
    ...extra,
  };
}

describe("resumo de sessão", () => {
  it("calcula duração, distância, subida, METs e kcal", () => {
    const r = resumirSessao(sessaoExemplo());
    assert.equal(r.duracaoS, 600);
    assert.ok(Math.abs(r.distanciaKm - 5 / 6) < 1e-9);
    assert.ok(Math.abs(r.subidaM - 83.333) < 0.01);
    const vo2 = vo2Esteira({ velocidadeKmh: 5, inclinacaoPct: 10 });
    assert.ok(Math.abs(r.metsMedio - vo2 / 3.5) < 1e-9);
    assert.ok(Math.abs(r.kcal - (vo2 * 80 * 5) / 1000 * 10) < 1e-6);
  });

  it("conta o tempo dentro da faixa-alvo", () => {
    // 5 km/h a 10% ≈ 26,8 ml/kg/min = 70,6% de 38 → dentro de 60–75%
    const r = resumirSessao(sessaoExemplo());
    assert.equal(r.minutosNaFaixa, 10);
    assert.equal(r.acertoFaixa, 1);
  });

  it("ignora amostras paradas e usa só FC registrada", () => {
    const s = sessaoExemplo();
    s.amostras.v[0] = 0;
    const r = resumirSessao(s);
    assert.equal(r.ativoS, 595);
    assert.equal(r.fcMedia, 140);
    assert.ok(r.eficiencia > 0);
  });

  it("no tiro, passar do teto ainda conta como acerto", () => {
    const s = sessaoExemplo({ fases: [{ tipo: "tiro", rotulo: "Tiro", segundos: 600, alvo: { de: 60, ate: 100 } }] });
    s.amostras.v = Array(120).fill(12);
    assert.equal(resumirSessao(s).acertoFaixa, 1);
  });

  it("distribui a FC nas zonas (Karvonen)", () => {
    // 140 bpm com repouso 60 e máx 180 = 66,7% da reserva → Z2
    const z = minutosPorZona(sessaoExemplo());
    assert.deepEqual(z, [0, 5, 0, 0, 0]);
  });
});

describe("equação pelo tipo de treino", () => {
  it("caminhada inclinada a 6,6 km/h continua usando a equação de caminhada", () => {
    const s = sessaoExemplo();
    s.amostras.v = Array(120).fill(6.6);
    const caminhada = vo2Esteira({ velocidadeKmh: 6.6, inclinacaoPct: 10, modo: "caminhada" });
    assert.ok(Math.abs(resumirSessao(s).metsMedio - caminhada / 3.5) < 1e-9);
  });

  it("rodagem (T2) a 6 km/h usa a equação de corrida", () => {
    const s = sessaoExemplo({ treino: "T2" });
    s.amostras.v = Array(120).fill(6);
    s.amostras.i = Array(120).fill(1);
    const corrida = vo2Esteira({ velocidadeKmh: 6, inclinacaoPct: 1, modo: "corrida" });
    assert.ok(Math.abs(resumirSessao(s).metsMedio - corrida / 3.5) < 1e-9);
  });
});

describe("séries do painel", () => {
  it("começa a semana na segunda-feira", () => {
    const d = inicioDaSemana("2026-10-15T12:00:00");
    assert.equal(d.getDay(), 1);
    assert.equal(d.getDate(), 12);
  });

  it("agrupa minutos na faixa por semana", () => {
    const serie = serieSemanal([sessaoExemplo({ inicio: "2026-10-14T10:00:00" })], "2026-10-15T12:00:00", 4);
    assert.equal(serie.length, 4);
    assert.equal(serie[3].minutosNaFaixa, 10);
    assert.equal(serie[3].sessoes, 1);
    assert.equal(serie[0].sessoes, 0);
  });

  it("lista os testes T7 em ordem de data", () => {
    const h = historicoVO2([
      sessaoExemplo({ inicio: "2026-11-02T10:00:00Z", t7: { vo2max: 38, fcFinal: 125, velocidade: 5 } }),
      sessaoExemplo(),
      sessaoExemplo({ inicio: "2026-10-05T10:00:00Z", t7: { vo2max: 35, fcFinal: 130, velocidade: 5 } }),
    ]);
    assert.deepEqual(h.map((x) => x.vo2max), [35, 38]);
    assert.equal(h[0].mets, 10);
  });
});

describe("exportação CSV", () => {
  it("segue as colunas do modelo de registro e escapa as notas", () => {
    const csv = paraCSV([sessaoExemplo({ rpe: 4, notas: 'Calor, "abafado"' })]);
    const [cab, linha] = csv.trim().split("\n");
    assert.ok(cab.startsWith("data,treino,duracao_min,velocidade_kmh,inclinacao_pct,fc_media,fc_max,min_z1"));
    assert.ok(linha.startsWith("2026-10-14,T1,10,5,10,140,140,0,5,0,0,0,,,,,4,"));
    assert.ok(linha.includes('"Calor, ""abafado"""'));
  });
});

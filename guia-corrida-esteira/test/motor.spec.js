import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarSessao, sessaoSalvavel, situacaoPara, sugerirCarga } from "../app/motor.js";
import { vo2Esteira, inclinacaoParaMets, vo2maxEbbeling } from "../src/calculadora.js";
import { resumirSessao } from "../src/resumo.js";

const PERFIL = { idade: 38, sexo: "m", pesoKg: 80, fcRepouso: 60, fcMax: 181, vo2max: 35, velocidadePadrao: 5, velocidadeT7: 4.5 };
const EPOCA = Date.UTC(2026, 9, 15, 9, 0, 0);

// Relógio e agendador falsos: avancar(seg, passoMs) move o tempo e chama o
// tick como um setInterval faria.
function tempoFalso() {
  let t = 0;
  let tick = null;
  return {
    relogio: () => t,
    agora: () => EPOCA + t,
    agendador: (fn) => {
      tick = fn;
      return () => { tick = null; };
    },
    avancar(seg, passoMs = 250) {
      const fim = t + seg * 1000;
      while (t < fim) {
        t = Math.min(fim, t + passoMs);
        tick?.();
      }
    },
  };
}

function novaSessao(sessaoPlano, extra = {}) {
  const tempo = tempoFalso();
  const motor = criarSessao({
    treino: sessaoPlano.treino,
    planoRef: sessaoPlano.id ?? null,
    sessaoPlano,
    perfil: { ...PERFIL, ...extra.perfil },
    relogio: tempo.relogio,
    agora: tempo.agora,
    agendador: tempo.agendador,
  });
  const eventos = [];
  for (const nome of ["fase", "contagem", "pedirFc", "t7", "fim", "situacao", "extensao"]) {
    motor.ao(nome, (dados) => eventos.push({ nome, ...dados }));
  }
  return { motor, tempo, eventos, de: (nome) => eventos.filter((x) => x.nome === nome) };
}

describe("motor: cronômetro e fases", () => {
  it("troca de fase no segundo certo", () => {
    const { motor, tempo, de } = novaSessao({ treino: "T3", topo: 60 });
    motor.iniciar();
    assert.equal(de("fase").length, 1);
    tempo.avancar(299);
    assert.equal(motor.estado.iFase, 0);
    assert.equal(motor.restanteFase, 1);
    tempo.avancar(1);
    assert.equal(motor.estado.iFase, 1);
    assert.equal(motor.estado.segFase, 0);
    assert.equal(de("fase").at(-1).iFase, 1);
    tempo.avancar(180);
    assert.equal(motor.estado.iFase, 2);
    assert.equal(motor.fase.rotulo, "Degrau 55%");
  });

  it("não acumula drift com ticks irregulares", () => {
    const { motor, tempo } = novaSessao({ treino: "T1", minutos: 25, alvo: 50 });
    motor.iniciar();
    tempo.avancar(100, 333);
    assert.equal(motor.estado.segTotal, 100);
    tempo.avancar(50, 1700);
    assert.equal(motor.estado.segTotal, 150);
  });

  it("faz contagem 3-2-1 antes da troca", () => {
    const { motor, tempo, de } = novaSessao({ treino: "T3", topo: 60 });
    motor.iniciar();
    tempo.avancar(300);
    assert.deepEqual(de("contagem").map((c) => c.restante), [3, 2, 1]);
    assert.equal(de("contagem")[0].proxima.rotulo, "Degrau 50%");
  });

  it("termina na última fase e emite fim", () => {
    const { motor, tempo, de } = novaSessao({ treino: "T1", minutos: 1, alvo: 50 });
    motor.iniciar();
    tempo.avancar(300 + 60 + 300 + 10);
    assert.equal(de("fim").length, 1);
    assert.equal(motor.estado.terminado, true);
    assert.equal(motor.estado.rodando, false);
    assert.equal(motor.estado.segTotal, 660);
  });

  it("pausa não conta tempo", () => {
    const { motor, tempo } = novaSessao({ treino: "T1", minutos: 25, alvo: 50 });
    motor.iniciar();
    tempo.avancar(10);
    motor.pausar();
    tempo.avancar(120);
    assert.equal(motor.estado.segTotal, 10);
    assert.equal(motor.estado.amostras.v.length, 2);
    motor.retomar();
    tempo.avancar(5);
    assert.equal(motor.estado.segTotal, 15);
    assert.equal(motor.estado.amostras.v.length, 3);
  });

  it("pula e volta fase", () => {
    const { motor, tempo } = novaSessao({ treino: "T3", topo: 60 });
    motor.iniciar();
    tempo.avancar(20);
    motor.pularFase();
    assert.equal(motor.estado.iFase, 1);
    assert.equal(motor.estado.segFase, 0);
    motor.voltarFase();
    assert.equal(motor.estado.iFase, 0);
    assert.equal(motor.estado.segTotal, 20);
  });
});

describe("motor: amostras", () => {
  it("amostra a cada 5 s com velocidade, inclinação, FC e fase", () => {
    const { motor, tempo } = novaSessao({ treino: "T1", minutos: 25, alvo: 50 });
    motor.iniciar();
    motor.definirFc(110);
    tempo.avancar(12);
    motor.definirVelocidade(5.4);
    motor.definirInclinacao(3.3);
    tempo.avancar(50);
    const a = motor.estado.amostras;
    assert.equal(a.passo, 5);
    assert.equal(a.v.length, 12);
    assert.deepEqual(a.v.slice(0, 3), [5, 5, 5.4]);
    assert.equal(a.i[2], 3.5);
    assert.equal(a.fc[0], 110);
    assert.deepEqual(a.f.slice(0, 2), [0, 0]);
  });

  it("FC com mais de 60 s vira null na amostra", () => {
    const { motor, tempo } = novaSessao({ treino: "T1", minutos: 25, alvo: 50 });
    motor.iniciar();
    motor.definirFc(120);
    tempo.avancar(65);
    const fc = motor.estado.amostras.fc;
    assert.equal(fc[11], 120);
    assert.equal(fc[12], null);
  });
});

describe("motor: leituras e situação", () => {
  const alvo = { de: 47, ate: 53 };

  it("classifica abaixo, na faixa e acima", () => {
    assert.equal(situacaoPara(40, alvo), "abaixo");
    assert.equal(situacaoPara(50, alvo), "na-faixa");
    assert.equal(situacaoPara(60, alvo), "acima");
    assert.equal(situacaoPara(50, null), "sem-alvo");
    // Tiro: só o piso conta.
    assert.equal(situacaoPara(110, { de: 85, ate: 100 }), "na-faixa");
  });

  it("calcula %VO2máx e METs na fase com alvo", () => {
    const { motor, tempo } = novaSessao({ treino: "T1", minutos: 25, alvo: 50 });
    motor.iniciar();
    assert.equal(motor.leituras().situacao, "sem-alvo");
    tempo.avancar(300);
    motor.definirInclinacao(0);
    const vo2 = vo2Esteira({ velocidadeKmh: 5, inclinacaoPct: 0 });
    const l = motor.leituras();
    assert.ok(Math.abs(l.mets - vo2 / 3.5) < 1e-9);
    assert.ok(Math.abs(l.pctVO2 - (vo2 / 35) * 100) < 1e-9);
    assert.equal(l.situacao, "abaixo");
    motor.definirInclinacao(4);
    assert.equal(motor.leituras().situacao, "na-faixa");
    motor.definirInclinacao(8);
    assert.equal(motor.leituras().situacao, "acima");
  });

  it("sugere inclinação em passos de 0,5 para o centro da faixa", () => {
    const { motor, tempo } = novaSessao({ treino: "T1", minutos: 25, alvo: 50 });
    motor.iniciar();
    tempo.avancar(300);
    const bruta = inclinacaoParaMets({ velocidadeKmh: 5, mets: (0.5 * 35) / 3.5 });
    const l = motor.leituras();
    assert.equal(l.inclinacaoSugerida, Math.round(bruta * 2) / 2);
    assert.equal(l.inclinacaoSugerida % 0.5, 0);
    assert.equal(l.kmhSugerida, null);
    assert.ok(Math.abs(l.pctSugerido - 50) < 2);
  });

  it("limita a 20% e sugere velocidade acima disso", () => {
    const r = sugerirCarga({ velocidade: 3, alvo: { de: 65, ate: 75 }, vo2max: 60 });
    assert.equal(r.inclinacaoSugerida, 20);
    assert.ok(r.kmhSugerida > 3);
    assert.ok(vo2Esteira({ velocidadeKmh: r.kmhSugerida, inclinacaoPct: 20 }) >= 0.7 * 60);
    const baixa = sugerirCarga({ velocidade: 12, alvo: { de: 47, ate: 53 }, vo2max: 35 });
    assert.equal(baixa.inclinacaoSugerida, 0);
    assert.ok(baixa.kmhSugerida < 12);
  });

  it("assume a inclinação fixa ao entrar na fase e sugere velocidade", () => {
    const { motor, tempo } = novaSessao({ treino: "T2", minutos: 20, alvo: [50, 70] });
    motor.iniciar();
    motor.definirInclinacao(3);
    tempo.avancar(300);
    assert.equal(motor.estado.inclinacao, 1);
    const l = motor.leituras();
    assert.equal(l.inclinacaoSugerida, 1);
    assert.ok(l.kmhSugerida > 0);
  });

  it("avisa quando nenhuma velocidade cai na faixa na inclinação fixa", () => {
    // T2 a 1% com VO2máx 35: 6,4 km/h dá 46% (caminhada) e 6,5 dá 75% (corrida).
    const alvo = { de: 50, ate: 70 };
    for (const velocidade of [6.4, 6.5, 7]) {
      const r = sugerirCarga({ velocidade, alvo, vo2max: 35, inclinacaoFixa: 1 });
      assert.equal(r.semVelocidadeNaFaixa, true);
      assert.equal(r.kmhSugerida, 6.4);
    }
    const folgada = sugerirCarga({ velocidade: 5, alvo, vo2max: 30, inclinacaoFixa: 1 });
    assert.equal(folgada.semVelocidadeNaFaixa, false);
    const pct = (vo2Esteira({ velocidadeKmh: folgada.kmhSugerida, inclinacaoPct: 1 }) / 30) * 100;
    assert.ok(pct >= 50 && pct <= 70);
  });

  it("avisa mudança de situação no máximo a cada 20 s", () => {
    const { motor, tempo, de } = novaSessao({ treino: "T1", minutos: 25, alvo: 50 });
    motor.iniciar();
    tempo.avancar(300);
    motor.definirInclinacao(0);
    tempo.avancar(2);
    // Entrar na fase não avisa; mudar a carga avisa.
    motor.definirInclinacao(4);
    tempo.avancar(1);
    assert.equal(de("situacao").length, 1);
    assert.equal(de("situacao")[0].para, "na-faixa");
    motor.definirInclinacao(8);
    tempo.avancar(10);
    assert.equal(de("situacao").length, 1);
    tempo.avancar(10);
    assert.equal(de("situacao").length, 2);
    assert.equal(de("situacao")[1].para, "acima");
  });
});

describe("motor: T7", () => {
  it("pede FC aos 180 e 240 s do estágio 2 e calcula o VO2máx", () => {
    const { motor, tempo, de } = novaSessao({ treino: "T7", id: "4C" });
    motor.iniciar();
    assert.equal(motor.estado.velocidade, 4.5);
    tempo.avancar(240);
    assert.equal(motor.estado.iFase, 1);
    assert.equal(motor.estado.inclinacao, 5);
    tempo.avancar(180);
    assert.equal(de("pedirFc").length, 1);
    assert.equal(de("pedirFc")[0].marca, 180);
    motor.definirFc(120);
    tempo.avancar(60);
    assert.equal(de("pedirFc")[1].marca, 240);
    // Sem a FC do minuto 4 o estágio espera.
    tempo.avancar(5);
    assert.equal(motor.estado.iFase, 1);
    motor.definirFc(123);
    assert.equal(motor.estado.iFase, 2);
    const [r] = de("t7");
    assert.equal(r.velocidade, 4.5);
    assert.equal(r.fcFinal, 121.5);
    const esperado = vo2maxEbbeling({ velocidadeKmh: 4.5, fcFinal: 121.5, idade: 38, sexo: "m" });
    assert.equal(r.vo2max, Math.round(esperado * 10) / 10);
    tempo.avancar(200);
    const sessao = motor.encerrar();
    assert.deepEqual(sessao.t7, { velocidade: 4.5, fcFinal: 121.5, vo2max: r.vo2max });
    assert.equal(sessao.planoRef, "4C");
  });

  it("estende 60 s quando as leituras diferem mais de 5 bpm", () => {
    const { motor, tempo, de } = novaSessao({ treino: "T7" });
    motor.iniciar();
    tempo.avancar(240 + 180);
    motor.definirFc(118);
    tempo.avancar(60);
    motor.definirFc(126);
    assert.equal(de("extensao").length, 1);
    assert.equal(motor.estado.iFase, 1);
    assert.equal(motor.fase.segundos, 300);
    tempo.avancar(60);
    assert.equal(de("pedirFc").at(-1).marca, 300);
    motor.definirFc(128);
    assert.equal(motor.estado.iFase, 2);
    assert.equal(de("t7")[0].fcFinal, 127);
  });

  it("com a FC digitada atrasada, o minuto extra conta a partir da resposta", () => {
    const { motor, tempo, de } = novaSessao({ treino: "T7" });
    motor.iniciar();
    tempo.avancar(240 + 180);
    motor.definirFc(118);
    tempo.avancar(60 + 80);
    // A FC do minuto 4 chega 80 s depois do pedido.
    motor.definirFc(126);
    assert.equal(de("extensao").length, 1);
    assert.equal(motor.estado.segFase, 320);
    assert.equal(motor.fase.segundos, 380);
    tempo.avancar(30);
    assert.equal(motor.estado.iFase, 1);
    assert.equal(de("t7").length, 0);
    tempo.avancar(30);
    assert.equal(de("pedirFc").at(-1).marca, 380);
    motor.definirFc(128);
    assert.equal(motor.estado.iFase, 2);
    assert.deepEqual(de("t7")[0].leituras, [126, 128]);
    assert.equal(de("t7")[0].fcFinal, 127);
  });

  it("usa a FC do Bluetooth recente sem pedir", () => {
    const { motor, tempo, de } = novaSessao({ treino: "T7" });
    motor.iniciar();
    for (let s = 0; s < 480; s++) {
      motor.definirFc(124, "bluetooth");
      tempo.avancar(1);
    }
    assert.ok(de("pedirFc").every((p) => p.automatico));
    assert.equal(de("t7")[0].fcFinal, 124);
    assert.equal(motor.estado.iFase, 2);
  });

  it("recusa velocidade média fora de 3,2–7,2 km/h", () => {
    const { motor, tempo, de } = novaSessao({ treino: "T7" });
    motor.iniciar();
    motor.definirVelocidade(8);
    tempo.avancar(240 + 180);
    motor.definirFc(130);
    tempo.avancar(60);
    motor.definirFc(131);
    const [r] = de("t7");
    assert.equal(r.erro, "velocidade");
    assert.equal(r.vo2max, null);
    assert.equal(motor.encerrar().t7, undefined);
  });
});

describe("motor: encerrar", () => {
  it("sessão curta não é salvável", () => {
    const { motor, tempo } = novaSessao({ treino: "T1", minutos: 25, alvo: 50 });
    motor.iniciar();
    tempo.avancar(40);
    assert.equal(motor.salvavel, false);
    assert.equal(sessaoSalvavel(motor.encerrar()), false);
  });

  it("devolve a sessão no formato de src/resumo.js", () => {
    const { motor, tempo } = novaSessao({ treino: "T1", id: "2A", minutos: 30, alvo: 55 });
    motor.iniciar();
    tempo.avancar(400);
    motor.definirFc(118);
    tempo.avancar(200);
    const sessao = motor.encerrar();
    tempo.avancar(30);
    assert.equal(motor.estado.segTotal, 600);
    assert.ok(sessaoSalvavel(sessao));
    assert.match(sessao.id, /^s_[0-9a-z]+$/);
    assert.equal(sessao.inicio, new Date(EPOCA).toISOString());
    assert.equal(sessao.planoRef, "2A");
    assert.equal(sessao.vo2max, 35);
    assert.equal(sessao.amostras.v.length, 120);
    assert.equal(sessao.fases[0].dica, undefined);
    const r = resumirSessao(sessao);
    assert.equal(r.duracaoS, 600);
    assert.ok(r.metsMedio > 0);
  });

  it("retoma do rascunho em pausa, com o mesmo tempo", () => {
    const { motor, tempo } = novaSessao({ id: "2B", treino: "T3", topo: 60 });
    motor.iniciar();
    tempo.avancar(400);
    const rascunho = JSON.parse(JSON.stringify(motor.rascunho()));
    const outro = tempoFalso();
    const retomado = criarSessao({ rascunho, relogio: outro.relogio, agora: outro.agora, agendador: outro.agendador });
    assert.equal(retomado.estado.rodando, false);
    assert.equal(retomado.estado.segTotal, 400);
    assert.equal(retomado.estado.iFase, 1);
    assert.equal(retomado.encerrar().planoRef, "2B");
    retomado.retomar();
    outro.avancar(80);
    assert.equal(retomado.estado.iFase, 2);
    assert.equal(retomado.estado.amostras.v.length, 96);
  });
});

describe("equação pelo tipo de treino na sessão ao vivo", () => {
  it("T1 a 6,6 km/h não salta para a equação de corrida", () => {
    const sugestao = sugerirCarga({ velocidade: 6.6, alvo: { de: 57, ate: 63 }, vo2max: 35, modo: "caminhada" });
    assert.ok(sugestao.inclinacaoSugerida >= 0 && sugestao.kmhSugerida == null);
    const auto = sugerirCarga({ velocidade: 6.6, alvo: { de: 57, ate: 63 }, vo2max: 35 });
    assert.ok(auto.inclinacaoSugerida < sugestao.inclinacaoSugerida);
  });

  it("T2 a 1% acha velocidade de corrida na faixa com VO2máx de 35", () => {
    const r = sugerirCarga({ velocidade: 5, alvo: { de: 50, ate: 70 }, vo2max: 35, inclinacaoFixa: 1, modo: "corrida" });
    assert.equal(r.semVelocidadeNaFaixa, false);
    assert.ok(r.kmhSugerida > 4 && r.kmhSugerida < 6.5);
  });
});

// Dados de EXEMPLO: perfil e cerca de 12 sessões em 5 semanas do plano, com
// amostras sintéticas a cada 5 s. Servem só para a interface ter o que mostrar
// antes do primeiro treino; o estado nunca os grava.

import { PLANO, montarFases, modoDoTreino } from "../src/treinos.js";
import { vo2Esteira, inclinacaoParaMets, vo2maxEbbeling, fcMaxEstimada, ML_POR_MET } from "../src/calculadora.js";

const PERFIL = {
  nome: "Exemplo",
  idade: 38,
  sexo: "m",
  pesoKg: 80,
  fcRepouso: 60,
  vo2max: 35,
  velocidadePadrao: 5,
  velocidadeT7: 4.5,
};

const DIA = 86400000;
const PASSO = 5;

const dois = (n) => String(n).padStart(2, "0");
const isoDia = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

function segundaFeira(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// O plano começou 4 semanas antes da semana atual: hoje cai na semana 5.
function inicioDoPlano(hoje) {
  const d = segundaFeira(hoje);
  d.setDate(d.getDate() - 28);
  return d;
}

export function perfilExemplo(hoje = new Date()) {
  return { ...PERFIL, inicioPlano: isoDia(inicioDoPlano(hoje)), exemplo: true };
}

// Gerador pseudoaleatório com semente fixa: o exemplo sai igual a cada abertura.
function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// [semana, id da sessão, dia da semana (0 = segunda), usar a alternativa do dia]
// A 2C ficou de fora de propósito: semana com uma sessão perdida.
const ROTEIRO = [
  [1, "1A", 0], [1, "1B", 2], [1, "1C", 4],
  [2, "2A", 0], [2, "2B", 3],
  [3, "3A", 0], [3, "3B", 2], [3, "3C", 5, true],
  [4, "4A", 0], [4, "4B", 2], [4, "4C", 4],
  [5, "5A", 0], [5, "5B", 2],
];

// FC final do T7 a 4,5 km/h: 139 bpm dá ~35,3 e 122 bpm dá ~37,6 ml/kg/min.
const FC_FINAL_T7 = { "1A": 139, "4C": 122 };
const VELOCIDADE_T7 = 4.5;

const NOTAS = {
  "1A": "Primeiro teste, a 4,5 km/h.",
  "2B": "O degrau de 60% pesou no fim.",
  "3C": "Troquei a rodagem pela caminhada.",
  "4C": "Mesma velocidade do primeiro teste.",
  "5B": "Tiros curtos, recuperação a 1%.",
};

const arred = (v, passo) => Number((Math.round(v / passo) * passo).toFixed(2));
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

function inclinacaoPara(pct, velocidade, vo2max, modo) {
  const metsAlvo = ((pct / 100) * vo2max) / ML_POR_MET;
  return limitar(arred(inclinacaoParaMets({ velocidadeKmh: velocidade, mets: metsAlvo, modo }), 0.5), 0, 20);
}

// Velocidade e inclinação que o usuário põe em cada fase, conforme a fração k
// da fase já feita.
function cargaDaFase(fase, vo2max, velocidadePadrao, erro, modo) {
  const centro = fase.alvo ? (fase.alvo.de + fase.alvo.ate) / 2 : null;
  switch (fase.tipo) {
    case "aquecimento":
      return (k) => ({ v: 4.8, i: k < 0.6 ? 1 : 3 });
    case "volta":
      return (k) => ({ v: arred(4.6 - 0.5 * k, 0.1), i: k < 0.3 ? 1 : 0 });
    case "estagio":
      return () => ({ v: VELOCIDADE_T7, i: fase.inclinacaoFixa ?? 0 });
    case "recuperacao":
      return () => ({ v: 4.5, i: fase.inclinacaoFixa ?? 1 });
    case "tiro": {
      const i = limitar(inclinacaoPara(92, 7.5, vo2max, modo) + erro, 0, 20);
      return () => ({ v: 7.5, i });
    }
    default: {
      if (fase.inclinacaoFixa != null) return () => ({ v: velocidadePadrao, i: fase.inclinacaoFixa });
      const i = limitar(inclinacaoPara(centro ?? 50, velocidadePadrao, vo2max, modo) + erro, 0, 20);
      return () => ({ v: velocidadePadrao, i });
    }
  }
}

function gerarAmostras({ fases, vo2max, vo2maxFisico, fcRepouso, fcMax, fcFinalT7, sorte, falhaFc, modo = "auto" }) {
  const amostras = { passo: PASSO, v: [], i: [], fc: [], f: [] };
  const reserva = fcMax - fcRepouso;
  let fc = 76;
  let inclinacaoAnterior = 0;
  let t = 0;
  fases.forEach((fase, iFase) => {
    const n = Math.round(fase.segundos / PASSO);
    // Erro de ajuste do usuário: às vezes fica meio ponto fora no começo da
    // fase e corrige depois de olhar o app.
    const erro = [0, 0, 0, -0.5, 0.5, -1][Math.floor(sorte() * 6)];
    const comErro = cargaDaFase(fase, vo2max, PERFIL.velocidadePadrao, erro, modo);
    const certa = cargaDaFase(fase, vo2max, PERFIL.velocidadePadrao, 0, modo);
    const carga = (k) => (k < 0.35 ? comErro(k) : certa(k));
    // Leva alguns segundos para mexer na esteira depois da troca de fase.
    const atraso = 1 + Math.floor(sorte() * 4);
    for (let k = 0; k < n; k++) {
      const { v, i: alvoI } = carga(k / n);
      const i = k < atraso && fase.inclinacaoFixa == null ? inclinacaoAnterior : alvoI;
      const vo2 = vo2Esteira({ velocidadeKmh: v, inclinacaoPct: i, modo });
      let fcAlvo;
      if (fcFinalT7 && fase.tipo === "estagio") {
        fcAlvo = fase.inclinacaoFixa ? fcFinalT7 : fcFinalT7 - 14;
      } else {
        const fracao = limitar((vo2 - 3.5) / (vo2maxFisico - 3.5), 0, 1.05);
        // Deriva cardíaca: a FC sobe devagar ao longo da sessão na mesma carga.
        fcAlvo = fcRepouso + reserva * fracao * 0.97 + (t / 60) * 0.08;
      }
      fc += (fcAlvo - fc) * (1 - Math.exp(-PASSO / 32)) + (sorte() - 0.5) * 2.4;
      const fcFinalEstavel = fcFinalT7 && fase.inclinacaoFixa && k >= n - 4;
      const leitura = fcFinalEstavel ? fcFinalT7 + Math.round((sorte() - 0.5) * 2) : Math.round(fc);
      amostras.v.push(v);
      amostras.i.push(i);
      amostras.fc.push(falhaFc && t >= falhaFc[0] && t < falhaFc[1] ? null : leitura);
      amostras.f.push(iFase);
      t += PASSO;
    }
    inclinacaoAnterior = amostras.i[amostras.i.length - 1];
  });
  return amostras;
}

function rpeDe(fases, treino) {
  if (treino === "T7") return 4;
  const topo = Math.max(...fases.map((f) => (f.alvo ? (f.alvo.de + f.alvo.ate) / 2 : 0)));
  if (topo >= 85) return 8;
  if (topo >= 68) return 6;
  if (topo >= 60) return 5;
  if (topo >= 55) return 4;
  return 3;
}

let cache = { dia: null, sessoes: null };

export function sessoesExemplo(hoje = new Date()) {
  const chave = isoDia(hoje);
  if (cache.dia === chave) return cache.sessoes;

  const sorte = aleatorio(20261015);
  const inicio = inicioDoPlano(hoje);
  const fcMax = fcMaxEstimada(PERFIL.idade);
  let vo2maxPrescricao = PERFIL.vo2max;
  const sessoes = [];

  for (const [semana, id, dia, usarAlternativa] of ROTEIRO) {
    const plano = PLANO[semana - 1].sessoes.find((s) => s.id === id);
    const sessaoPlano = usarAlternativa && plano.alternativa ? { id, ...plano.alternativa } : plano;
    const quando = new Date(inicio.getTime() + ((semana - 1) * 7 + dia) * DIA);
    quando.setHours(6, 40 + Math.floor(sorte() * 50), 0, 0);
    const fases = montarFases(sessaoPlano);
    const duracao = fases.reduce((soma, f) => soma + f.segundos, 0);
    if (quando.getTime() + duracao * 1000 > hoje.getTime()) continue;

    // Condicionamento real sobe aos poucos ao longo das semanas.
    const dias = (quando - inicio) / DIA;
    const vo2maxFisico = Math.min(37.8, 35 + (2.5 * dias) / 25);
    const fcFinalT7 = FC_FINAL_T7[id];
    const amostras = gerarAmostras({
      modo: modoDoTreino(sessaoPlano.treino),
      fases,
      vo2max: vo2maxPrescricao,
      vo2maxFisico,
      fcRepouso: PERFIL.fcRepouso,
      fcMax,
      fcFinalT7,
      sorte,
      falhaFc: id === "2A" ? [600, 665] : null,
    });

    const sessao = {
      id: `s_${quando.getTime().toString(36)}`,
      inicio: quando.toISOString(),
      treino: sessaoPlano.treino,
      planoRef: id,
      vo2max: vo2maxPrescricao,
      pesoKg: PERFIL.pesoKg,
      fcMax,
      fcRepouso: PERFIL.fcRepouso,
      fases,
      amostras,
      rpe: rpeDe(fases, sessaoPlano.treino),
      notas: NOTAS[id] ?? "",
      exemplo: true,
    };
    if (fcFinalT7) {
      const vo2max = vo2maxEbbeling({ velocidadeKmh: VELOCIDADE_T7, fcFinal: fcFinalT7, idade: PERFIL.idade, sexo: PERFIL.sexo });
      sessao.t7 = { velocidade: VELOCIDADE_T7, fcFinal: fcFinalT7, vo2max: Math.round(vo2max * 10) / 10 };
      // Depois do teste, as próximas sessões passam a ser prescritas pelo novo valor.
      vo2maxPrescricao = sessao.t7.vo2max;
    }
    if (id === "3A" || id === "4B") {
      const fcs = amostras.fc.filter((x) => x > 0);
      sessao.relogio = {
        fcMedia: Math.round(fcs.reduce((a, b) => a + b, 0) / fcs.length) + 1,
        fcMax: Math.max(...fcs) + 2,
        kcal: id === "3A" ? 286 : 214,
        pai: id === "3A" ? 14 : 9,
      };
    }
    sessoes.push(sessao);
  }

  sessoes.sort((a, b) => b.inicio.localeCompare(a.inicio));
  cache = { dia: chave, sessoes };
  return sessoes;
}

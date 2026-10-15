// Resumo de sessões gravadas pelo app e séries para o painel.
//
// Formato de uma sessão gravada:
// {
//   id, inicio (ISO), treino ("T1"…"T7"), planoRef ("3A" ou null),
//   vo2max (ml/kg/min usado na prescrição), pesoKg, fcMax, fcRepouso,
//   fases: [{ tipo, rotulo, segundos, alvo: {de, ate} | null }],
//   amostras: { passo: 5, v: [km/h], i: [%], fc: [bpm | null], f: [índice da fase] },
//   rpe (0–10), notas,
//   relogio: { fcMedia, fcMax, kcal, carga, pai, cadencia } (opcional, digitado depois),
//   t7: { velocidade, fcFinal, vo2max } (só no teste)
// }

import { vo2Esteira, mets, kcalPorMinuto, zonasFC } from "./calculadora.js";
import { modoDoTreino } from "./treinos.js";

const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function naFaixa(pct, alvo) {
  // Nos tiros o teto (100%) não limita: passar dele ainda conta como acerto.
  return pct >= alvo.de && (alvo.ate >= 100 || pct <= alvo.ate);
}

export function resumirSessao(sessao) {
  const { amostras, fases, vo2max, pesoKg } = sessao;
  const dt = amostras.passo;
  const modo = modoDoTreino(sessao.treino);
  const metsAtivos = [];
  const pcts = [];
  const fcs = [];
  const paresFcMets = [];
  let kcal = 0;
  let distanciaKm = 0;
  let subidaM = 0;
  let comAlvo = 0;
  let dentro = 0;

  amostras.v.forEach((v, k) => {
    if (!(v > 0)) return;
    const inc = amostras.i[k] ?? 0;
    const vo2 = vo2Esteira({ velocidadeKmh: v, inclinacaoPct: inc, modo });
    const m = mets(vo2);
    metsAtivos.push(m);
    distanciaKm += (v * dt) / 3600;
    subidaM += ((v * 1000) / 3600) * dt * (inc / 100);
    if (pesoKg) kcal += (kcalPorMinuto({ vo2, pesoKg }) * dt) / 60;
    const fc = amostras.fc[k];
    if (fc > 0) {
      fcs.push(fc);
      paresFcMets.push([fc, m]);
    }
    if (vo2max) {
      const pct = (vo2 / vo2max) * 100;
      pcts.push(pct);
      const alvo = fases[amostras.f[k]]?.alvo;
      if (alvo) {
        comAlvo++;
        if (naFaixa(pct, alvo)) dentro++;
      }
    }
  });

  const metsMedio = media(metsAtivos);
  const fcMedia = media(fcs);
  return {
    duracaoS: amostras.v.length * dt,
    ativoS: metsAtivos.length * dt,
    metsMedio,
    pctVO2Medio: media(pcts),
    kcal: pesoKg ? kcal : null,
    distanciaKm,
    subidaM,
    minutosComAlvo: (comAlvo * dt) / 60,
    minutosNaFaixa: (dentro * dt) / 60,
    acertoFaixa: comAlvo ? dentro / comAlvo : null,
    fcMedia,
    fcMax: fcs.length ? Math.max(...fcs) : null,
    // Batimentos por MET: menor na mesma carga = mais condicionado.
    eficiencia: paresFcMets.length
      ? media(paresFcMets.map(([fc]) => fc)) / media(paresFcMets.map(([, m]) => m))
      : null,
  };
}

// Minutos em cada zona de FC (Z1–Z5) a partir das amostras.
export function minutosPorZona(sessao) {
  const { fcMax, fcRepouso, amostras } = sessao;
  const vazio = [0, 0, 0, 0, 0];
  if (!fcMax) return vazio;
  const zonas = zonasFC({ fcMax, fcRepouso });
  const conta = [...vazio];
  amostras.fc.forEach((fc) => {
    if (!(fc > 0) || fc < zonas[0].min) return;
    const z = zonas.findIndex((zona) => fc < zona.max);
    conta[z === -1 ? 4 : z]++;
  });
  return conta.map((n) => (n * amostras.passo) / 60);
}

// Segunda-feira 00:00 (horário local) da semana da data.
export function inicioDaSemana(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// Últimas `semanas` semanas, da mais antiga para a atual.
export function serieSemanal(sessoes, hoje, semanas = 8) {
  const atual = inicioDaSemana(hoje);
  const serie = Array.from({ length: semanas }, (_, k) => {
    const inicio = new Date(atual);
    inicio.setDate(inicio.getDate() - 7 * (semanas - 1 - k));
    return { inicio, minutosNaFaixa: 0, minutosAtivos: 0, sessoes: 0 };
  });
  for (const s of sessoes) {
    const ini = inicioDaSemana(s.inicio).getTime();
    const item = serie.find((w) => w.inicio.getTime() === ini);
    if (!item) continue;
    const r = resumirSessao(s);
    item.minutosNaFaixa += r.minutosNaFaixa;
    item.minutosAtivos += r.ativoS / 60;
    item.sessoes++;
  }
  return serie;
}

export function historicoVO2(sessoes) {
  return sessoes
    .filter((s) => s.t7?.vo2max)
    .map((s) => ({ data: s.inicio, vo2max: s.t7.vo2max, mets: mets(s.t7.vo2max), fcFinal: s.t7.fcFinal, velocidade: s.t7.velocidade }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

// Velocidade e inclinação médias no trabalho principal (sem aquecimento e volta).
function cargaPrincipal(sessao) {
  const { amostras, fases } = sessao;
  const vs = [];
  const is = [];
  amostras.v.forEach((v, k) => {
    const tipo = fases[amostras.f[k]]?.tipo;
    if (v > 0 && tipo !== "aquecimento" && tipo !== "volta") {
      vs.push(v);
      is.push(amostras.i[k] ?? 0);
    }
  });
  return { velocidade: media(vs), inclinacao: media(is) };
}

const COLUNAS = [
  "data", "treino", "duracao_min", "velocidade_kmh", "inclinacao_pct", "fc_media", "fc_max",
  "min_z1", "min_z2", "min_z3", "min_z4", "min_z5", "kcal_relogio", "carga_treino", "pai",
  "cadencia_spm", "rpe_0a10", "notas",
  // Colunas extras do app, depois das do modelo de registro:
  "mets_medio", "pct_vo2max_medio", "min_na_faixa", "vo2max_t7",
];

function celula(valor) {
  if (valor == null || Number.isNaN(valor)) return "";
  if (typeof valor === "number") return String(Math.round(valor * 10) / 10);
  const texto = String(valor);
  return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// Data no fuso de quem treinou: o inicio é ISO em UTC, e um treino às 22h
// no Brasil já cai no dia seguinte em UTC.
function dataLocal(iso) {
  const d = new Date(iso);
  const dois = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

// CSV compatível com registros/modelo-registro.csv (com 4 colunas extras no fim).
export function paraCSV(sessoes) {
  const linhas = sessoes.map((s) => {
    const r = resumirSessao(s);
    const c = cargaPrincipal(s);
    const z = minutosPorZona(s);
    const rel = s.relogio ?? {};
    return [
      dataLocal(s.inicio), s.treino, r.duracaoS / 60, c.velocidade, c.inclinacao,
      rel.fcMedia ?? r.fcMedia, rel.fcMax ?? r.fcMax, ...z,
      rel.kcal, rel.carga, rel.pai, rel.cadencia, s.rpe, s.notas,
      r.metsMedio, r.pctVO2Medio, r.minutosNaFaixa, s.t7?.vo2max,
    ].map(celula).join(",");
  });
  return [COLUNAS.join(","), ...linhas].join("\n") + "\n";
}

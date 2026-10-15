// Perfil de rampa: cada fase é um degrau (largura = duração, altura = alvo).
// É o elemento-assinatura do app (ver espec de design). Cores só por token CSS.

import { s } from "./ui.js";
import { vo2Esteira } from "../src/calculadora.js";

export const NOMES_INTENSIDADE = ["Leve", "Base", "Aeróbica", "Forte", "Máxima"];

// Escala vertical do desenho, em % do VO2máx.
const PISO = 35;
const TETO = 100;
const ALTURA_SEM_ALVO = 40;
const ALTURA_TIRO = 92;

// Valor de referência de uma fase em % do VO2máx: o medido (pctReal) quando
// houver, senão o centro do alvo.
export function pctReferencia(fase) {
  if (Number.isFinite(fase?.pctReal)) return fase.pctReal;
  const alvo = fase?.alvo;
  if (!alvo) return ALTURA_SEM_ALVO;
  if (fase.tipo === "tiro" || alvo.de >= 85) return ALTURA_TIRO;
  return (alvo.de + alvo.ate) / 2;
}

// 1 Leve (<50) · 2 Base (50–60) · 3 Aeróbica (60–70) · 4 Forte (70–85) · 5 Máxima (>85)
export function nivelIntensidade(pct) {
  if (!Number.isFinite(pct)) return 1;
  if (pct < 50) return 1;
  if (pct < 60) return 2;
  if (pct < 70) return 3;
  if (pct < 85) return 4;
  return 5;
}

export const corIntensidade = (nivel) => `var(--int-${Math.min(5, Math.max(1, nivel))})`;

// Cor de uma fase: sem alvo (e sem medida) é sempre Leve.
export function corFase(fase) {
  if (!fase?.alvo && !Number.isFinite(fase?.pctReal)) return corIntensidade(1);
  return corIntensidade(nivelIntensidade(pctReferencia(fase)));
}

// Fases como foram feitas, a partir das amostras de uma sessão gravada:
// duração medida e % do VO2máx médio (pctReal) em cada fase.
export function fasesExecutadas(sessao) {
  const { fases = [], amostras, vo2max } = sessao ?? {};
  if (!amostras?.f?.length) return fases.map((f) => ({ ...f }));
  const passo = amostras.passo ?? 5;
  const acumulado = fases.map(() => ({ n: 0, somaPct: 0, nPct: 0 }));
  amostras.f.forEach((iFase, k) => {
    const item = acumulado[iFase];
    if (!item) return;
    item.n++;
    const v = amostras.v[k];
    if (vo2max && v > 0) {
      const vo2 = vo2Esteira({ velocidadeKmh: v, inclinacaoPct: amostras.i[k] ?? 0 });
      item.somaPct += (vo2 / vo2max) * 100;
      item.nPct++;
    }
  });
  return fases
    .map((f, k) => ({
      ...f,
      segundos: acumulado[k].n * passo,
      pctReal: acumulado[k].nPct ? acumulado[k].somaPct / acumulado[k].nPct : undefined,
    }))
    .filter((f) => f.segundos > 0);
}

let contador = 0;

function caminhoDegrau(x, largura, topo, base, raio) {
  const r = Math.max(0, Math.min(raio, largura / 2, base - topo));
  return `M${x},${base}V${topo + r}Q${x},${topo} ${x + r},${topo}H${x + largura - r}Q${x + largura},${topo} ${x + largura},${topo + r}V${base}Z`;
}

function alturaDegrau(fase, alturaUtil) {
  const pct = Math.min(TETO, Math.max(PISO, pctReferencia(fase)));
  return Math.max(2, ((pct - PISO) / (TETO - PISO)) * alturaUtil);
}

function degraus(fases, { largura, base, alturaUtil, escalaSeg, folga, classe, cor }) {
  let x = 0;
  return fases.map((f) => {
    const w = Math.max(2, f.segundos * escalaSeg - folga);
    const topo = base - alturaDegrau(f, alturaUtil);
    const d = caminhoDegrau(x + folga / 2, Math.min(w, largura), topo, base, 3);
    x += f.segundos * escalaSeg;
    return s("path", { d, class: classe, fill: cor ?? corFase(f) });
  });
}

/**
 * perfilRampa(fases, opcoes) → <svg class="rampa">
 * opcoes:
 *   altura        px (padrão 64; compacto 28)
 *   largura       px fixos; sem ela o SVG ocupa 100% e se redesenha ao mudar de largura
 *   progresso     0–1 (fração feita) ou, se > 1, segundos decorridos
 *   segundos      segundos decorridos (alternativa explícita a progresso)
 *   mostrarCursor linha + triângulo "você está aqui" no ponto do progresso
 *   planejado     fases para desenhar em cinza por trás (ex.: plano de uma sessão feita)
 *   compacto      miniatura 80×28, sem cursor
 *   rotulo        texto do aria-label
 * O elemento devolvido tem .definirProgresso(valor) para atualizar sem recriar.
 */
export function perfilRampa(fases = [], opcoes = {}) {
  const { compacto = false, planejado = null, rotulo } = opcoes;
  const altura = opcoes.altura ?? (compacto ? 28 : 64);
  const larguraFixa = opcoes.largura ?? (compacto ? 80 : null);
  const mostrarCursor = !compacto && !!opcoes.mostrarCursor;
  const idClip = `rampa-clip-${++contador}`;
  const totalFases = fases.reduce((soma, f) => soma + (f.segundos || 0), 0);
  const totalPlano = planejado ? planejado.reduce((soma, f) => soma + (f.segundos || 0), 0) : 0;
  const total = Math.max(totalFases, totalPlano) || 1;

  let progresso = null;
  const normalizar = (valor, segundos) => {
    if (Number.isFinite(segundos)) return Math.min(1, Math.max(0, segundos / (totalFases || 1)));
    if (!Number.isFinite(valor)) return null;
    return Math.min(1, Math.max(0, valor > 1 ? valor / (totalFases || 1) : valor));
  };
  progresso = normalizar(opcoes.progresso, opcoes.segundos);

  const minutos = Math.round(totalFases / 60);
  const svg = s("svg", {
    class: ["rampa", compacto && "rampa-compacta"],
    height: altura,
    role: "img",
    "aria-label": rotulo ?? `Perfil do treino: ${fases.length} ${fases.length === 1 ? "fase" : "fases"}, ${minutos} min`,
    preserveAspectRatio: "none",
  });
  if (larguraFixa) {
    svg.setAttribute("width", larguraFixa);
    svg.style.width = `${larguraFixa}px`;
  }

  let larguraAtual = 0;
  let clipRect = null;
  let cursor = null;

  function posicionarProgresso() {
    if (!clipRect) return;
    const x = (progresso ?? 0) * (totalFases / total) * larguraAtual;
    clipRect.setAttribute("width", Math.max(0, x));
    if (cursor) cursor.setAttribute("transform", `translate(${x.toFixed(1)},0)`);
  }

  function desenhar(largura) {
    larguraAtual = largura;
    svg.setAttribute("viewBox", `0 0 ${largura} ${altura}`);
    svg.replaceChildren();
    clipRect = null;
    cursor = null;
    const topoLivre = mostrarCursor ? 9 : 0;
    const base = altura;
    const alturaUtil = altura - topoLivre;
    const escalaSeg = largura / total;
    const folga = compacto ? 0.75 : 1;
    const comum = { largura, base, alturaUtil, escalaSeg, folga };

    if (planejado?.length) {
      svg.append(s("g", { class: "rampa-planejado" }, degraus(planejado, { ...comum, classe: "rampa-plano", cor: "var(--linha)" })));
    }
    if (progresso == null) {
      svg.append(s("g", { class: "rampa-degraus" }, degraus(fases, comum)));
      return;
    }
    clipRect = s("rect", { x: 0, y: 0, width: 0, height: altura });
    svg.append(
      s("defs", null, s("clipPath", { id: idClip }, clipRect)),
      s("g", { class: "rampa-futuro" }, degraus(fases, comum)),
      s("g", { class: "rampa-feito", "clip-path": `url(#${idClip})` }, degraus(fases, comum)),
    );
    if (mostrarCursor) {
      cursor = s("g", { class: "rampa-marcador" },
        s("line", { class: "rampa-cursor", x1: 0, x2: 0, y1: 7, y2: base }),
        s("path", { class: "rampa-seta", d: "M-5,0H5L0,7Z" }),
      );
      svg.append(cursor);
    }
    posicionarProgresso();
  }

  if (larguraFixa) {
    desenhar(larguraFixa);
  } else {
    desenhar(358);
    svg.style.width = "100%";
    if (typeof ResizeObserver === "function") {
      const observador = new ResizeObserver(([entrada]) => {
        const w = Math.round(entrada.contentRect.width);
        if (w > 0 && w !== larguraAtual) desenhar(w);
      });
      observador.observe(svg);
    }
  }

  svg.definirProgresso = (valor) => {
    const novo = normalizar(valor);
    if (novo == null) return;
    const precisaRedesenhar = progresso == null;
    progresso = novo;
    if (precisaRedesenhar) desenhar(larguraAtual);
    else posicionarProgresso();
  };
  return svg;
}

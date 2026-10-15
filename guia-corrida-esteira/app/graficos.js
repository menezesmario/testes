// Gráficos SVG do Painel: linha com pontos (VO2máx), barras semanais, linha
// suave com faixa (eficiência) e o gráfico de uma sessão.
//
// Todos devolvem um <div class="painel-graf"> com a leitura no topo (número
// grande + rótulo), o SVG responsivo e a legenda. Arrastar o dedo (ou passar o
// mouse) sobre o SVG troca a leitura do topo: nada de tooltip sob o dedo. Setas
// do teclado fazem o mesmo, e uma tabela só para leitor de tela repete os dados.
// O SVG é redesenhado na largura real (viewBox = largura em px), então o texto
// mantém o tamanho em qualquer tela. Os estilos ficam em telas/painel.css.
//
// Um gráfico, uma escala: a inclinação da sessão vai num painel próprio abaixo
// do principal, com o mesmo eixo de tempo, e não num segundo eixo y.

import { h, s, formatar } from "./ui.js";
import { corFase, fasesExecutadas } from "./rampa.js";
import { vo2Esteira } from "../src/calculadora.js";
import { modoDoTreino } from "../src/treinos.js";
import { resumirSessao } from "../src/resumo.js";

const { num, delta, tempo } = formatar;

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function diaMes(valor) {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "–" : `${d.getDate()} ${MESES[d.getMonth()]}`;
}

// Eixo y à direita: a coluna da direita guarda os rótulos.
const MARGEM = { topo: 8, direita: 34, base: 24, esquerda: 6 };

// ---------- Escalas ----------
const arredondar = (v, casas = 6) => Math.round(v * 10 ** casas) / 10 ** casas;
const linear = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);

// Domínio e marcas "redondos" (1, 2, 5 × 10ⁿ) que cobrem [min, max]. O domínio
// termina exatamente na primeira e na última marca: todo rótulo do eixo é um
// valor que o gráfico alcança.
export function escalaNice(min, max, alvo = 4) {
  if (!(max > min)) {
    min -= 1;
    max += 1;
  }
  const bruto = (max - min) / alvo;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / mag;
  const passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const ini = arredondar(Math.floor(min / passo + 1e-9) * passo);
  const fim = arredondar(Math.ceil(max / passo - 1e-9) * passo);
  const ticks = [];
  for (let v = ini; v <= fim + passo / 2; v = arredondar(v + passo)) ticks.push(v);
  return { min: ini, max: fim, passo, ticks };
}

// Casas decimais que mostram todas as marcas sem arredondar (2,5 e 0,25 não viram 3 e 0,3).
const casasDasMarcas = (esc) => (esc.ticks.every((v) => Number.isInteger(v)) ? 0 : esc.ticks.every((v) => Number.isInteger(arredondar(v * 10))) ? 1 : 2);

// ---------- Peças comuns ----------
function criarLeitura(duasLinhas) {
  const valor = h("span", { class: "painel-graf-leitura-valor num" });
  const unidade = h("span", { class: "painel-graf-leitura-unidade" });
  const nota = h("span", { class: "painel-graf-leitura-nota" });
  const rotulo = h("div", { class: ["painel-graf-leitura-rotulo", duasLinhas && "painel-graf-leitura-rotulo--duas"] });
  const el = h("div", { class: "painel-graf-leitura" },
    h("div", { class: "painel-graf-leitura-linha" }, valor, unidade, nota),
    rotulo,
  );
  const linhasDe = (l) => (Array.isArray(l.rotulo) ? l.rotulo : [l.rotulo ?? ""]);
  return {
    el,
    mostrar(l) {
      valor.textContent = l.valor ?? "–";
      unidade.textContent = l.unidade ?? "";
      nota.textContent = l.nota ?? "";
      nota.dataset.tom = l.tom ?? "";
      rotulo.replaceChildren(...linhasDe(l).map((t) => h("div", null, t)));
    },
    texto: (l) => [l.valor, l.unidade, ...linhasDe(l), l.nota].filter(Boolean).join(", "),
  };
}

// i.cores: as cores reais da série (ex.: faixas por intensidade); a chave
// mostra cada uma numa fatia, para a legenda bater com o gráfico.
function criarLegenda(itens) {
  return h("ul", { class: "painel-graf-legenda" },
    itens.map((i) => {
      let style = null;
      if (i.cores?.length) {
        const passo = 100 / i.cores.length;
        const fatias = i.cores.map((c, k) => `${c} ${(k * passo).toFixed(1)}% ${((k + 1) * passo).toFixed(1)}%`);
        style = { background: `linear-gradient(90deg, ${fatias.join(", ")})` };
      }
      return h("li", null,
        h("span", { class: ["painel-graf-chave", `painel-graf-chave--${i.tipo}`], style, "aria-hidden": "true" }),
        i.rotulo,
      );
    }),
  );
}

// A tabela vai dentro de um div recortado: uma <table> com a classe sozinha
// ignora a largura de 1 px e alarga a página.
function criarTabela({ legenda, colunas, linhas }) {
  return h("div", { class: "so-leitor" },
    h("table", null,
      h("caption", null, legenda),
      h("thead", null, h("tr", null, colunas.map((c) => h("th", { scope: "col" }, c)))),
      h("tbody", null, linhas.map((l) => h("tr", null, l.map((c) => h("td", null, c))))),
    ),
  );
}

function eixoYDireita(esc, y, largura) {
  const xd = largura - MARGEM.direita;
  const casas = casasDasMarcas(esc);
  return esc.ticks.flatMap((t) => [
    s("line", { class: ["painel-graf-grade", t === esc.min && "painel-graf-grade--base"], x1: MARGEM.esquerda, x2: xd, y1: y(t), y2: y(t) }),
    s("text", { class: "painel-graf-tick", x: xd + 6, y: y(t) + 4 }, num(t, casas)),
  ]);
}

function rotuloX(x, texto, y, largura) {
  const ancora = x < 18 ? "start" : x > largura - 16 ? "end" : "middle";
  return s("text", { class: "painel-graf-tick", x, y, "text-anchor": ancora }, texto);
}

// Núcleo: monta a leitura, o SVG, a cruzeta e os eventos. `desenhar(largura)`
// devolve { nos, alvos, cruzeta: [y1, y2] }. Cada alvo = { x, leitura,
// pontos?: [{x, y}], destacar?(ligado) }, em ordem crescente de x.
function montarGrafico({ altura, aria, leituraPadrao, desenhar, tabela, legenda, duasLinhas = false }) {
  const leitura = criarLeitura(duasLinhas);
  const svg = s("svg", { class: "painel-graf-svg", height: altura, role: "img", "aria-label": aria, tabindex: "0" });
  const anuncio = h("div", { class: "so-leitor", "aria-live": "polite" });
  const raiz = h("div", { class: "painel-graf" },
    leitura.el, svg, legenda ? criarLegenda(legenda) : null, anuncio, tabela ? criarTabela(tabela) : null,
  );
  leitura.mostrar(leituraPadrao);

  let largura = 0;
  let alvos = [];
  let atual = -1;
  let arrastando = false;
  let cruz = null;

  function selecionar(k, porTeclado = false) {
    if (k === atual) return;
    if (atual >= 0) alvos[atual]?.destacar?.(false);
    atual = k;
    if (k < 0 || !alvos[k]) {
      atual = -1;
      leitura.mostrar(leituraPadrao);
      cruz.linha.setAttribute("visibility", "hidden");
      cruz.pontos.forEach((p) => p.setAttribute("visibility", "hidden"));
      return;
    }
    const a = alvos[k];
    a.destacar?.(true);
    leitura.mostrar(a.leitura);
    cruz.linha.setAttribute("x1", a.x);
    cruz.linha.setAttribute("x2", a.x);
    cruz.linha.setAttribute("visibility", "visible");
    cruz.pontos.forEach((p, i) => {
      const alvoPonto = a.pontos?.[i];
      if (!alvoPonto) return p.setAttribute("visibility", "hidden");
      p.setAttribute("cx", alvoPonto.x);
      p.setAttribute("cy", alvoPonto.y);
      p.setAttribute("visibility", "visible");
    });
    if (porTeclado) anuncio.textContent = leitura.texto(a.leitura);
  }

  function redesenhar(w) {
    largura = w;
    atual = -1;
    svg.setAttribute("viewBox", `0 0 ${w} ${altura}`);
    svg.replaceChildren();
    const r = desenhar(w);
    alvos = r.alvos;
    cruz = {
      linha: s("line", { class: "painel-graf-cruzeta", y1: r.cruzeta[0], y2: r.cruzeta[1], visibility: "hidden" }),
      pontos: [0, 1].map(() => s("circle", { class: "painel-graf-cruz-ponto", r: 5, visibility: "hidden" })),
    };
    svg.append(...r.nos, cruz.linha, ...cruz.pontos);
    leitura.mostrar(leituraPadrao);
  }

  function maisProximo(x) {
    let lo = 0;
    let hi = alvos.length - 1;
    while (hi - lo > 1) {
      const meio = (lo + hi) >> 1;
      if (alvos[meio].x < x) lo = meio;
      else hi = meio;
    }
    return Math.abs(alvos[lo].x - x) <= Math.abs(alvos[hi].x - x) ? lo : hi;
  }

  function mover(e) {
    if (!alvos.length) return;
    const ret = svg.getBoundingClientRect();
    const x = (e.clientX - ret.left) * (largura / (ret.width || largura));
    selecionar(maisProximo(x));
  }

  svg.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    arrastando = true;
    mover(e);
  });
  svg.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse" || arrastando) mover(e);
  });
  const soltar = (e) => {
    arrastando = false;
    if (e.pointerType !== "mouse") selecionar(-1);
  };
  svg.addEventListener("pointerup", soltar);
  svg.addEventListener("pointercancel", soltar);
  svg.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") selecionar(-1);
  });
  svg.addEventListener("blur", () => selecionar(-1));
  svg.addEventListener("keydown", (e) => {
    if (!alvos.length) return;
    const ultimo = alvos.length - 1;
    let k = null;
    if (e.key === "ArrowLeft") k = atual < 0 ? ultimo : Math.max(0, atual - 1);
    else if (e.key === "ArrowRight") k = atual < 0 ? ultimo : Math.min(ultimo, atual + 1);
    else if (e.key === "Home") k = 0;
    else if (e.key === "End") k = ultimo;
    else if (e.key === "Escape") return selecionar(-1);
    if (k == null) return;
    e.preventDefault();
    selecionar(k, true);
  });

  redesenhar(340);
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(([entrada]) => {
      const w = Math.round(entrada.contentRect.width);
      if (w > 0 && w !== largura) redesenhar(w);
    }).observe(svg);
  }
  return raiz;
}

// Curva monotônica (Fritsch–Carlson): suave, sem passar do valor entre dois pontos.
// Devolve os segmentos de Bézier; assim a faixa pode ser fechada pelo mesmo caminho de volta.
function segmentosMonotonos(pts) {
  const n = pts.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x));
  const m = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const q = a * a + b * b;
    if (q > 9) {
      const t = 3 / Math.sqrt(q);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return pts.slice(0, -1).map((p, i) => {
    const q = pts[i + 1];
    const dx = (q.x - p.x) / 3;
    return { p, q, c1: { x: p.x + dx, y: p.y + m[i] * dx }, c2: { x: q.x - dx, y: q.y - m[i + 1] * dx } };
  });
}

const pt = (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
const caminhoSegmentos = (segs) => segs.map((g) => `C${pt(g.c1)} ${pt(g.c2)} ${pt(g.q)}`).join("");
const caminhoVolta = (segs) => [...segs].reverse().map((g) => `C${pt(g.c2)} ${pt(g.c1)} ${pt(g.p)}`).join("");

// ---------- 1. VO2máx dos T7 ----------
// testes: saída de historicoVO2 (ordem crescente de data).
export function graficoVO2(testes) {
  const n = testes.length;
  const altura = 168;
  const ts = testes.map((t) => Date.parse(t.data));
  const primeiro = testes[0];

  const leituraDe = (k) => {
    const t = testes[k];
    const dif = k > 0 ? t.vo2max - primeiro.vo2max : null;
    return {
      valor: num(t.vo2max, 1),
      unidade: "ml/kg/min",
      rotulo: [diaMes(t.data), `${num(t.mets, 1)} METs`, t.fcFinal ? `FC final ${num(t.fcFinal)} bpm` : null].filter(Boolean).join(" · "),
      nota: dif == null ? "" : `${delta(dif, 1)} desde ${diaMes(primeiro.data)}`,
      tom: dif > 0 ? "ok" : "",
    };
  };

  function desenhar(w) {
    const xe = MARGEM.esquerda + 8;
    const xd = w - MARGEM.direita - 8;
    const topo = MARGEM.topo + 14;
    const base = altura - MARGEM.base;
    const valores = testes.map((t) => t.vo2max);
    const vmin = Math.min(...valores);
    const vmax = Math.max(...valores);
    const folga = Math.max((vmax - vmin) * 0.3, 1);
    const esc = escalaNice(vmin - folga, vmax + folga, 4);
    const y = linear(esc.min, esc.max, base, topo);
    const x = n === 1 ? () => (xe + xd) / 2 : linear(ts[0], ts[n - 1], xe, xd);
    const pts = testes.map((t, k) => ({ x: x(ts[k]), y: y(t.vo2max) }));

    const nos = [...eixoYDireita(esc, y, w)];
    if (n > 1) nos.push(s("path", { class: "painel-graf-linha", d: pts.map((p, k) => `${k ? "L" : "M"}${pt(p)}`).join("") }));
    const circulos = pts.map((p) => s("circle", { class: "painel-graf-ponto", cx: p.x, cy: p.y, r: 4 }));
    nos.push(...circulos);

    const ultimo = pts[n - 1];
    nos.push(s("text", {
      class: "painel-graf-valor painel-graf-halo",
      x: n === 1 ? ultimo.x : ultimo.x + 4,
      y: ultimo.y - 11,
      "text-anchor": n === 1 ? "middle" : "end",
    }, num(testes[n - 1].vo2max, 1)));

    // Datas só nos pontos que cabem sem encostar uma na outra.
    const mostrar = new Set([n - 1]);
    let ancora = pts[n - 1].x;
    for (let k = n - 2; k >= 0; k--) {
      if (ancora - pts[k].x >= 50) {
        mostrar.add(k);
        ancora = pts[k].x;
      }
    }
    for (const k of [...mostrar].sort((a, b) => a - b)) nos.push(rotuloX(pts[k].x, diaMes(testes[k].data), altura - 6, w));

    const alvos = pts.map((p, k) => ({
      x: p.x,
      leitura: leituraDe(k),
      pontos: [p],
      destacar: (ligado) => circulos[k].setAttribute("r", ligado ? 6 : 4),
    }));
    return { nos, alvos, cruzeta: [topo - 6, base] };
  }

  return montarGrafico({
    altura,
    aria: `VO2máx dos testes T7: ${n} ${n === 1 ? "teste" : "testes"}, último ${num(testes[n - 1].vo2max, 1)} ml/kg/min em ${diaMes(testes[n - 1].data)}.`,
    leituraPadrao: leituraDe(n - 1),
    desenhar,
    tabela: {
      legenda: "VO2máx por teste T7",
      colunas: ["Data", "VO2máx (ml/kg/min)", "METs", "FC final (bpm)", "Velocidade (km/h)"],
      linhas: testes.map((t) => [diaMes(t.data), num(t.vo2max, 1), num(t.mets, 1), num(t.fcFinal), num(t.velocidade, 1)]),
    },
  });
}

// ---------- 2. Minutos na faixa por semana ----------
// semanas: [{ inicio: Date, minutos, meta: number | null, sessoes }], da mais antiga à atual.
function barraArredondada(x, largura, topo, base, raio = 4) {
  const r = Math.max(0, Math.min(raio, largura / 2, base - topo));
  return `M${x},${base}V${topo + r}Q${x},${topo} ${x + r},${topo}H${x + largura - r}Q${x + largura},${topo} ${x + largura},${topo + r}V${base}Z`;
}

export function graficoSemanas(semanas) {
  const n = semanas.length;
  const ultimo = n - 1;
  const altura = 176;

  const leituraDe = (k) => {
    const w = semanas[k];
    const atual = k === ultimo;
    const nSessoes = `${w.sessoes} ${w.sessoes === 1 ? "sessão" : "sessões"}`;
    return {
      valor: num(w.minutos, 0),
      unidade: "min na faixa",
      rotulo: [atual ? "Esta semana" : `Semana de ${diaMes(w.inicio)}`, w.meta ? `meta ${num(w.meta)} min` : null, nSessoes].filter(Boolean).join(" · "),
      nota: w.meta ? `${num((100 * w.minutos) / w.meta, 0)}% da meta` : "",
      tom: w.meta && w.minutos >= w.meta ? "ok" : "",
    };
  };

  function desenhar(w) {
    const xe = MARGEM.esquerda;
    const xd = w - MARGEM.direita;
    const topo = MARGEM.topo + 12;
    const base = altura - MARGEM.base;
    const maximo = Math.max(5, ...semanas.map((x) => Math.max(x.minutos, x.meta ?? 0)));
    const esc = escalaNice(0, maximo, 4);
    const y = linear(esc.min, esc.max, base, topo);
    const folga = (xd - xe) / n;
    const largBarra = Math.min(24, folga * 0.62);

    const nos = [...eixoYDireita(esc, y, w)];
    const barras = [];
    const alvos = semanas.map((sem, k) => {
      const cx = xe + folga * (k + 0.5);
      let no = null;
      if (sem.minutos > 0) {
        const topoBarra = Math.min(y(sem.minutos), base - 2);
        no = s("path", {
          class: ["painel-graf-barra", k < ultimo && "painel-graf-barra--antiga"],
          d: barraArredondada(cx - largBarra / 2, largBarra, topoBarra, base),
        });
        barras.push(no);
      }
      return {
        x: cx,
        leitura: leituraDe(k),
        destacar: (ligado) => no?.classList.toggle("painel-graf-barra--sel", ligado),
      };
    });
    nos.push(...barras);

    // Meta tracejada por semana: muda com a semana do plano.
    let ultimaMeta = null;
    semanas.forEach((sem, k) => {
      if (!sem.meta) return;
      const yy = y(sem.meta);
      nos.push(s("line", { class: "painel-graf-meta", x1: xe + folga * k + 1, x2: xe + folga * (k + 1) - 1, y1: yy, y2: yy }));
      ultimaMeta = { k, yy, valor: sem.meta };
    });

    // Rótulos diretos: valor da semana atual e a meta, sem se sobreporem.
    const yBarra = y(semanas[ultimo].minutos) - 6;
    const colide = ultimaMeta && ultimaMeta.k === ultimo && Math.abs(ultimaMeta.yy - 6 - yBarra) < 14;
    if (!colide) {
      nos.push(s("text", { class: "painel-graf-valor painel-graf-halo", x: alvos[ultimo].x, y: yBarra, "text-anchor": "middle" }, num(semanas[ultimo].minutos, 0)));
    }
    if (ultimaMeta) {
      nos.push(s("text", { class: "painel-graf-tick painel-graf-halo", x: xe + folga * (ultimaMeta.k + 1) - 2, y: ultimaMeta.yy - 5, "text-anchor": "end" }, `meta ${num(ultimaMeta.valor)}`));
    }

    const passoRotulo = Math.max(1, Math.ceil(36 / folga));
    semanas.forEach((sem, k) => {
      if ((ultimo - k) % passoRotulo === 0) nos.push(rotuloX(alvos[k].x, diaMes(sem.inicio), altura - 6, w));
    });
    return { nos, alvos, cruzeta: [topo - 4, base] };
  }

  const comMeta = semanas.some((x) => x.meta);
  return montarGrafico({
    altura,
    aria: `Minutos na faixa por semana, ${n} semanas. Esta semana: ${num(semanas[ultimo].minutos, 0)} min${semanas[ultimo].meta ? ` de ${num(semanas[ultimo].meta)}` : ""}.`,
    leituraPadrao: leituraDe(ultimo),
    desenhar,
    legenda: [{ tipo: "barra", rotulo: "Minutos na faixa" }, comMeta && { tipo: "meta", rotulo: "Meta da semana" }].filter(Boolean),
    tabela: {
      legenda: "Minutos na faixa por semana",
      colunas: ["Semana de", "Minutos na faixa", "Meta (min)", "Sessões"],
      linhas: semanas.map((x) => [diaMes(x.inicio), num(x.minutos, 0), x.meta ? num(x.meta) : "–", String(x.sessoes)]),
    },
  });
}

// ---------- 3. Eficiência (batimentos por MET) ----------
// sessoes: [{ inicio, treino, eficiencia }] em ordem crescente de data.
export function graficoEficiencia(sessoes) {
  const n = sessoes.length;
  const altura = 168;
  const ts = sessoes.map((x) => Date.parse(x.inicio));
  const valores = sessoes.map((x) => x.eficiencia);
  // Média e faixa (menor–maior) das últimas 3 sessões até cada ponto.
  const janela = valores.map((_, k) => valores.slice(Math.max(0, k - 2), k + 1));
  const media = janela.map((j) => j.reduce((a, b) => a + b, 0) / j.length);
  const piso = janela.map((j) => Math.min(...j));
  const teto = janela.map((j) => Math.max(...j));

  const leituraDe = (k) => {
    const dif = k > 0 ? valores[k] - valores[0] : null;
    return {
      valor: num(valores[k], 1),
      unidade: "bpm/MET",
      rotulo: [diaMes(sessoes[k].inicio), sessoes[k].treino, k > 0 ? `média de 3: ${num(media[k], 1)}` : null].filter(Boolean).join(" · "),
      nota: dif == null ? "" : `${delta(dif, 1)} no período`,
      tom: dif < 0 ? "ok" : "",
    };
  };

  function desenhar(w) {
    const xe = MARGEM.esquerda + 8;
    const xd = w - MARGEM.direita - 8;
    const topo = MARGEM.topo + 14;
    const base = altura - MARGEM.base;
    const vmin = Math.min(...piso, ...valores);
    const vmax = Math.max(...teto, ...valores);
    const folga = Math.max((vmax - vmin) * 0.15, 0.3);
    const esc = escalaNice(vmin - folga, vmax + folga, 4);
    const y = linear(esc.min, esc.max, base, topo);
    const escX = n === 1 ? () => (xe + xd) / 2 : linear(ts[0], ts[n - 1], xe, xd);
    // Sessões no mesmo dia não podem ter x repetido na curva.
    const xs = [];
    ts.forEach((t, k) => xs.push(k ? Math.max(escX(t), xs[k - 1] + 1) : escX(t)));

    const nos = [...eixoYDireita(esc, y, w)];
    if (n > 1) {
      const sMedia = segmentosMonotonos(xs.map((x, k) => ({ x, y: y(media[k]) })));
      const sTopo = segmentosMonotonos(xs.map((x, k) => ({ x, y: y(teto[k]) })));
      const sPiso = segmentosMonotonos(xs.map((x, k) => ({ x, y: y(piso[k]) })));
      nos.push(
        s("path", { class: "painel-graf-faixa", d: `M${pt(sTopo[0].p)}${caminhoSegmentos(sTopo)}L${pt(sPiso[sPiso.length - 1].q)}${caminhoVolta(sPiso)}Z` }),
        s("path", { class: "painel-graf-linha", d: `M${pt(sMedia[0].p)}${caminhoSegmentos(sMedia)}` }),
      );
    }
    const circulos = valores.map((v, k) => s("circle", { class: "painel-graf-ponto painel-graf-ponto--sessao", cx: xs[k], cy: y(v), r: k === n - 1 ? 4.5 : 3.5 }));
    nos.push(...circulos);
    nos.push(s("text", {
      class: "painel-graf-valor painel-graf-halo",
      x: xs[n - 1] + 4, y: y(valores[n - 1]) - 11, "text-anchor": "end",
    }, num(valores[n - 1], 1)));

    const mostrar = new Set([n - 1]);
    let ancora = xs[n - 1];
    for (let k = n - 2; k >= 0; k--) {
      if (ancora - xs[k] >= 56) {
        mostrar.add(k);
        ancora = xs[k];
      }
    }
    for (const k of [...mostrar].sort((a, b) => a - b)) nos.push(rotuloX(xs[k], diaMes(sessoes[k].inicio), altura - 6, w));

    const alvos = valores.map((v, k) => ({
      x: xs[k],
      leitura: leituraDe(k),
      pontos: [{ x: xs[k], y: y(v) }],
      destacar: (ligado) => circulos[k].setAttribute("r", ligado ? 6 : k === n - 1 ? 4.5 : 3.5),
    }));
    return { nos, alvos, cruzeta: [topo - 6, base] };
  }

  return montarGrafico({
    altura,
    aria: `Eficiência em batimentos por MET em ${n} sessões; menor é melhor. Última: ${num(valores[n - 1], 1)}.`,
    leituraPadrao: leituraDe(n - 1),
    desenhar,
    legenda: [
      { tipo: "ponto", rotulo: "Sessão" },
      n > 1 && { tipo: "linha", rotulo: "Média de 3" },
      n > 1 && { tipo: "faixa", rotulo: "Menor e maior" },
    ].filter(Boolean),
    tabela: {
      legenda: "Eficiência por sessão (batimentos por MET; menor é melhor)",
      colunas: ["Data", "Treino", "bpm/MET", "Média de 3"],
      linhas: sessoes.map((x, k) => [diaMes(x.inicio), x.treino, num(valores[k], 1), num(media[k], 1)]),
    },
  });
}

// ---------- 4. Gráfico da sessão ----------
// Painel de cima: % do VO2máx no tempo, com a faixa-alvo de cada fase sombreada.
// Painel de baixo: inclinação em degraus, no mesmo eixo de tempo.
const naFaixa = (p, alvo) => p >= alvo.de && (alvo.ate >= 100 || p <= alvo.ate);

export function graficoSessao(sessao) {
  const { amostras, fases = [], vo2max } = sessao;
  const passo = amostras.passo ?? 5;
  const n = amostras.v.length;
  const total = n * passo;
  const incl = amostras.i.map((v) => v ?? 0);
  const modo = modoDoTreino(sessao.treino);
  const pcts = amostras.v.map((v, k) => (v > 0 && vo2max ? (vo2Esteira({ velocidadeKmh: v, inclinacaoPct: incl[k], modo }) / vo2max) * 100 : null));

  const trechos = [];
  amostras.f.forEach((f, k) => {
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && ultimo.f === f) ultimo.ate = (k + 1) * passo;
    else trechos.push({ f, de: k * passo, ate: (k + 1) * passo });
  });

  const resumo = resumirSessao(sessao);
  const nTrechosAlvo = trechos.filter((t) => fases[t.f]?.alvo).length;
  const coresFaixa = [...new Set(trechos.filter((t) => fases[t.f]?.alvo).map((t) => corFase(fases[t.f])))];
  // A linha usa média de 3 amostras (15 s): um ajuste de esteira de poucos
  // segundos não vira pico. A leitura ao arrastar continua com o valor cru.
  const suave = pcts.map((p, k) => {
    if (p == null) return null;
    const viz = [pcts[k - 1], p, pcts[k + 1]].filter((x) => x != null);
    return viz.reduce((a, b) => a + b, 0) / viz.length;
  });
  const leituraPadrao = {
    valor: num(resumo.pctVO2Medio, 0),
    unidade: "% do VO2máx",
    rotulo: [`Média da sessão · ${tempo(total)}`, "Arraste sobre o gráfico para ler cada momento"],
    nota: resumo.acertoFaixa != null ? `${num(resumo.acertoFaixa * 100, 0)}% na faixa` : "",
    tom: "",
  };

  const leituraDe = (k) => {
    const f = fases[amostras.f[k]];
    const p = pcts[k];
    const alvo = f?.alvo;
    let situacao = null;
    if (alvo && p != null) situacao = naFaixa(p, alvo) ? "na faixa" : p < alvo.de ? "abaixo" : "acima";
    const v = amostras.v[k];
    const fc = amostras.fc[k];
    return {
      valor: p == null ? "–" : num(p, 0),
      unidade: p == null ? "parado" : "% do VO2máx",
      nota: tempo(k * passo),
      tom: "",
      rotulo: [
        [f?.rotulo ?? "Fase", alvo ? `alvo ${num(alvo.de, 0)}–${num(alvo.ate, 0)}%` : null, situacao].filter(Boolean).join(" · "),
        `${num(v, 1)} km/h · ${num(incl[k], 1)}% · ${fc > 0 ? `FC ${num(fc)} bpm` : "sem FC"}`,
      ],
    };
  };

  const altura = 280;
  const y1Topo = 20;
  const y1Base = 180;
  const y2Topo = 212;
  const y2Base = 256;

  function desenhar(w) {
    const xe = MARGEM.esquerda;
    const xd = w - MARGEM.direita;
    const x = linear(0, total || 1, xe, xd);

    const finitos = pcts.filter((p) => p != null);
    const alvos = trechos.map((t) => fases[t.f]?.alvo).filter(Boolean);
    const minimo = Math.min(...finitos, ...alvos.map((a) => a.de));
    const maximo = Math.max(...finitos, ...alvos.map((a) => a.ate));
    const esc = Number.isFinite(minimo) && Number.isFinite(maximo) ? escalaNice(minimo, maximo, 5) : escalaNice(30, 100, 5);
    const y = linear(esc.min, esc.max, y1Base, y1Topo);

    const maxIncl = Math.max(1, ...incl);
    const esc2 = escalaNice(0, maxIncl, 1.6);
    const y2 = linear(esc2.min, esc2.max, y2Base, y2Topo);

    const nos = [
      s("text", { class: "painel-graf-tick painel-graf-titulo-painel", x: xe, y: 11 }, "% do VO2máx"),
      s("text", { class: "painel-graf-tick painel-graf-titulo-painel", x: xe, y: y2Topo - 10 }, "Inclinação, %"),
      ...eixoYDireita(esc, y, w),
    ];
    // Faixas-alvo: um retângulo por fase, na cor da intensidade do alvo.
    for (const t of trechos) {
      const alvo = fases[t.f]?.alvo;
      if (!alvo) continue;
      const topo = y(Math.min(alvo.ate, esc.max));
      const fundo = y(Math.max(alvo.de, esc.min));
      nos.push(s("rect", {
        class: "painel-graf-faixa-fase",
        x: x(t.de) + 0.75, y: topo, width: Math.max(1, x(t.ate) - x(t.de) - 1.5), height: Math.max(1, fundo - topo),
        fill: corFase(fases[t.f]),
      }));
    }
    let d = "";
    let aberto = false;
    suave.forEach((p, k) => {
      if (p == null) {
        aberto = false;
        return;
      }
      d += `${aberto ? "L" : "M"}${x((k + 0.5) * passo).toFixed(1)},${y(p).toFixed(1)}`;
      aberto = true;
    });
    nos.push(s("path", { class: "painel-graf-linha painel-graf-linha--sessao", d }));

    // Painel da inclinação.
    for (const t of esc2.ticks) {
      nos.push(
        s("line", { class: ["painel-graf-grade", t === esc2.min && "painel-graf-grade--base"], x1: xe, x2: xd, y1: y2(t), y2: y2(t) }),
        s("text", { class: "painel-graf-tick", x: xd + 6, y: y2(t) + 4 }, num(t, casasDasMarcas(esc2))),
      );
    }
    let degraus = `M${x(0).toFixed(1)},${y2(incl[0]).toFixed(1)}`;
    for (let k = 1; k < n; k++) {
      if (incl[k] !== incl[k - 1]) degraus += `H${x(k * passo).toFixed(1)}V${y2(incl[k]).toFixed(1)}`;
    }
    degraus += `H${x(total).toFixed(1)}`;
    nos.push(s("path", { class: "painel-graf-degraus", d: degraus }));

    // Eixo do tempo, em minutos redondos.
    const minTotal = total / 60;
    const passoMin = [1, 2, 5, 10, 15, 30].find((p) => minTotal / p <= 6) ?? 60;
    // A última marca cede lugar ao "min" da coluna do eixo quando as duas se encostariam.
    for (let m = 0; m * 60 <= total; m += passoMin) {
      if (x(m * 60) <= xd - 14) nos.push(rotuloX(x(m * 60), String(m), y2Base + 18, w));
    }
    nos.push(s("text", { class: "painel-graf-tick", x: xd + 6, y: y2Base + 18 }, "min"));

    const pontos = amostras.v.map((_, k) => {
      const px = x((k + 0.5) * passo);
      return {
        x: px,
        leitura: leituraDe(k),
        pontos: [...(suave[k] != null ? [{ x: px, y: y(suave[k]) }] : []), { x: px, y: y2(incl[k]) }],
      };
    });
    return { nos, alvos: pontos, cruzeta: [y1Topo - 6, y2Base] };
  }

  const executadas = fasesExecutadas(sessao);
  return montarGrafico({
    altura,
    duasLinhas: true,
    aria: `Intensidade da sessão em % do VO2máx ao longo de ${tempo(total)}, com a faixa-alvo de cada fase e a inclinação. Média ${num(resumo.pctVO2Medio, 0)}%.`,
    leituraPadrao,
    desenhar,
    legenda: [
      { tipo: "linha-sessao", rotulo: "% do VO2máx" },
      nTrechosAlvo > 0 && { tipo: "faixa-fase", rotulo: "Faixa-alvo da fase", cores: coresFaixa },
      { tipo: "linha-incl", rotulo: "Inclinação" },
    ].filter(Boolean),
    tabela: {
      legenda: "Fases da sessão",
      colunas: ["Fase", "Duração", "Alvo (% do VO2máx)", "Medido (% do VO2máx)"],
      linhas: executadas.map((f) => [
        f.rotulo ?? "Fase",
        tempo(f.segundos),
        f.alvo ? `${num(f.alvo.de, 0)}–${num(f.alvo.ate, 0)}` : "sem alvo",
        Number.isFinite(f.pctReal) ? num(f.pctReal, 0) : "–",
      ]),
    },
  });
}

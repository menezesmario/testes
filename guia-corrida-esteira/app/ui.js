// Helpers de DOM e componentes compartilhados. Estilos em app/estilo.css.
// Texto entra sempre como nó de texto: nada de innerHTML com dados.

const SVG_NS = "http://www.w3.org/2000/svg";

function aplicarAtributos(el, attrs, svg) {
  for (const [chave, valor] of Object.entries(attrs ?? {})) {
    if (valor == null || valor === false) continue;
    if (chave.startsWith("on:")) {
      el.addEventListener(chave.slice(3), valor);
    } else if (chave === "class" || chave === "className") {
      const classes = Array.isArray(valor) ? valor.filter(Boolean).join(" ") : valor;
      if (classes) el.setAttribute("class", classes);
    } else if (chave === "style") {
      if (typeof valor === "string") el.setAttribute("style", valor);
      else for (const [prop, v] of Object.entries(valor)) {
        if (v == null) continue;
        if (prop.startsWith("--")) el.style.setProperty(prop, v);
        else el.style[prop] = v;
      }
    } else if (!svg && (chave === "value" || chave === "checked")) {
      el[chave] = valor;
    } else {
      el.setAttribute(chave, valor === true ? "" : String(valor));
    }
  }
}

function anexar(el, filhos) {
  for (const filho of filhos) {
    if (filho == null || filho === false || filho === true) continue;
    if (Array.isArray(filho)) anexar(el, filho);
    else if (filho instanceof Node) el.appendChild(filho);
    else el.appendChild(document.createTextNode(String(filho)));
  }
}

export function h(tag, attrs, ...filhos) {
  if (attrs instanceof Node || typeof attrs === "string" || Array.isArray(attrs)) {
    filhos.unshift(attrs);
    attrs = null;
  }
  const el = document.createElement(tag);
  aplicarAtributos(el, attrs, false);
  anexar(el, filhos);
  return el;
}

// Mesma assinatura de h(), para elementos SVG.
export function s(tag, attrs, ...filhos) {
  const el = document.createElementNS(SVG_NS, tag);
  aplicarAtributos(el, attrs, true);
  anexar(el, filhos);
  return el;
}

let contadorId = 0;
export const novoId = (prefixo = "ui") => `${prefixo}-${++contadorId}`;

// ---------- Ícones ----------
// Traço de 1,75 px em grade 24×24, cantos arredondados.
const ponto = (cx, cy, r = 1.1) => ["circle", { cx, cy, r, fill: "currentColor", stroke: "none" }];
const ICONES = {
  hoje: [["rect", { x: 3.5, y: 5, width: 17, height: 15.5, rx: 3 }], ["path", { d: "M3.5 10h17M8 3v4M16 3v4" }], ponto(12, 15, 1.4)],
  treinar: [["path", { d: "M3.5 19.5h4V15H12v-4.5h4.5V6h4" }]],
  rampa: [["path", { d: "M3.5 19.5h4V15H12v-4.5h4.5V6h4" }]],
  painel: [["rect", { x: 4, y: 12.5, width: 4, height: 7.5, rx: 1.2 }], ["rect", { x: 10, y: 4, width: 4, height: 16, rx: 1.2 }], ["rect", { x: 16, y: 8.5, width: 4, height: 11.5, rx: 1.2 }]],
  cola: [["rect", { x: 3.5, y: 4, width: 17, height: 16, rx: 2.5 }], ["path", { d: "M3.5 9.5h17M3.5 14.75h17M9.5 4v16" }]],
  perfil: [["circle", { cx: 12, cy: 8.5, r: 3.75 }], ["path", { d: "M4.5 20.5c.8-3.7 3.8-5.7 7.5-5.7s6.7 2 7.5 5.7" }]],
  mais: [["path", { d: "M12 5v14M5 12h14" }]],
  menos: [["path", { d: "M5 12h14" }]],
  play: [["path", { d: "M7.5 5.2v13.6a.9.9 0 0 0 1.4.8l10.4-6.8a.9.9 0 0 0 0-1.6L8.9 4.4a.9.9 0 0 0-1.4.8z" }]],
  pausa: [["rect", { x: 6.5, y: 5, width: 3.5, height: 14, rx: 1.2 }], ["rect", { x: 14, y: 5, width: 3.5, height: 14, rx: 1.2 }]],
  parar: [["rect", { x: 5.5, y: 5.5, width: 13, height: 13, rx: 2.5 }]],
  proximo: [["path", { d: "M5.5 5.8v12.4a.8.8 0 0 0 1.25.66L15.5 12.7a.8.8 0 0 0 0-1.4L6.75 5.14a.8.8 0 0 0-1.25.66zM18.5 5v14" }]],
  anterior: [["path", { d: "M18.5 5.8v12.4a.8.8 0 0 1-1.25.66L8.5 12.7a.8.8 0 0 1 0-1.4l8.75-6.16a.8.8 0 0 1 1.25.66zM5.5 5v14" }]],
  coracao: [["path", { d: "M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" }]],
  bluetooth: [["path", { d: "M7 7.5l10 9-5 4.5V3l5 4.5-10 9" }]],
  check: [["path", { d: "M5 12.5l4.5 4.5L19 7.5" }]],
  chevron: [["path", { d: "M9.5 5.5L16 12l-6.5 6.5" }]],
  voltar: [["path", { d: "M14.5 5.5L8 12l6.5 6.5" }]],
  abaixo: [["path", { d: "M5.5 9.5L12 16l6.5-6.5" }]],
  fechar: [["path", { d: "M6.5 6.5l11 11M17.5 6.5l-11 11" }]],
  exportar: [["path", { d: "M12 14.5v-11M7.5 8L12 3.5 16.5 8M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" }]],
  importar: [["path", { d: "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M5 14.5v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" }]],
  info: [["circle", { cx: 12, cy: 12, r: 8.5 }], ["path", { d: "M12 11v5.5" }], ponto(12, 7.9)],
  alerta: [["path", { d: "M10.3 4.4L3 17.4a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0z" }], ["path", { d: "M12 9.5v4.5" }], ponto(12, 17)],
  nuvem: [["path", { d: "M7.2 18.5a4 4 0 0 1-.6-7.95 5.5 5.5 0 0 1 10.7-1.3 4.6 4.6 0 0 1-.3 9.25z" }]],
  aparelho: [["rect", { x: 7, y: 2.5, width: 10, height: 19, rx: 2.5 }], ["path", { d: "M11 18.5h2" }]],
  relogio: [["circle", { cx: 12, cy: 12, r: 8.5 }], ["path", { d: "M12 7.5V12l3 2" }]],
  lixeira: [["path", { d: "M4.5 6.5h15M9.5 6.5v-2h5v2M6.5 6.5l.9 12.6a1.6 1.6 0 0 0 1.6 1.4h6a1.6 1.6 0 0 0 1.6-1.4l.9-12.6" }]],
  apagarTecla: [["path", { d: "M9.2 5.5H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9.2a1.5 1.5 0 0 1-1.1-.5L3 12l5.1-6a1.5 1.5 0 0 1 1.1-.5z" }], ["path", { d: "M11.5 9.5l5 5M16.5 9.5l-5 5" }]],
  subir: [["path", { d: "M7 17L17 7M9 7h8v8" }]],
  descer: [["path", { d: "M7 7l10 10M17 9v8H9" }]],
};

export const NOMES_ICONES = Object.keys(ICONES);

export function icone(nome, { tamanho = 24, rotulo, classe } = {}) {
  const partes = ICONES[nome] ?? ICONES.info;
  return s("svg", {
    class: ["icone", classe],
    width: tamanho,
    height: tamanho,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.75,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    role: rotulo ? "img" : null,
    "aria-label": rotulo,
    "aria-hidden": rotulo ? null : "true",
    focusable: "false",
  }, partes.map(([tag, attrs]) => s(tag, attrs)));
}

// ---------- Formatadores pt-BR ----------
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIAS_LONGOS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const cacheNum = new Map();

function formatadorNum(casas) {
  if (!cacheNum.has(casas)) {
    cacheNum.set(casas, new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }));
  }
  return cacheNum.get(casas);
}

const comoData = (d) => (d instanceof Date ? d : new Date(d));
const dois = (n) => String(n).padStart(2, "0");

export const formatar = {
  // "–" para ausente, para a tela nunca mostrar NaN.
  num(v, casas = 0) {
    if (v == null || !Number.isFinite(Number(v))) return "–";
    const n = Number(v);
    const texto = formatadorNum(casas).format(n);
    return texto === "-0" || /^-0,0+$/.test(texto) ? texto.slice(1) : texto;
  },
  // Com sinal explícito, para variações ("+2,1", "−0,4").
  delta(v, casas = 1) {
    if (v == null || !Number.isFinite(v)) return "–";
    const texto = formatar.num(Math.abs(v), casas);
    if (Number(texto.replace(",", ".")) === 0) return texto;
    return `${v > 0 ? "+" : "−"}${texto}`;
  },
  tempo(seg) {
    const total = Math.max(0, Math.round(Number(seg) || 0));
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    return hh ? `${hh}:${dois(mm)}:${dois(ss)}` : `${dois(mm)}:${dois(ss)}`;
  },
  // "27 min", "1 h 05 min".
  duracao(seg) {
    const min = Math.round((Number(seg) || 0) / 60);
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)} h ${dois(min % 60)} min`;
  },
  // "qua, 15 out"
  data(iso) {
    const d = comoData(iso);
    if (Number.isNaN(d.getTime())) return "–";
    return `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`;
  },
  // "quinta-feira, 15 de outubro"
  dataLonga(iso) {
    const d = comoData(iso);
    return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES_LONGOS[d.getMonth()]}`;
  },
  hora(iso) {
    const d = comoData(iso);
    return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
  },
  // Ritmo em min/km a partir de km/h: "12:00/km".
  ritmo(kmh) {
    if (!(kmh > 0)) return "–";
    const total = Math.round(3600 / kmh);
    return `${Math.floor(total / 60)}:${dois(total % 60)}/km`;
  },
  pct(v, casas = 0) {
    return `${formatar.num(v, casas)}%`;
  },
  // "agora", "há 40 s", "há 5 min", "há 2 h", "há 3 dias".
  relativo(ts, agora = Date.now()) {
    const seg = Math.max(0, Math.round((agora - comoData(ts).getTime()) / 1000));
    if (seg < 5) return "agora";
    if (seg < 60) return `há ${seg} s`;
    if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
    if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
    const dias = Math.floor(seg / 86400);
    return dias === 1 ? "ontem" : `há ${dias} dias`;
  },
};

// ---------- Lista agrupada ----------
export function grupo({ titulo, rodape, id } = {}, ...linhas) {
  const idTitulo = titulo ? novoId("grupo") : null;
  return h("section", { class: "grupo", id, "aria-labelledby": idTitulo },
    titulo && h("h2", { class: "grupo-titulo", id: idTitulo }, titulo),
    h("div", { class: "grupo-lista", role: "list" }, linhas),
    rodape && h("p", { class: "grupo-rodape" }, rodape),
  );
}

export function linha({ rotulo, valor, detalhe, icone: nomeIcone, onClick, acessorio, id, tom, rotuloAria } = {}) {
  const ehBotao = typeof onClick === "function";
  let acess = null;
  if (acessorio === "chevron") acess = h("span", { class: "linha-acessorio" }, icone("chevron", { tamanho: 18 }));
  else if (acessorio === "check") acess = h("span", { class: "linha-acessorio check" }, icone("check", { tamanho: 20, rotulo: "feito" }));
  else if (acessorio instanceof Node) acess = h("span", { class: "linha-acessorio" }, acessorio);

  const conteudo = [
    nomeIcone && h("span", { class: "linha-icone" }, typeof nomeIcone === "string" ? icone(nomeIcone, { tamanho: 22 }) : nomeIcone),
    h("span", { class: "linha-texto" },
      h("span", { class: "linha-rotulo" }, rotulo),
      detalhe && h("span", { class: "linha-detalhe" }, detalhe),
    ),
    valor != null && valor !== "" && h("span", { class: "linha-valor" }, valor),
    acess,
  ];
  const classes = ["linha", nomeIcone && "com-icone", tom && `linha--${tom}`];
  // O item da lista é um invólucro: role="listitem" no próprio <button> apagaria
  // o "botão" que o leitor de tela anuncia.
  const item = (no) => h("div", { class: ["linha-item", nomeIcone && "com-icone"], role: "listitem" }, no);
  if (ehBotao) {
    return item(h("button", { type: "button", class: classes, id, "aria-label": rotuloAria, "on:click": onClick }, conteudo));
  }
  return item(h("div", { class: classes, id }, conteudo));
}

// ---------- Cartão e métrica ----------
export function cartao({ titulo, acao, classe, id } = {}, ...conteudo) {
  let acaoNo = acao;
  if (acao && !(acao instanceof Node)) acaoNo = botao({ tipo: "texto", ...acao });
  return h("section", { class: ["cartao", classe], id },
    (titulo || acaoNo) && h("header", { class: "cartao-topo" },
      titulo && h("h3", { class: "cartao-titulo" }, titulo),
      acaoNo,
    ),
    conteudo.length ? h("div", { class: "cartao-corpo" }, conteudo) : null,
  );
}

// tamanho: 'pequena' | undefined (34 px) | 'grande' (44) | 'hero' (80).
export function metrica({ rotulo, valor, unidade, tom, tamanho, casas = 0, id } = {}) {
  const texto = typeof valor === "number" ? formatar.num(valor, casas) : (valor ?? "–");
  const el = h("div", { class: ["metrica", tamanho && `metrica--${tamanho}`, tom && `metrica--${tom}`], id },
    rotulo && h("span", { class: "metrica-rotulo" }, rotulo),
    h("span", { class: "metrica-valor" },
      h("span", { class: "num" }, texto),
      unidade && h("span", { class: "metrica-unidade" }, unidade),
    ),
  );
  // Atualiza só o número, sem recriar o nó (sessão ao vivo).
  el.definir = (v) => {
    el.querySelector(".num").textContent = typeof v === "number" ? formatar.num(v, casas) : (v ?? "–");
  };
  return el;
}

// ---------- Repetição ao segurar ----------
// Primeiro passo no toque; depois de 400 ms repete, acelerando até 120 ms.
function repetirAoSegurar(botaoEl, acao) {
  let espera = null;
  let usouPonteiro = false;
  const parar = () => {
    clearTimeout(espera);
    espera = null;
    botaoEl.classList.remove("segurando");
  };
  const repetir = (intervalo) => {
    espera = setTimeout(() => {
      if (acao() === false) return parar();
      repetir(Math.max(120, intervalo * 0.8));
    }, intervalo);
  };
  botaoEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || botaoEl.disabled) return;
    usouPonteiro = true;
    try {
      botaoEl.setPointerCapture?.(e.pointerId);
    } catch { /* ponteiro sintético ou WebView sem captura: repetir funciona sem ela */ }
    botaoEl.classList.add("segurando");
    acao();
    clearTimeout(espera);
    espera = setTimeout(() => repetir(260), 400 - 260);
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) botaoEl.addEventListener(ev, parar);
  botaoEl.addEventListener("contextmenu", (e) => e.preventDefault());
  // Teclado (Enter/Espaço) gera click com detail 0; o toque já foi tratado no pointerdown.
  botaoEl.addEventListener("click", (e) => {
    if (e.detail === 0 || !usouPonteiro) acao();
    usouPonteiro = false;
  });
}

// ---------- Stepper ----------
export function stepper({ id, rotulo, valor = 0, passo = 1, min = -Infinity, max = Infinity, casas = 0, unidade, onChange, grande = false, tituloTeclado } = {}) {
  id ??= novoId("stepper");
  let atual = valor;
  const idRotulo = `${id}-rotulo`;
  const ajustar = (v) => {
    const arred = Math.round(v / passo) * passo;
    return Number(Math.min(max, Math.max(min, arred)).toFixed(Math.max(casas, 2)));
  };
  const numEl = h("span", { class: "num" });
  const valorBtn = h("button", { type: "button", class: "stepper-valor", id: `${id}-valor` },
    numEl, unidade && h("span", { class: "stepper-unidade" }, unidade));
  const menos = h("button", { type: "button", class: "stepper-botao stepper-menos", id: `${id}-menos`, "aria-label": `Diminuir ${rotulo ?? ""}`.trim() },
    icone("menos", { tamanho: grande ? 32 : 22 }));
  const mais = h("button", { type: "button", class: "stepper-botao stepper-mais", id: `${id}-mais`, "aria-label": `Aumentar ${rotulo ?? ""}`.trim() },
    icone("mais", { tamanho: grande ? 32 : 22 }));

  const pintar = () => {
    numEl.textContent = formatar.num(atual, casas);
    valorBtn.setAttribute("aria-label", `${rotulo ?? "Valor"}: ${formatar.num(atual, casas)}${unidade ? " " + unidade : ""}. Tocar para digitar`);
    menos.disabled = atual <= min;
    mais.disabled = atual >= max;
  };
  const mudar = (novo, avisar = true) => {
    const v = ajustar(novo);
    if (v === atual) return false;
    atual = v;
    pintar();
    if (avisar) onChange?.(atual);
    return true;
  };

  repetirAoSegurar(menos, () => mudar(atual - passo));
  repetirAoSegurar(mais, () => mudar(atual + passo));
  valorBtn.addEventListener("click", async () => {
    const n = await pedirNumero({ titulo: tituloTeclado ?? rotulo ?? "Valor", valor: atual, unidade, casas, min, max });
    if (n != null) mudar(n);
  });

  const el = h("div", { class: ["stepper", grande && "stepper--grande"], id, role: "group", "aria-labelledby": rotulo ? idRotulo : null },
    rotulo && h("span", { class: "stepper-rotulo", id: idRotulo }, rotulo),
    h("div", { class: "stepper-controle" }, menos, valorBtn, mais),
  );
  atual = ajustar(valor);
  pintar();
  el.definir = (v) => mudar(v, false);
  el.obter = () => atual;
  return el;
}

// ---------- Segmentado ----------
export function segmentado({ id, opcoes = [], valor, onChange, rotulo } = {}) {
  id ??= novoId("seg");
  let atual = valor;
  const botoes = opcoes.map((op, k) => h("button", {
    type: "button",
    class: "segmentado-opcao",
    id: `${id}-${k}`,
    role: "radio",
    "data-valor": String(op.valor),
    "on:click": () => escolher(op.valor, true),
  }, op.rotulo));
  const pintar = () => botoes.forEach((b, k) => {
    const marcado = opcoes[k].valor === atual;
    b.setAttribute("aria-checked", String(marcado));
    b.tabIndex = marcado || (atual === undefined && k === 0) ? 0 : -1;
  });
  function escolher(v, avisar) {
    if (v === atual) return;
    atual = v;
    pintar();
    if (avisar) onChange?.(v);
  }
  const el = h("div", { class: "segmentado", id, role: "radiogroup", "aria-label": rotulo }, botoes);
  el.addEventListener("keydown", (e) => {
    const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!passo) return;
    e.preventDefault();
    const k = Math.max(0, opcoes.findIndex((o) => o.valor === atual));
    const novo = (k + passo + opcoes.length) % opcoes.length;
    escolher(opcoes[novo].valor, true);
    botoes[novo].focus();
  });
  pintar();
  el.definir = (v) => escolher(v, false);
  el.obter = () => atual;
  return el;
}

// ---------- Botão e chip ----------
export function botao({ rotulo, tipo = "secundario", icone: nomeIcone, onClick, grande, largo, id, desabilitado, rotuloAria, classe, submit } = {}) {
  return h("button", {
    type: submit ? "submit" : "button",
    class: ["botao", `botao--${tipo}`, grande && "botao--grande", largo && "botao--largo", !rotulo && nomeIcone && "botao--icone", classe],
    id,
    disabled: !!desabilitado,
    "aria-label": rotuloAria ?? (!rotulo ? nomeIcone : null),
    "on:click": onClick,
  }, nomeIcone && icone(nomeIcone, { tamanho: grande ? 24 : 20 }), rotulo);
}

export function chip({ rotulo, icone: nomeIcone, onClick, tom, id, rotuloAria } = {}) {
  const tag = onClick ? "button" : "span";
  return h(tag, {
    type: onClick ? "button" : null,
    class: ["chip", tom && `chip--${tom}`],
    id,
    "aria-label": rotuloAria,
    "on:click": onClick,
  }, nomeIcone && icone(nomeIcone, { tamanho: 18 }), rotulo);
}

// ---------- Camada (sheets, toasts, pílula) ----------
function camada() {
  let el = document.getElementById("camada");
  if (!el) {
    el = h("div", { id: "camada", class: "camada" });
    document.body.appendChild(el);
  }
  return el;
}

const pilhaSheets = [];
const FOCAVEIS = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const reduzirMovimento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// O resto da página fica inerte enquanto houver sheet aberta.
// Com a tela cheia aberta, app e abas continuam inertes depois que a sheet fecha.
function marcarFundo(inerte) {
  const telaCheia = document.getElementById("tela-cheia");
  const telaCheiaAberta = !!telaCheia && !telaCheia.hidden;
  for (const id of ["app", "abas", "tela-cheia"]) {
    const el = document.getElementById(id);
    if (!el) continue;
    const manter = !inerte && id !== "tela-cheia" && telaCheiaAberta;
    if (inerte || manter) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }
  document.getElementById("abas")?.classList.toggle("sob-sheet", inerte);
  document.documentElement.classList.toggle("com-sheet", inerte);
  document.documentElement.style.overflow = inerte || telaCheiaAberta ? "hidden" : "";
}

export function abrirSheet({ titulo, conteudo, acoes = [], aoFechar, rotulo, classe } = {}) {
  const idTitulo = novoId("sheet");
  const anterior = document.activeElement;
  let fechado = false;

  const fundo = h("div", { class: "sheet-fundo", "aria-hidden": "true" });
  const btnFechar = h("button", { type: "button", class: "sheet-fechar", "aria-label": "Fechar" },
    h("span", null, icone("fechar", { tamanho: 16 })));
  const topo = h("header", { class: "sheet-topo" },
    titulo && h("h2", { class: "sheet-titulo", id: idTitulo }, titulo),
    btnFechar,
  );
  const nosAcoes = acoes.map((a) => (a instanceof Node ? a : botao({
    largo: true,
    grande: true,
    ...a,
    onClick: () => a.onClick?.(fechar),
  })));
  const sheet = h("div", {
    class: ["sheet", classe],
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": titulo ? idTitulo : null,
    "aria-label": titulo ? null : (rotulo ?? "Painel"),
  },
    h("div", { class: "sheet-alca", "aria-hidden": "true" }),
    topo,
    h("div", { class: "sheet-corpo" }, conteudo),
    nosAcoes.length ? h("footer", { class: "sheet-acoes" }, nosAcoes) : null,
  );

  function fechar(resultado) {
    if (fechado) return;
    fechado = true;
    const i = pilhaSheets.indexOf(controle);
    if (i >= 0) pilhaSheets.splice(i, 1);
    sheet.classList.remove("aberto");
    sheet.style.transform = "";
    fundo.classList.remove("aberto");
    const remover = () => { sheet.remove(); fundo.remove(); };
    if (reduzirMovimento()) setTimeout(remover, 160);
    else {
      sheet.addEventListener("transitionend", remover, { once: true });
      setTimeout(remover, 450);
    }
    if (!pilhaSheets.length) marcarFundo(false);
    if (anterior && document.contains(anterior)) anterior.focus?.({ preventScroll: true });
    aoFechar?.(resultado);
  }
  const controle = { fechar, el: sheet };

  btnFechar.addEventListener("click", () => fechar());
  fundo.addEventListener("click", () => fechar());

  sheet.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      fechar();
      return;
    }
    if (e.key !== "Tab") return;
    const focaveis = [...sheet.querySelectorAll(FOCAVEIS)].filter((x) => x.offsetParent !== null);
    if (!focaveis.length) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  });

  // Arrastar a alça ou o topo para baixo fecha.
  let inicioY = null;
  let inicioT = 0;
  let dy = 0;
  const alca = sheet.querySelector(".sheet-alca");
  for (const area of [alca, topo]) {
    area.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".sheet-fechar")) return;
      inicioY = e.clientY;
      inicioT = performance.now();
      dy = 0;
      area.setPointerCapture?.(e.pointerId);
      sheet.classList.add("arrastando");
    });
    area.addEventListener("pointermove", (e) => {
      if (inicioY == null) return;
      dy = Math.max(0, e.clientY - inicioY);
      sheet.style.transform = `translateY(${dy}px)`;
    });
    const soltar = () => {
      if (inicioY == null) return;
      const velocidade = dy / Math.max(1, performance.now() - inicioT);
      inicioY = null;
      sheet.classList.remove("arrastando");
      if (dy > 110 || (dy > 30 && velocidade > 0.6)) fechar();
      else sheet.style.transform = "";
    };
    area.addEventListener("pointerup", soltar);
    area.addEventListener("pointercancel", soltar);
  }

  const raiz = camada();
  raiz.append(fundo, sheet);
  pilhaSheets.push(controle);
  marcarFundo(true);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    sheet.classList.add("aberto");
    fundo.classList.add("aberto");
    const corpo = sheet.querySelector(".sheet-corpo");
    const alvo = sheet.querySelector("[autofocus]") ?? corpo.querySelector(FOCAVEIS) ?? btnFechar;
    alvo.focus({ preventScroll: true });
  }));
  return controle;
}

export function confirmar({ titulo, mensagem, confirmar: rotuloOk = "Confirmar", cancelar = "Cancelar", perigo = false } = {}) {
  return new Promise((resolver) => {
    let resposta = false;
    abrirSheet({
      titulo,
      conteudo: mensagem ? h("p", { class: "sheet-mensagem" }, mensagem) : null,
      acoes: [
        { rotulo: rotuloOk, tipo: perigo ? "perigo" : "primario", onClick: (fechar) => { resposta = true; fechar(); } },
        { rotulo: cancelar, tipo: "secundario", onClick: (fechar) => fechar() },
      ],
      aoFechar: () => resolver(resposta),
    });
  });
}

// Teclado numérico próprio: teclas de 60 px, legíveis com a mão suada.
export function pedirNumero({ titulo = "Digite o valor", valor, unidade, casas = 0, min = -Infinity, max = Infinity } = {}) {
  return new Promise((resolver) => {
    let texto = valor != null && Number.isFinite(valor) ? formatar.num(valor, casas).replace(/\./g, "") : "";
    let substituir = true;
    let resposta = null;
    const visorNum = h("span", { class: "num", "aria-live": "polite" });
    const aviso = h("p", { class: "teclado-aviso", role: "status" });
    const ok = botao({ rotulo: "OK", tipo: "primario", largo: true, grande: true, onClick: () => confirmarValor() });

    const numero = () => (texto === "" || texto === "," ? null : Number(texto.replace(",", ".")));
    const pintar = () => {
      // Vazio mostra "–": "0" parecia um valor válido.
      visorNum.textContent = texto || "–";
      visorNum.classList.toggle("vazio-valor", !texto);
      const n = numero();
      let msg = "";
      if (n != null && (n < min || n > max)) {
        msg = Number.isFinite(min) && Number.isFinite(max)
          ? `Use um valor entre ${formatar.num(min, casas)} e ${formatar.num(max, casas)}`
          : n < min ? `Mínimo ${formatar.num(min, casas)}` : `Máximo ${formatar.num(max, casas)}`;
      }
      aviso.textContent = msg;
      ok.disabled = n == null || !!msg;
    };
    const digitar = (t) => {
      if (substituir) { texto = ""; substituir = false; }
      if (t === "⌫") texto = texto.slice(0, -1);
      else if (t === "C") texto = "";
      else if (t === ",") { if (casas > 0 && !texto.includes(",")) texto = (texto || "0") + ","; }
      else {
        const [, dec = null] = texto.split(",");
        if (dec != null && dec.length >= casas) return pintar();
        if (texto.replace(",", "").length >= 6) return pintar();
        texto = texto === "0" ? t : texto + t;
      }
      pintar();
    };
    function confirmarValor() {
      const n = numero();
      if (n == null || n < min || n > max) return;
      resposta = Number(n.toFixed(casas));
      sheet.fechar();
    }

    // Sem casas decimais, a tecla da vírgula vira "Limpar".
    const canto = casas > 0 ? "," : "C";
    const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", canto, "0", "⌫"].map((t) => h("button", {
      type: "button",
      class: ["teclado-tecla", t === "C" && "teclado-tecla--limpar"],
      "aria-label": t === "⌫" ? "Apagar" : t === "," ? "Vírgula" : null,
      "on:click": () => digitar(t),
    }, t === "⌫" ? icone("apagarTecla", { tamanho: 28 }) : t === "C" ? "Limpar" : t));

    const conteudo = h("div", { class: "teclado" },
      h("div", { class: "teclado-visor" }, visorNum, unidade && h("span", { class: "teclado-unidade" }, unidade)),
      aviso,
      h("div", { class: "teclado-teclas" }, teclas),
    );
    const sheet = abrirSheet({
      titulo,
      conteudo,
      acoes: [ok],
      aoFechar: () => resolver(resposta),
    });
    sheet.el.addEventListener("keydown", (e) => {
      if (/^[0-9]$/.test(e.key)) digitar(e.key);
      else if (e.key === "," || e.key === ".") digitar(",");
      else if (e.key === "Backspace") digitar("⌫");
      // Enter confirma mesmo com uma tecla focada; Espaço continua acionando a tecla.
      else if (e.key === "Enter" && !e.target.closest(".sheet-fechar")) confirmarValor();
      else return;
      e.preventDefault();
    });
    pintar();
  });
}

// ---------- Toast e pílula ----------
export function toast(texto, { duracao = 2800 } = {}) {
  let area = document.querySelector(".toasts");
  if (!area) {
    area = h("div", { class: "toasts", role: "status", "aria-live": "polite" });
    camada().appendChild(area);
  }
  const el = h("div", { class: "toast" }, texto);
  area.appendChild(el);
  setTimeout(() => {
    el.classList.add("saindo");
    setTimeout(() => el.remove(), 220);
  }, duracao);
  return el;
}

// Aviso escuro que desce do topo (troca de fase na sessão ao vivo).
let pilulaAtual = null;
export function pilula(texto, { duracao = 2000 } = {}) {
  pilulaAtual?.remove();
  const el = h("div", { class: "pilula", role: "status", "aria-live": "assertive" }, texto);
  pilulaAtual = el;
  camada().appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("visivel")));
  setTimeout(() => {
    el.classList.remove("visivel");
    setTimeout(() => { el.remove(); if (pilulaAtual === el) pilulaAtual = null; }, 320);
  }, duracao);
  return el;
}

// ---------- Estado vazio ----------
// Arte: uma rampa de cinco degraus na escala de intensidade.
function arteRampa() {
  const alturas = [10, 18, 26, 34, 42];
  return s("svg", { class: "vazio-arte", width: 120, height: 48, viewBox: "0 0 120 48", "aria-hidden": "true" },
    alturas.map((alt, k) => s("rect", {
      x: k * 24 + 0.5,
      y: 48 - alt,
      width: 23,
      height: alt,
      rx: 3,
      fill: `var(--int-${k + 1})`,
    })),
  );
}

export function vazio({ titulo, texto, acao, arte } = {}) {
  let acaoNo = acao;
  if (acao && !(acao instanceof Node)) acaoNo = botao({ tipo: "primario", ...acao });
  return h("div", { class: "vazio" },
    arte === false ? null : (arte instanceof Node ? arte : arteRampa()),
    titulo && h("h2", { class: "vazio-titulo" }, titulo),
    texto && h("p", { class: "vazio-texto" }, texto),
    acaoNo,
  );
}

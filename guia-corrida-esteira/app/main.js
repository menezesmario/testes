// Boot, tab bar, troca de telas e abertura da sessão em tela cheia.
// Navegação por estado: o hash só é lido uma vez, no boot.

import * as ui from "./ui.js";
import * as sensores from "./sensores.js";
import * as rampa from "./rampa.js";
import { TREINOS } from "../src/treinos.js";
import { estado, assinar, iniciar, lerRascunho, apagarRascunho } from "./estado.js";

const ABAS = [
  { id: "hoje", icone: "hoje", carregar: () => import("./telas/hoje.js") },
  { id: "painel", icone: "painel", carregar: () => import("./telas/painel.js") },
  { id: "cola", icone: "cola", carregar: () => import("./telas/cola.js") },
  { id: "perfil", icone: "perfil", carregar: () => import("./telas/perfil.js") },
];

const $ = (id) => document.getElementById(id);
const el = {
  app: $("app"),
  topo: $("topo"),
  marca: $("topo-marca"),
  tituloPequeno: $("titulo-pequeno"),
  armazenamento: $("armazenamento"),
  tituloGrande: $("titulo-grande"),
  titulo: $("titulo"),
  subtitulo: $("subtitulo"),
  aviso: $("aviso-exemplo"),
  conteudo: $("conteudo"),
  abas: $("abas"),
  telaCheia: $("tela-cheia"),
};

const telas = new Map(); // id → { tela, no }
const rolagem = {};
let abaAtual = null;

// ---------- ctx entregue às telas ----------
const ctx = {
  estado,
  ui,
  sensores,
  rampa,
  navegar,
  iniciarTreino,
  abrirCola,
  abrirTelaCheia,
  atualizarCabecalho,
};

// ---------- Cabeçalho ----------
const ler = (v) => (typeof v === "function" ? v() : v);

function atualizarCabecalho() {
  const tela = telas.get(abaAtual)?.tela;
  const titulo = ler(tela?.titulo) ?? "";
  const subtitulo = ler(tela?.subtitulo) ?? "";
  el.titulo.textContent = titulo;
  el.tituloPequeno.textContent = titulo;
  el.subtitulo.textContent = subtitulo;
}

// Large title encolhe e some ao rolar; a barra ganha vidro e o título pequeno.
let rolagemPendente = false;
function aoRolar() {
  if (rolagemPendente) return;
  rolagemPendente = true;
  requestAnimationFrame(() => {
    rolagemPendente = false;
    const y = Math.max(0, window.scrollY);
    const k = Math.min(1, y / 56);
    el.tituloGrande.style.transform = k ? `scale(${(1 - 0.1 * k).toFixed(3)})` : "";
    el.tituloGrande.style.opacity = k ? String(1 - 0.7 * k) : "";
    el.topo.classList.toggle("rolado", y > el.tituloGrande.offsetHeight - 12);
  });
}

// ---------- Indicador de armazenamento e aviso de exemplo ----------
const MODOS = {
  conta: { icone: "nuvem", texto: "Conta", explicacao: "Dados salvos na sua conta do Claude." },
  aparelho: { icone: "aparelho", texto: "Aparelho", explicacao: "Dados salvos só neste aparelho. Exporte um backup no Perfil." },
  carregando: { icone: "nuvem", texto: "Carregando", explicacao: "Carregando seus dados." },
};

function pintarArmazenamento() {
  const modo = MODOS[estado.modoArmazenamento] ?? MODOS.carregando;
  el.armazenamento.dataset.modo = estado.modoArmazenamento;
  el.armazenamento.querySelector(".armazenamento-icone").replaceChildren(ui.icone(modo.icone, { tamanho: 16 }));
  el.armazenamento.querySelector(".armazenamento-texto").textContent = modo.texto;
  el.armazenamento.setAttribute("aria-label", modo.explicacao);
}

function pintarAviso() {
  let no = null;
  if (abaAtual !== "perfil" && estado.perfilExemplo) {
    no = ui.h("button", { type: "button", class: "aviso-exemplo", id: "aviso-exemplo-botao", "on:click": () => navegar("perfil") },
      ui.icone("info", { tamanho: 20 }),
      ui.h("span", null, "Exemplo — toque para preencher seus dados"),
      ui.icone("chevron", { tamanho: 18 }),
    );
  } else if (abaAtual !== "perfil" && estado.exemplo && estado.carregado) {
    no = ui.h("div", { class: "aviso-exemplo" },
      ui.icone("info", { tamanho: 20 }),
      ui.h("span", null, "Sessões de exemplo. Somem quando você salvar o primeiro treino."),
    );
  }
  el.aviso.replaceChildren(...(no ? [no] : []));
}

// ---------- Telas ----------
async function obterTela(id) {
  if (telas.has(id)) return telas.get(id);
  const def = ABAS.find((a) => a.id === id);
  let tela;
  try {
    const modulo = await def.carregar();
    tela = modulo.criarTela(ctx);
  } catch (erro) {
    console.error(erro);
    tela = {
      titulo: el.abas.querySelector(`[data-aba="${id}"]`)?.textContent.trim() ?? "",
      el: ui.vazio({ titulo: "Esta aba não abriu", texto: "Recarregue a página. Se continuar, os dados estão a salvo." }),
    };
  }
  const no = ui.h("section", { class: `tela tela-${id}`, "data-tela": id }, tela.el);
  no.hidden = true;
  el.conteudo.appendChild(no);
  const item = { tela, no };
  telas.set(id, item);
  return item;
}

async function navegar(id) {
  if (!ABAS.some((a) => a.id === id)) id = "hoje";
  if (id === abaAtual) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const anterior = abaAtual ? telas.get(abaAtual) : null;
  if (anterior) {
    rolagem[abaAtual] = window.scrollY;
    anterior.tela.aoOcultar?.();
    anterior.no.hidden = true;
  }
  abaAtual = id;
  for (const botao of el.abas.querySelectorAll(".aba")) {
    if (botao.dataset.aba === id) botao.setAttribute("aria-current", "page");
    else botao.removeAttribute("aria-current");
  }
  const item = await obterTela(id);
  if (abaAtual !== id) return;
  item.no.hidden = false;
  atualizarCabecalho();
  pintarAviso();
  item.tela.aoMostrar?.();
  window.scrollTo(0, rolagem[id] ?? 0);
  aoRolar();
}

// ---------- Tela cheia (sessão ao vivo, T7) ----------
function abrirTelaCheia(conteudo, { rotulo = "Treino", aoFechar } = {}) {
  el.telaCheia.replaceChildren(conteudo);
  el.telaCheia.setAttribute("aria-label", rotulo);
  el.telaCheia.hidden = false;
  el.app.setAttribute("inert", "");
  el.abas.setAttribute("inert", "");
  el.abas.classList.add("escondida");
  document.documentElement.style.overflow = "hidden";
  let fechada = false;
  return {
    el: el.telaCheia,
    fechar() {
      if (fechada) return;
      fechada = true;
      el.telaCheia.hidden = true;
      el.telaCheia.replaceChildren();
      el.app.removeAttribute("inert");
      el.abas.removeAttribute("inert");
      el.abas.classList.remove("escondida");
      document.documentElement.style.overflow = "";
      aoFechar?.();
    },
  };
}

// sessaoPlano: item do PLANO ({ id, treino, ... }) ou treino livre ({ treino, ...parâmetros }).
async function iniciarTreino(sessaoPlano) {
  const modulo = await import("./telas/treinar.js");
  return modulo.abrirSessao(ctx, {
    treino: sessaoPlano.treino,
    planoRef: sessaoPlano.id ?? null,
    sessaoPlano,
  });
}

async function abrirCola() {
  const modulo = await import("./telas/cola.js");
  return ui.abrirSheet({ titulo: "Cola", conteudo: modulo.conteudoCola(ctx, { compacto: true }) });
}

function oferecerRascunho() {
  const rascunho = lerRascunho();
  if (!rascunho) return;
  const nome = TREINOS[rascunho.treino]?.nome;
  const partes = [
    rascunho.treino && nome ? `${rascunho.treino} · ${nome}` : "Treino",
    Number.isFinite(rascunho.segTotal) ? `${ui.formatar.tempo(rascunho.segTotal)} feitos` : null,
    rascunho.salvoEm ? `salvo ${ui.formatar.relativo(rascunho.salvoEm)}` : null,
  ].filter(Boolean);
  ui.abrirSheet({
    titulo: "Treino interrompido",
    conteudo: ui.h("p", { class: "sheet-mensagem" }, partes.join(" · ")),
    acoes: [
      {
        rotulo: "Continuar treino",
        tipo: "primario",
        onClick: async (fechar) => {
          fechar();
          const modulo = await import("./telas/treinar.js");
          modulo.retomarRascunho(ctx, rascunho);
        },
      },
      {
        rotulo: "Descartar",
        tipo: "perigo",
        onClick: (fechar) => {
          apagarRascunho();
          fechar();
          ui.toast("Treino descartado");
        },
      },
    ],
  });
}

// ---------- Boot ----------
function montarShell() {
  for (const botao of el.abas.querySelectorAll(".aba")) {
    const def = ABAS.find((a) => a.id === botao.dataset.aba);
    botao.querySelector(".aba-icone").replaceChildren(ui.icone(def.icone, { tamanho: 24 }));
    botao.addEventListener("click", () => navegar(def.id));
  }
  // Marca: uma rampa de cinco degraus, do Leve ao Máxima.
  const fasesMarca = [45, 55, 65, 78, 92].map((pct) => ({ segundos: 1, alvo: { de: pct - 1, ate: pct + 1 } }));
  el.marca.replaceChildren(rampa.perfilRampa(fasesMarca, { largura: 28, altura: 18, rotulo: "Esteira" }));
  el.armazenamento.addEventListener("click", () => {
    ui.toast((MODOS[estado.modoArmazenamento] ?? MODOS.carregando).explicacao);
  });
  window.addEventListener("scroll", aoRolar, { passive: true });
  // O áudio só pode começar depois de um gesto do usuário.
  document.addEventListener("pointerdown", () => sensores.prepararAudio(), { once: true, capture: true });
}

function boot() {
  montarShell();
  pintarArmazenamento();
  assinar(() => {
    pintarArmazenamento();
    pintarAviso();
  });
  const hash = location.hash.replace("#", "");
  navegar(ABAS.some((a) => a.id === hash) ? hash : "hoje");
  // Primeira pintura com o exemplo; os dados reais chegam depois.
  iniciar().catch((erro) => console.error(erro));
  setTimeout(oferecerRascunho, 400);
}

boot();

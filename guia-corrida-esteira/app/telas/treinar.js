// Sessão ao vivo em tela cheia, resumo final e resultado do T7.
// O motor (app/motor.js) cuida do tempo e das contas; aqui só a tela.
// Celular em pé no console, a 50–70 cm: nada rola, números grandes, e o que
// muda a cada segundo é atualizado no lugar, sem recriar nós.

import { TREINOS } from "../../src/treinos.js";
import { resumirSessao } from "../../src/resumo.js";
import { ML_POR_MET } from "../../src/calculadora.js";
import { criarSessao, sessaoSalvavel, LIMITES } from "../motor.js";

// Escala do trilho, em % do VO2máx.
const ESCALA = { de: 30, ate: 100 };
const RASCUNHO_A_CADA_MS = 15000;
const SEGURAR_MS = 600;
const FC_ANTIGA_MS = 15000;

// Estado em palavras nas fases sem alvo: diz o que fazer, não só "sem alvo".
const SEM_ALVO = {
  aquecimento: "sem alvo · aqueça",
  volta: "sem alvo · desacelere",
  recuperacao: "sem alvo · recupere",
  estagio: "sem alvo · mantenha a velocidade",
};
const ICONE_SITUACAO = { abaixo: "subir", acima: "descer", "na-faixa": "check" };

const PALAVRAS_RPE = [
  "repouso", "muito leve", "leve", "moderado", "um pouco forte", "forte",
  "forte", "muito forte", "muito forte", "quase máximo", "máximo",
];

const ERROS_T7 = {
  "sem-fc": "Sem FC do estágio 2, não deu para calcular. Repita o teste digitando a FC nos minutos 3 e 4.",
  velocidade: "A velocidade média do estágio 2 ficou fora de 3,2–7,2 km/h. O teste só vale caminhando nessa faixa.",
  perfil: "Faltam idade e sexo no Perfil para calcular o VO2máx.",
};

let aberta = null; // só uma sessão ao vivo por vez

const nomeTreino = (treino) => `${treino} · ${TREINOS[treino]?.nome ?? "Treino"}`;

export function abrirSessao(ctx, { treino, planoRef = null, sessaoPlano, rascunho = null } = {}) {
  if (aberta) return aberta;
  const { ui, sensores, rampa, estado } = ctx;
  const { h, s, icone, formatar } = ui;
  const num = (v, casas = 0) => formatar.num(v, casas);
  // 57,5 aparece com decimal; 60 não.
  const pct1 = (v) => formatar.num(v, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1);

  const motor = rascunho?.estado
    ? criarSessao({ rascunho })
    : criarSessao({ treino, planoRef, sessaoPlano: sessaoPlano ?? { treino }, perfil: estado.perfilEfetivo() });
  const e = motor.estado;
  treino = rascunho?.treino ?? treino;
  const ehT7 = treino === "T7";
  const perfilExemplo = !!estado.perfilExemplo;

  let conexaoBt = null;
  let timerRascunho = null;
  let resumoAberto = false;
  let fechado = false;
  const desligar = [];

  // ---------- Barra superior ----------
  const cronometro = h("span", { class: "vivo-cronometro num" }, "00:00");
  const estadoPausa = h("span", { class: "vivo-pausa-rotulo" }, "Pausado");
  const barra = h("header", { class: "vivo-barra" },
    h("button", { type: "button", class: "vivo-icone-botao", id: "vivo-opcoes", "aria-label": "Opções do treino", "on:click": abrirOpcoes },
      icone("voltar", { tamanho: 26 })),
    h("div", { class: "vivo-titulo" },
      h("span", { class: "vivo-nome" }, nomeTreino(treino)),
      h("span", { class: "vivo-tempo" }, estadoPausa, cronometro),
    ),
    h("button", { type: "button", class: "vivo-icone-botao", id: "vivo-cola", "aria-label": "Abrir a Cola", "on:click": () => ctx.abrirCola() },
      icone("cola", { tamanho: 24 })),
  );

  // ---------- Perfil de rampa ----------
  const caixaRampa = h("div", { class: "vivo-rampa" });
  let perfil = null;
  const totalPlano = () => e.fases.reduce((soma, f) => soma + f.segundos, 0);
  const decorridoPlano = () => e.fases.slice(0, e.iFase).reduce((soma, f) => soma + f.segundos, 0) + Math.min(e.segFase, e.fases[e.iFase].segundos);
  function desenharRampa() {
    perfil = rampa.perfilRampa(e.fases, { altura: 64, progresso: decorridoPlano() / totalPlano(), mostrarCursor: true, rotulo: `Perfil do treino, ${e.fases.length} fases` });
    caixaRampa.replaceChildren(perfil);
  }

  // ---------- Legenda da fase ----------
  const faseNome = h("p", { class: "vivo-fase" });
  const faseDetalhe = h("p", { class: "vivo-fase-detalhe" });
  const restaNum = h("span", { class: "num" }, "0:00");
  const restaRotulo = h("span", { class: "vivo-resta-rotulo" }, "resta");
  const legenda = h("div", { class: "vivo-legenda" },
    h("div", { class: "vivo-legenda-texto" }, faseNome, faseDetalhe),
    h("div", { class: "vivo-resta" }, restaNum, restaRotulo),
  );

  // ---------- Números dominantes ----------
  const mPct = ui.metrica({ rotulo: "% do VO2máx", valor: null, unidade: "%", tamanho: "hero", id: "vivo-pct" });
  const mMets = ui.metrica({ rotulo: "METs", valor: null, casas: 1, tamanho: "grande", id: "vivo-mets" });
  const numeros = h("div", { class: "vivo-numeros" }, mPct, mMets);

  // ---------- Trilho com faixa-alvo ----------
  const posicao = (pct) => ((Math.min(ESCALA.ate, Math.max(ESCALA.de, pct)) - ESCALA.de) / (ESCALA.ate - ESCALA.de)) * 100;
  const faixaEl = h("span", { class: "vivo-trilho-faixa" });
  const pontoEl = h("span", { class: "vivo-cursor-ponto" });
  const cursorEl = h("span", { class: "vivo-cursor" }, pontoEl);
  const marcas = [];
  const rotulosEscala = [];
  for (let p = ESCALA.de; p <= ESCALA.ate; p += 5) {
    marcas.push(h("span", { class: ["vivo-marca", p % 10 === 0 && "vivo-marca--forte"], style: { left: `${posicao(p)}%` } }));
    if (p % 10 === 0) {
      rotulosEscala.push(h("span", { class: ["num", p === ESCALA.de && "vivo-escala-inicio", p === ESCALA.ate && "vivo-escala-fim"], style: { left: `${posicao(p)}%` } }, String(p)));
    }
  }
  // Estado (o que fazer agora, com cor e ícone) e dica do protocolo (como
  // fazer, discreta) ficam em linhas separadas, numa zona de altura fixa.
  const estadoIcone = h("span", { class: "vivo-estado-icone", "aria-hidden": "true" });
  const estadoFrase = h("span", null);
  const estadoTexto = h("p", { class: "vivo-estado", id: "vivo-estado", "aria-live": "polite" }, estadoIcone, estadoFrase);
  const dicaTexto = h("p", { class: "vivo-dica", id: "vivo-dica" });
  const trilho = h("div", { class: "vivo-faixa" },
    h("div", { class: "vivo-trilho", "aria-hidden": "true" },
      h("span", { class: "vivo-trilho-base" }, faixaEl, marcas),
      cursorEl,
    ),
    h("div", { class: "vivo-escala", "aria-hidden": "true" }, rotulosEscala),
    h("div", { class: "vivo-mensagens" }, estadoTexto, dicaTexto),
  );

  // ---------- Controles ----------
  const stVel = ui.stepper({
    id: "vivo-velocidade",
    rotulo: "Velocidade",
    valor: e.velocidade,
    passo: 0.1,
    casas: 1,
    min: LIMITES.velocidade.min,
    max: LIMITES.velocidade.max,
    unidade: "km/h",
    grande: true,
    onChange: (v) => {
      motor.definirVelocidade(v);
      pintar();
    },
  });
  const stInc = ui.stepper({
    id: "vivo-inclinacao",
    rotulo: "Inclinação",
    valor: e.inclinacao,
    passo: 0.5,
    casas: 1,
    min: LIMITES.inclinacao.min,
    max: LIMITES.inclinacao.max,
    unidade: "%",
    grande: true,
    onChange: (v) => {
      motor.definirInclinacao(v);
      pintar();
    },
  });
  const controles = h("div", { class: "vivo-controles" }, stVel, stInc);

  // ---------- FC e sugestão ----------
  const fcNum = h("span", { class: "num" }, "–");
  const fcDetalhe = h("span", { class: "vivo-fc-detalhe" }, "digitar");
  const fcBotao = h("button", { type: "button", class: "vivo-fc", id: "vivo-fc", "on:click": digitarFc },
    icone("coracao", { tamanho: 22 }),
    h("span", { class: "vivo-fc-valor" }, fcNum, h("span", { class: "vivo-fc-unidade" }, "bpm")),
    fcDetalhe,
  );
  const btBotao = sensores.fcBluetooth.disponivel()
    ? h("button", { type: "button", class: "vivo-icone-botao vivo-bt", id: "vivo-bt", "aria-label": "Conectar FC por Bluetooth", "on:click": alternarBluetooth },
      icone("bluetooth", { tamanho: 24 }))
    : null;
  const sugestaoCaixa = h("span", { class: "vivo-sugestao" });
  const linhaFc = h("div", { class: "vivo-fc-linha" }, fcBotao, btBotao, sugestaoCaixa);
  const pedidoFc = h("button", { type: "button", class: "vivo-pedido-fc", id: "vivo-pedido-fc", hidden: true, "on:click": digitarFc });
  const zonaFc = h("div", { class: "vivo-zona-fc" }, linhaFc, pedidoFc);

  // ---------- Base: encerrar, pausar, pular ----------
  const pausarIcone = h("span", { class: "vivo-pausar-icone" });
  const pausarRotulo = h("span", null, "Pausar");
  const pausarBotao = h("button", { type: "button", class: "vivo-pausar", id: "vivo-pausar", "aria-label": "Pausar", "on:click": alternarPausa }, pausarIcone);
  const encerrar = botaoSegurar();
  const base = h("div", { class: "vivo-base" },
    h("div", { class: "vivo-acao" }, encerrar.botao, encerrar.rotulo),
    h("div", { class: "vivo-acao" }, pausarBotao, pausarRotulo),
    h("div", { class: "vivo-acao" },
      h("button", { type: "button", class: "vivo-redondo", id: "vivo-pular", "aria-label": "Pular para a próxima fase", "on:click": () => { motor.pularFase(); pintar(); } },
        icone("proximo", { tamanho: 26 })),
      h("span", null, "Pular"),
    ),
  );

  const raiz = h("div", { class: ["vivo", ehT7 && "vivo--t7"], id: "vivo" },
    h("div", { class: "vivo-coluna" }, barra, caixaRampa, legenda, numeros, trilho, controles, zonaFc, base),
  );

  // ---------- Pintura ----------
  const memoria = {};
  // Escreve só quando muda: o leitor de tela não repete o aviso a cada segundo.
  function escrever(chave, el, texto) {
    if (memoria[chave] === texto) return;
    memoria[chave] = texto;
    el.textContent = texto;
  }

  function faixaTexto(alvo) {
    if (!alvo) return null;
    if (alvo.ate >= 100) return `${pct1(alvo.de)}%+`;
    return `${pct1(alvo.de)}–${pct1(alvo.ate)}%`;
  }

  function textoEstado(l) {
    const fase = motor.fase;
    if (ehT7 && e.t7?.resultado && fase.tipo === "volta") {
      const r = e.t7.resultado;
      return r.vo2max ? `VO2máx estimado ${num(r.vo2max, 1)} · veja no resumo` : "Sem resultado do teste · veja no resumo";
    }
    if (ehT7 && e.t7?.pendente != null) return "Mantenha a velocidade e digite a FC";
    if (l.situacao === "sem-alvo") {
      if (fase.alvo && !motor.perfil.vo2max) return "Sem VO2máx: preencha o Perfil";
      return SEM_ALVO[fase.tipo] ?? "sem alvo";
    }
    if (l.situacao === "na-faixa") return "na faixa";
    const verbo = l.situacao === "abaixo" ? "suba" : "baixe";
    if (l.kmhSugerida != null && (fase.inclinacaoFixa != null || l.inclinacaoSugerida === e.inclinacao)) {
      // Nos tiros (modo auto), perto de 6,5 km/h a troca caminhada/corrida pula a
      // faixa inteira: já na velocidade mais próxima, "baixe para" a mesma seria absurdo.
      if (l.semVelocidadeNaFaixa && Math.abs(l.kmhSugerida - e.velocidade) < 0.05) {
        return `${l.situacao} · a ${num(e.inclinacao, 1)}% nenhuma velocidade fica na faixa`;
      }
      return `${l.situacao} · ${verbo} para ${num(l.kmhSugerida, 1)} km/h`;
    }
    return `${l.situacao} · ${verbo} para ${num(l.inclinacaoSugerida, 1)}%`;
  }

  function pintarSugestao(l) {
    const foraDaFaixa = l.situacao === "abaixo" || l.situacao === "acima";
    let alvoV = null;
    let alvoI = null;
    if (foraDaFaixa && l.kmhSugerida != null && Math.abs(l.kmhSugerida - e.velocidade) >= 0.05) {
      alvoV = l.kmhSugerida;
      alvoI = l.inclinacaoSugerida;
    } else if (foraDaFaixa && l.inclinacaoSugerida != null && l.inclinacaoSugerida !== e.inclinacao && motor.fase.inclinacaoFixa == null) {
      alvoI = l.inclinacaoSugerida;
    }
    const chave = alvoV == null && alvoI == null ? "" : `${alvoV}|${alvoI}|${Math.round(l.pctSugerido)}`;
    if (memoria.sugestao === chave) return;
    memoria.sugestao = chave;
    if (!chave) return sugestaoCaixa.replaceChildren();
    const subir = l.situacao === "abaixo";
    const valorTexto = alvoV != null ? `${num(alvoV, 1)} km/h` : `${num(alvoI, 1)}%`;
    sugestaoCaixa.replaceChildren(ui.chip({
      id: "vivo-sugestao",
      tom: "destaque",
      icone: subir ? "subir" : "descer",
      rotulo: [h("span", { class: "num" }, valorTexto), h("span", { class: "vivo-chip-pct" }, ` → ${num(l.pctSugerido)}%`)],
      rotuloAria: `Aplicar ${valorTexto}${alvoV != null && alvoI != null ? ` a ${num(alvoI, 1)}%` : ""}. Leva a ${num(l.pctSugerido)}% do VO2máx`,
      onClick: () => {
        if (alvoV != null) stVel.definir(motor.definirVelocidade(alvoV));
        if (alvoI != null) stInc.definir(motor.definirInclinacao(alvoI));
        sensores.vibrar(30);
        pintar();
      },
    }));
  }

  function pintarFc() {
    escrever("fc", fcNum, e.fc != null ? String(e.fc) : "–");
    let detalhe = "digitar";
    if (e.fc != null) {
      const idade = Date.now() - e.fcEm;
      if (e.fcOrigem === "bluetooth" && conexaoBt && idade < FC_ANTIGA_MS) detalhe = conexaoBt.nome;
      else detalhe = idade >= FC_ANTIGA_MS ? formatar.relativo(e.fcEm) : "agora";
    }
    escrever("fcDetalhe", fcDetalhe, detalhe);
    fcBotao.setAttribute("aria-label", e.fc != null ? `FC ${e.fc} bpm, ${detalhe}. Tocar para digitar` : "FC: tocar para digitar");
    if (btBotao) {
      btBotao.classList.toggle("vivo-bt--ligado", !!conexaoBt);
      btBotao.setAttribute("aria-label", conexaoBt ? `Desconectar ${conexaoBt.nome}` : "Conectar FC por Bluetooth");
    }
    const pendente = ehT7 ? e.t7?.pendente : null;
    linhaFc.hidden = pendente != null;
    pedidoFc.hidden = pendente == null;
    if (pendente != null) escrever("pedido", pedidoFc, `Digite a FC do minuto ${num(pendente / 60)}`);
  }

  function pintarFase() {
    const fase = motor.fase;
    const partes = [`fase ${e.iFase + 1} de ${e.fases.length}`];
    const faixa = faixaTexto(fase.alvo);
    if (faixa) partes.push(`alvo ${faixa}`);
    else if (fase.inclinacaoFixa != null) partes.push(`a ${num(fase.inclinacaoFixa, 1)}%`);
    escrever("faseNome", faseNome, fase.rotulo);
    escrever("faseDetalhe", faseDetalhe, partes.join(" · "));
    if (fase.alvo) {
      faixaEl.hidden = false;
      const de = posicao(fase.alvo.de);
      faixaEl.style.left = `${de}%`;
      faixaEl.style.width = `${posicao(Math.min(fase.alvo.ate, ESCALA.ate)) - de}%`;
      raiz.style.setProperty("--vivo-alvo", rampa.corFase(fase));
    } else {
      faixaEl.hidden = true;
    }
  }

  function pintar() {
    if (fechado) return;
    const l = motor.leituras();
    const fase = motor.fase;
    escrever("crono", cronometro, formatar.tempo(e.segTotal));
    const esperandoFc = ehT7 && e.t7?.pendente != null && e.segFase >= fase.segundos;
    escrever("resta", restaNum, esperandoFc ? "0:00" : formatar.tempo(motor.restanteFase).replace(/^0(\d)/, "$1"));
    restaNum.classList.toggle("vivo-resta--contagem", e.rodando && motor.restanteFase <= 3 && !esperandoFc);
    escrever("restaRotulo", restaRotulo, esperandoFc ? "aguardando FC" : "resta");
    pintarFase();

    mPct.definir(l.pctVO2 != null ? Math.round(l.pctVO2) : null);
    mMets.definir(l.mets);
    if (l.pctVO2 != null) {
      cursorEl.hidden = false;
      cursorEl.style.transform = `translateX(${posicao(l.pctVO2).toFixed(2)}%)`;
    } else cursorEl.hidden = true;
    raiz.dataset.situacao = l.situacao;
    escrever("estado", estadoFrase, textoEstado(l));
    if (memoria.icone !== l.situacao) {
      memoria.icone = l.situacao;
      estadoIcone.replaceChildren(...(ICONE_SITUACAO[l.situacao] ? [icone(ICONE_SITUACAO[l.situacao], { tamanho: 20 })] : []));
    }
    escrever("dica", dicaTexto, fase.dica ?? "");
    // Tom de fundo: a intensidade em que você está agora.
    const nivel = l.pctVO2 != null ? rampa.nivelIntensidade(l.pctVO2) : null;
    raiz.style.setProperty("--vivo-tom", nivel ? rampa.corIntensidade(nivel) : rampa.corFase(fase));

    if (stVel.obter() !== e.velocidade) stVel.definir(e.velocidade);
    if (stInc.obter() !== e.inclinacao) stInc.definir(e.inclinacao);
    pintarSugestao(l);
    pintarFc();
    perfil?.definirProgresso(decorridoPlano() / totalPlano());

    raiz.classList.toggle("vivo--pausado", !e.rodando && !e.terminado);
    estadoPausa.hidden = e.rodando || e.terminado;
    // Acabou o tempo: o botão central leva ao resumo.
    const modo = e.terminado ? "fim" : e.rodando ? "rodando" : "pausado";
    if (memoria.modo !== modo) {
      memoria.modo = modo;
      pausarIcone.replaceChildren(icone({ fim: "check", rodando: "pausa", pausado: "play" }[modo], { tamanho: 32 }));
      pausarRotulo.textContent = { fim: "Resumo", rodando: "Pausar", pausado: "Continuar" }[modo];
      pausarBotao.setAttribute("aria-label", modo === "fim" ? "Ver o resumo" : pausarRotulo.textContent);
    }
  }

  // ---------- Avisos do motor ----------
  // Pílula de uma linha: o que pôr na esteira primeiro, o alvo depois.
  // Rótulos como "Degrau 50%" já trazem o alvo; aí ele não se repete.
  function instrucaoFase(fase, l) {
    const partes = [fase.rotulo];
    if (fase.inclinacaoFixa != null) partes.push(`ponha ${num(fase.inclinacaoFixa, 1)}%`);
    else if (l.inclinacaoSugerida != null) partes.push(`ponha ${num(l.inclinacaoSugerida, 1)}%`);
    else if (fase.tipo === "volta") partes.push("desça para 0–1%");
    if (fase.alvo && !/%/.test(fase.rotulo)) {
      const { de, ate } = fase.alvo;
      partes.push(ate >= 100 ? `alvo ${pct1(de)}%+` : `alvo ${pct1((de + ate) / 2)}%`);
    }
    return partes.join(" · ");
  }

  desligar.push(
    motor.ao("tick", pintar),
    motor.ao("fase", ({ fase, leituras, motivo }) => {
      if (fase.inclinacaoFixa != null) stInc.definir(e.inclinacao);
      ui.pilula(instrucaoFase(fase, leituras), { duracao: 2600 });
      if (motivo !== "volta") {
        sensores.bipe("troca");
        sensores.vibrar([60, 40, 60]);
      }
      pintar();
    }),
    motor.ao("contagem", () => sensores.bipe("contagem")),
    motor.ao("situacao", () => {
      sensores.bipe("aviso");
      estadoTexto.classList.remove("vivo-estado--aviso");
      void estadoTexto.offsetWidth; // reinicia a animação
      estadoTexto.classList.add("vivo-estado--aviso");
    }),
    motor.ao("pedirFc", ({ marca, automatico, fc }) => {
      const minuto = num(marca / 60);
      if (automatico) ui.pilula(`FC do minuto ${minuto}: ${fc} bpm`);
      else {
        ui.pilula(`Anote a FC agora · minuto ${minuto}`, { duracao: 3000 });
        sensores.bipe("aviso");
        sensores.vibrar([80, 60, 80]);
      }
      pintar();
    }),
    motor.ao("extensao", ({ diferenca }) => {
      ui.pilula(`Diferença de ${num(diferenca)} bpm · caminhe mais 1 minuto`, { duracao: 3000 });
      desenharRampa();
      pintar();
    }),
    motor.ao("t7", (r) => {
      ui.pilula(r.vo2max ? `VO2máx estimado ${num(r.vo2max, 1)}` : "Teste sem resultado · veja no resumo", { duracao: 3000 });
      pintar();
    }),
    motor.ao("pausa", ({ rodando }) => {
      if (!rodando) guardarRascunho();
      pintar();
    }),
    motor.ao("fim", () => {
      sensores.bipe("fim");
      sensores.vibrar([100, 60, 100, 60, 200]);
      ui.pilula("Treino concluído");
      pintar();
      guardarRascunho();
      setTimeout(() => { if (!fechado && !resumoAberto) finalizar(); }, 1600);
    }),
  );

  // ---------- Ações ----------
  async function digitarFc() {
    const pendente = ehT7 ? e.t7?.pendente : null;
    const titulo = pendente != null ? `FC no minuto ${num(pendente / 60)}` : "FC agora";
    const bpm = await ui.pedirNumero({ titulo, valor: pendente != null ? null : e.fc, unidade: "bpm", casas: 0, min: 40, max: 220 });
    if (bpm != null) motor.definirFc(bpm, "manual");
    pintar();
  }

  async function alternarBluetooth() {
    if (conexaoBt) {
      const atual = conexaoBt;
      conexaoBt = null;
      await atual.desconectar();
      ui.toast("Relógio desconectado");
      return pintar();
    }
    try {
      conexaoBt = await sensores.fcBluetooth.conectar(
        (bpm) => {
          motor.definirFc(bpm, "bluetooth");
          pintarFc();
        },
        {
          aoDesconectar: () => {
            conexaoBt = null;
            ui.toast("O relógio desconectou. Digite a FC ou conecte de novo.");
            pintarFc();
          },
        },
      );
      ui.toast(`FC de ${conexaoBt.nome} conectada`);
    } catch (erro) {
      // Cancelar a escolha do aparelho não é erro.
      if (erro?.name !== "NotFoundError") {
        ui.abrirSheet({ titulo: "FC por Bluetooth", conteudo: h("p", { class: "sheet-mensagem" }, sensores.AJUDA_BLUETOOTH) });
      }
    }
    pintar();
  }

  function alternarPausa() {
    if (e.terminado) return finalizar();
    if (e.rodando) motor.pausar();
    else motor.retomar();
    sensores.vibrar(30);
    pintar();
  }

  function abrirOpcoes() {
    const fazer = (fn) => (ev) => {
      sheet.fechar();
      fn(ev);
    };
    const sheet = ui.abrirSheet({
      titulo: "Treino",
      conteudo: ui.grupo({},
        ui.linha({ rotulo: "Voltar uma fase", icone: "anterior", id: "vivo-op-voltar", onClick: fazer(() => { motor.voltarFase(); pintar(); }) }),
        ui.linha({ rotulo: "Pular para a próxima fase", icone: "proximo", id: "vivo-op-pular", onClick: fazer(() => { motor.pularFase(); pintar(); }) }),
        ui.linha({ rotulo: "Abrir a Cola", icone: "cola", id: "vivo-op-cola", onClick: fazer(() => ctx.abrirCola()) }),
        ui.linha({ rotulo: "Encerrar e ver o resumo", icone: "parar", id: "vivo-op-encerrar", onClick: fazer(finalizar) }),
        ui.linha({ rotulo: "Sair sem salvar", icone: "lixeira", tom: "destrutiva", id: "vivo-op-sair", onClick: fazer(sairSemSalvar) }),
      ),
    });
  }

  async function sairSemSalvar() {
    const ok = await ui.confirmar({
      titulo: "Sair sem salvar?",
      mensagem: `${formatar.tempo(e.segTotal)} de treino serão descartados.`,
      confirmar: "Descartar treino",
      cancelar: "Voltar ao treino",
      perigo: true,
    });
    if (ok) {
      estado.apagarRascunho();
      fechar();
      ui.toast("Treino descartado");
    }
  }

  // Encerrar: segurar 600 ms, com anel de progresso. Um toque curto só ensina.
  function botaoSegurar() {
    const rotulo = h("span", null, "Encerrar");
    const anel = s("svg", { class: "vivo-anel", viewBox: "0 0 64 64", "aria-hidden": "true" },
      s("circle", { class: "vivo-anel-progresso", cx: 32, cy: 32, r: 30, pathLength: 100 }));
    const botao = h("button", { type: "button", class: "vivo-redondo vivo-encerrar", id: "vivo-encerrar", "aria-label": "Encerrar treino. Segure para confirmar" },
      anel, icone("parar", { tamanho: 24 }));
    let espera = null;
    let dica = null;
    const comecar = () => {
      if (espera) return;
      botao.classList.add("segurando");
      espera = setTimeout(() => {
        espera = null;
        botao.classList.remove("segurando");
        sensores.vibrar(60);
        finalizar();
      }, SEGURAR_MS);
    };
    const soltar = () => {
      if (!espera) return;
      clearTimeout(espera);
      espera = null;
      botao.classList.remove("segurando");
      rotulo.textContent = "Segure";
      clearTimeout(dica);
      dica = setTimeout(() => { rotulo.textContent = "Encerrar"; }, 1500);
    };
    botao.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      try {
        botao.setPointerCapture?.(ev.pointerId);
      } catch { /* ponteiro sintético; segurar funciona sem a captura */ }
      comecar();
    });
    for (const nome of ["pointerup", "pointercancel", "lostpointercapture"]) botao.addEventListener(nome, soltar);
    botao.addEventListener("contextmenu", (ev) => ev.preventDefault());
    botao.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
      if (!ev.repeat) comecar();
    });
    botao.addEventListener("keyup", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") soltar();
    });
    return { botao, rotulo };
  }

  // ---------- Rascunho ----------
  function guardarRascunho() {
    if (fechado || !e.iniciado) return;
    try {
      estado.salvarRascunho(motor.rascunho());
    } catch { /* rascunho é proteção extra; o treino segue */ }
  }
  timerRascunho = setInterval(() => { if (e.rodando) guardarRascunho(); }, RASCUNHO_A_CADA_MS);
  const aoSumir = () => { if (document.visibilityState === "hidden") guardarRascunho(); };
  document.addEventListener("visibilitychange", aoSumir);

  // ---------- Resumo ----------
  async function finalizar() {
    if (resumoAberto || fechado) return;
    const estavaRodando = e.rodando;
    const sessao = motor.encerrar();
    pintar();
    if (!sessaoSalvavel(sessao)) {
      resumoAberto = true;
      const descartar = await ui.confirmar({
        titulo: "Treino curto demais",
        mensagem: "Menos de 1 minuto de treino não é salvo.",
        confirmar: "Descartar",
        cancelar: "Continuar treino",
        perigo: true,
      });
      resumoAberto = false;
      if (descartar) {
        estado.apagarRascunho();
        fechar();
      } else if (estavaRodando) {
        motor.retomar();
        pintar();
      }
      return;
    }
    guardarRascunho();
    resumoAberto = true;
    abrirResumo(ctx, sessao, {
      t7: e.t7?.resultado ?? null,
      perfilExemplo,
      aoSalvar: () => {
        estado.apagarRascunho();
        fechar();
      },
      aoDescartar: () => {
        estado.apagarRascunho();
        fechar();
        ui.toast("Treino descartado");
      },
      // Fechar o resumo sem decidir volta para a tela ao vivo, em pausa.
      aoVoltar: () => {
        resumoAberto = false;
        pintar();
      },
    });
  }

  // ---------- Abrir e fechar ----------
  function fechar() {
    if (fechado) return;
    fechado = true;
    tela.fechar();
  }

  function limpar() {
    fechado = true;
    motor.encerrar();
    clearInterval(timerRascunho);
    document.removeEventListener("visibilitychange", aoSumir);
    desligar.forEach((fn) => fn());
    conexaoBt?.desconectar();
    conexaoBt = null;
    sensores.telaAcesa.desligar();
    estado.definirSessaoAtiva(null);
    aberta = null;
  }

  const tela = ctx.abrirTelaCheia(raiz, { rotulo: nomeTreino(treino), aoFechar: limpar });
  desenharRampa();
  sensores.telaAcesa.ligar();
  estado.definirSessaoAtiva({ treino, planoRef: rascunho?.planoRef ?? planoRef });

  if (rascunho?.estado) {
    pintar();
    ui.pilula("Treino retomado em pausa · toque em Continuar", { duracao: 2600 });
  } else {
    motor.iniciar();
    pintar();
  }
  // A tela cheia não tem foco próprio; o primeiro alvo útil é o Pausar.
  requestAnimationFrame(() => pausarBotao.focus({ preventScroll: true }));

  aberta = { motor, fechar, el: raiz };
  return aberta;
}

export function retomarRascunho(ctx, rascunho) {
  if (!rascunho) return null;
  if (rascunho.estado) return abrirSessao(ctx, { rascunho });
  // Rascunho sem o estado do motor: recomeça o mesmo treino.
  return abrirSessao(ctx, { treino: rascunho.treino, planoRef: rascunho.planoRef ?? null, sessaoPlano: rascunho.sessaoPlano });
}

// ---------- Resumo final (sheet) ----------
function abrirResumo(ctx, sessao, { t7, perfilExemplo, aoSalvar, aoDescartar, aoVoltar }) {
  const { ui, rampa, estado } = ctx;
  const { h, formatar } = ui;
  const num = (v, casas = 0) => formatar.num(v, casas);
  const r = resumirSessao(sessao);
  let decidido = false;
  let rpe = null;

  // T7: resultado no topo.
  let blocoT7 = null;
  if (sessao.treino === "T7" && t7) blocoT7 = resultadoT7(ctx, t7, { perfilExemplo, salvarEIrAoPerfil });

  const metrica = (rotulo, valor, unidade, casas = 0) => ui.metrica({ rotulo, valor, unidade, casas, tamanho: "pequena" });
  // Só o que tem dado: sem alvo não há "na faixa", sem FC não há média.
  // Com número ímpar de métricas, a velocidade média fecha a grade.
  const lista = [
    metrica("Duração", formatar.tempo(r.ativoS)),
    metrica("Distância", r.distanciaKm, "km", 2),
    metrica("Subida", r.subidaM, "m"),
    metrica("METs médios", r.metsMedio, null, 1),
    metrica("Gasto", r.kcal, "kcal"),
    r.acertoFaixa != null && metrica("Na faixa", Math.round(r.acertoFaixa * 100), "% do tempo"),
    r.fcMedia != null && metrica("FC média", Math.round(r.fcMedia), "bpm"),
  ].filter(Boolean);
  if (lista.length % 2 && r.ativoS > 0) lista.push(metrica("Velocidade média", (r.distanciaKm / r.ativoS) * 3600, "km/h", 1));
  const metricas = h("div", { class: "vivo-resumo-metricas" }, lista);

  // RPE 0–10: slider grande; vazio até o primeiro toque.
  const rpeValor = h("span", { class: "num" }, "–");
  const rpePalavra = h("span", { class: "vivo-rpe-palavra" }, "arraste para marcar");
  const rpeInput = h("input", {
    type: "range", id: "vivo-rpe", class: "vivo-rpe-faixa", min: 0, max: 10, step: 1, value: 5,
    "aria-label": "Esforço percebido, de 0 a 10",
    "on:input": (ev) => {
      rpe = Number(ev.target.value);
      rpeValor.textContent = String(rpe);
      rpePalavra.textContent = PALAVRAS_RPE[rpe];
      rpeInput.classList.add("vivo-rpe--marcado");
      rpeInput.setAttribute("aria-valuetext", `${rpe}, ${PALAVRAS_RPE[rpe]}`);
    },
  });
  const blocoRpe = h("div", { class: "vivo-rpe" },
    h("div", { class: "vivo-rpe-topo" },
      h("label", { for: "vivo-rpe", class: "vivo-rotulo" }, "Esforço percebido (0–10)"),
      h("span", { class: "vivo-rpe-leitura" }, rpeValor, rpePalavra),
    ),
    rpeInput,
    h("div", { class: "vivo-rpe-escala", "aria-hidden": "true" }, h("span", null, "0 repouso"), h("span", null, "10 máximo")),
  );

  const notas = h("textarea", { id: "vivo-notas", class: "vivo-campo", rows: 3, placeholder: "Como foi? Ex.: o degrau de 65% pesou no fim" });
  const blocoNotas = h("div", { class: "vivo-bloco" }, h("label", { for: "vivo-notas", class: "vivo-rotulo" }, "Notas"), notas);

  const CAMPOS_RELOGIO = [
    ["fcMedia", "FC média", "bpm"],
    ["fcMax", "FC máxima", "bpm"],
    ["kcal", "Calorias", "kcal"],
    ["carga", "Carga de treino", null],
    ["pai", "PAI", null],
  ];
  const camposRelogio = CAMPOS_RELOGIO.map(([chave, rotulo, unidade]) => {
    const id = `vivo-relogio-${chave}`;
    const input = h("input", { id, class: "vivo-campo vivo-campo--numero", type: "text", inputmode: "numeric", autocomplete: "off", "data-chave": chave });
    return h("div", { class: "vivo-relogio-campo" },
      h("label", { for: id, class: "vivo-rotulo" }, unidade ? `${rotulo} (${unidade})` : rotulo), input);
  });
  const relogio = h("details", { class: "vivo-relogio", id: "vivo-relogio" },
    h("summary", null, ui.icone("relogio", { tamanho: 22 }), h("span", null, "Dados do relógio"), h("span", { class: "vivo-opcional" }, "opcional"), ui.icone("abaixo", { tamanho: 18, classe: "vivo-relogio-seta" })),
    h("div", { class: "vivo-relogio-campos" }, camposRelogio),
  );

  const conteudo = h("div", { class: "vivo-resumo" },
    blocoT7,
    h("div", { class: "vivo-resumo-rampa" },
      rampa.perfilRampa(rampa.fasesExecutadas(sessao), { altura: 44, planejado: sessao.fases, rotulo: "Perfil executado sobre o planejado" }),
      h("p", { class: "vivo-legenda-rampa" }, "Em cor, o que você fez", h("span", { class: "vivo-amostra vivo-amostra--plano" }), "planejado"),
    ),
    metricas,
    perfilExemplo && !blocoT7 && h("p", { class: "vivo-nota" }, "Calculado com o perfil de exemplo. Preencha seus dados no Perfil para os números valerem."),
    blocoRpe,
    blocoNotas,
    relogio,
  );

  function sessaoFinal() {
    const rel = {};
    for (const input of relogio.querySelectorAll("input")) {
      const n = Number(input.value.replace(",", "."));
      if (input.value.trim() && Number.isFinite(n) && n >= 0) rel[input.dataset.chave] = n;
    }
    const final = { ...sessao };
    if (rpe != null) final.rpe = rpe;
    if (notas.value.trim()) final.notas = notas.value.trim();
    if (Object.keys(rel).length) final.relogio = rel;
    return final;
  }

  async function salvar() {
    decidido = true;
    sheet.fechar();
    try {
      await estado.salvarSessao(sessaoFinal());
      ui.toast("Treino salvo");
    } catch (erro) {
      // O rascunho continua no aparelho; volta para a tela ao vivo para tentar de novo.
      if (!erro?.avisado) ui.toast("Não deu para salvar agora. Tente de novo em instantes.");
      aoVoltar();
      return false;
    }
    aoSalvar();
    return true;
  }

  async function salvarEIrAoPerfil() {
    if (await salvar()) ctx.navegar("perfil");
  }

  async function descartar() {
    const ok = await ui.confirmar({
      titulo: "Descartar este treino?",
      mensagem: "Os dados desta sessão serão apagados.",
      confirmar: "Descartar",
      perigo: true,
    });
    if (!ok) return;
    decidido = true;
    sheet.fechar();
    aoDescartar();
  }

  const sheet = ui.abrirSheet({
    titulo: sessao.treino === "T7" ? "Resultado do teste" : "Resumo",
    classe: "vivo-resumo-sheet",
    conteudo,
    // Uma linha só: Descartar como texto ao lado de Salvar, para o rodapé
    // não comer um terço da tela e as notas ficarem à vista.
    acoes: [
      { rotulo: "Descartar", tipo: "texto", grande: false, largo: false, classe: "vivo-descartar", onClick: descartar },
      { rotulo: "Salvar", tipo: "primario", onClick: salvar },
    ],
    aoFechar: () => { if (!decidido) aoVoltar(); },
  });
  return sheet;
}

function resultadoT7(ctx, t7, { perfilExemplo, salvarEIrAoPerfil }) {
  const { ui, estado } = ctx;
  const { h, formatar } = ui;
  const num = (v, casas = 0) => formatar.num(v, casas);
  if (!t7.vo2max) {
    return h("div", { class: "vivo-t7" },
      h("p", { class: "vivo-t7-rotulo" }, "VO2máx estimado"),
      h("p", { class: "vivo-t7-erro" }, ERROS_T7[t7.erro] ?? "Não deu para calcular o VO2máx."),
    );
  }
  // Compara com o T7 anterior de verdade; o do exemplo não conta.
  const anterior = estado.ultimoT7();
  let comparacao = "Primeiro teste. Repita em 4 semanas, na mesma velocidade.";
  if (anterior) {
    const delta = t7.vo2max - anterior.t7.vo2max;
    comparacao = `${formatar.delta(delta, 1)} desde ${formatar.data(anterior.inicio)} (${num(anterior.t7.vo2max, 1)})`;
    if (anterior.t7.velocidade && Math.abs(anterior.t7.velocidade - t7.velocidade) >= 0.15) {
      comparacao += ` · velocidade diferente (${num(anterior.t7.velocidade, 1)} km/h)`;
    }
  }
  const detalhes = `FC final ${num(t7.fcFinal, Number.isInteger(t7.fcFinal) ? 0 : 1)} bpm a ${num(t7.velocidade, 1)} km/h`;

  let acao;
  if (perfilExemplo) {
    acao = h("div", { class: "vivo-t7-exemplo" },
      h("p", null, "Este resultado usa a idade e o sexo do perfil de exemplo. Ele só vale com os seus dados."),
      ui.botao({ rotulo: "Salvar e ir ao Perfil", tipo: "secundario", largo: true, id: "vivo-t7-perfil", onClick: salvarEIrAoPerfil }),
    );
  } else {
    const usar = ui.botao({
      rotulo: "Usar como meu VO2máx",
      tipo: "secundario",
      largo: true,
      id: "vivo-t7-usar",
      onClick: async () => {
        usar.disabled = true;
        try {
          await estado.salvarPerfil({ vo2max: t7.vo2max, velocidadeT7: t7.velocidade });
          usar.replaceChildren(ui.icone("check", { tamanho: 20 }), "VO2máx atualizado");
          ui.toast(`Faixas agora usam VO2máx ${num(t7.vo2max, 1)}`);
        } catch (erro) {
          usar.disabled = false;
          if (!erro?.avisado) ui.toast("Não deu para salvar o Perfil agora.");
        }
      },
    });
    acao = usar;
  }

  return h("div", { class: "vivo-t7" },
    h("p", { class: "vivo-t7-rotulo" }, "VO2máx estimado"),
    h("p", { class: "vivo-t7-valor" },
      h("span", { class: "num" }, num(t7.vo2max, 1)),
      h("span", { class: "vivo-t7-unidade" }, "ml/kg/min"),
    ),
    h("p", { class: "vivo-t7-linha" }, h("span", { class: "num" }, num(t7.vo2max / ML_POR_MET, 1)), " METs · ", detalhes),
    h("p", { class: "vivo-t7-comparacao" }, comparacao),
    acao,
  );
}

// Não é aba da tab bar: serve de entrada direta para escolher um treino livre.
export function criarTela(ctx) {
  const { ui } = ctx;
  const linhas = Object.entries(TREINOS).map(([id, t]) => ui.linha({
    rotulo: `${id} · ${t.nome}`,
    detalhe: t.resumo,
    acessorio: "chevron",
    id: `treinar-${id}`,
    onClick: () => ctx.iniciarTreino(LIVRES[id]),
  }));
  return { el: ui.h("div", { class: "vivo-escolha" }, ui.grupo({ titulo: "Treino livre" }, linhas)), titulo: "Treinar" };
}

// Parâmetros simples para os treinos livres.
const LIVRES = {
  T1: { treino: "T1", minutos: 30, alvo: [55, 60] },
  T2: { treino: "T2", minutos: 25, alvo: [50, 70] },
  T3: { treino: "T3", topo: 65 },
  T4: { treino: "T4", nivel: 1 },
  T5: { treino: "T5", blocos: 2, minutos: 8 },
  T6: { treino: "T6", blocos: 3, inclinacao: 15 },
  T7: { treino: "T7" },
};

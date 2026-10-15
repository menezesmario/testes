// Aba Painel: VO2máx, minutos na faixa por semana, eficiência e histórico de
// sessões, com o detalhe de cada sessão numa tela empilhada.

import { graficoVO2, graficoSemanas, graficoEficiencia, graficoSessao } from "../graficos.js";
import { resumirSessao, serieSemanal, historicoVO2, inicioDaSemana } from "../../src/resumo.js";
import { TREINOS, PLANO, montarFases } from "../../src/treinos.js";

const CHAVE_PERIODO = "esteira:painel:periodo";
const PERIODOS = ["4", "8", "tudo"];
const SEMANA_MS = 7 * 86400000;
const POR_PAGINA = 12;
const ORIGEM_VO2 = { manual: "informado no Perfil", t7: "do último T7", estimado: "estimado pela FC", exemplo: "de exemplo" };

function lerPeriodo() {
  try {
    const salvo = localStorage.getItem(CHAVE_PERIODO);
    return PERIODOS.includes(salvo) ? salvo : "8";
  } catch {
    return "8";
  }
}

function guardarPeriodo(valor) {
  try {
    localStorage.setItem(CHAVE_PERIODO, valor);
  } catch {
    // Sem armazenamento local: o período só vale até fechar a aba.
  }
}

// Meta da semana: minutos com alvo nas sessões obrigatórias da semana do plano
// que cai nessa semana do calendário. Sem início do plano, ou fora das 8 semanas, não há meta.
export function metaDaSemana(inicioSemana, inicioPlano) {
  if (!inicioPlano) return null;
  const inicio = inicioDaSemana(new Date(`${inicioPlano.slice(0, 10)}T00:00:00`));
  if (Number.isNaN(inicio.getTime())) return null;
  const indice = Math.round((inicioSemana - inicio) / SEMANA_MS);
  if (indice < 0 || indice >= PLANO.length) return null;
  const segundos = PLANO[indice].sessoes
    .filter((x) => !x.opcional)
    .flatMap((x) => montarFases(x))
    .filter((f) => f.alvo)
    .reduce((soma, f) => soma + f.segundos, 0);
  return segundos ? Math.round(segundos / 60) : null;
}

// "Tudo" cobre da semana da primeira sessão até a atual (entre 4 e 52 semanas).
function semanasDoPeriodo(periodo, sessoes, hoje) {
  if (periodo !== "tudo") return Number(periodo);
  const primeira = sessoes.reduce((menor, x) => Math.min(menor, Date.parse(x.inicio)), Infinity);
  if (!Number.isFinite(primeira)) return 4;
  const semanas = Math.round((inicioDaSemana(hoje) - inicioDaSemana(primeira)) / SEMANA_MS) + 1;
  return Math.min(52, Math.max(4, semanas));
}

export function criarTela(ctx) {
  const { h, formatar, cartao, grupo, linha, segmentado, vazio, botao, icone, confirmar, toast } = ctx.ui;
  const { perfilRampa, fasesExecutadas } = ctx.rampa;
  const { num, delta } = formatar;

  let periodo = lerPeriodo();
  let limite = POR_PAGINA;
  let visivel = false;
  const resumos = new WeakMap();
  const resumo = (sessao) => {
    if (!resumos.has(sessao)) resumos.set(sessao, resumirSessao(sessao));
    return resumos.get(sessao);
  };

  const nomeDoTreino = (sessao) => {
    const nome = TREINOS[sessao.treino]?.nome;
    return nome ? `${sessao.treino} · ${nome}` : sessao.treino;
  };

  // ---------- Cartões ----------
  function cartaoVO2(sessoes, corte) {
    const testes = historicoVO2(sessoes);
    if (!testes.length) {
      const ef = ctx.estado.perfilEfetivo();
      const atual = ef.vo2max ? ` Hoje o app usa ${num(ef.vo2max, 1)} ml/kg/min (${ORIGEM_VO2[ef.vo2maxOrigem] ?? "estimado"}).` : "";
      return cartao({ titulo: "VO2máx", classe: "painel-cartao-vazio" },
        vazio({
          titulo: "Sem teste de referência",
          texto: `Faça o T7 para medir o seu VO2máx e calibrar as faixas.${atual}`,
          acao: { rotulo: "Fazer o T7", onClick: () => ctx.iniciarTreino({ treino: "T7" }) },
        }),
      );
    }
    let visiveis = corte ? testes.filter((t) => new Date(t.data) >= corte) : testes;
    // Uma linha precisa de dois pontos: completa com o teste anterior ao período.
    if (visiveis.length < 2) {
      const antes = corte ? testes.filter((t) => new Date(t.data) < corte) : [];
      visiveis = [...antes.slice(-(2 - visiveis.length)), ...visiveis];
    }
    const ultimo = testes[testes.length - 1];
    const semanasDesde = Math.floor((Date.now() - Date.parse(ultimo.data)) / SEMANA_MS);
    let nota = null;
    if (testes.length === 1) nota = "Repita o T7 na mesma velocidade para ver a tendência.";
    else if (semanasDesde >= 5) nota = `Último teste há ${semanasDesde} semanas. Repita o T7 na mesma velocidade.`;
    return cartao({
      titulo: "VO2máx",
      acao: nota ? { rotulo: "Fazer o T7", onClick: () => ctx.iniciarTreino({ treino: "T7" }) } : undefined,
    },
    graficoVO2(visiveis),
    nota && h("p", { class: "painel-nota" }, nota),
    );
  }

  function cartaoSemanas(serie) {
    const semMeta = !serie.some((w) => w.meta);
    return cartao({ titulo: "Minutos na faixa por semana" },
      graficoSemanas(serie),
      semMeta && h("p", { class: "painel-nota" }, "Sem meta: informe o início do plano no Perfil para ver a meta de cada semana."),
    );
  }

  function cartaoEficiencia(noPeriodo) {
    const pontos = noPeriodo
      // O T7 fica de fora: é um protocolo a 0% e 5%, com carga e FC que não se comparam aos treinos.
      .filter((x) => !x.t7)
      .map((x) => ({ inicio: x.inicio, treino: x.treino, eficiencia: resumo(x).eficiencia }))
      .filter((p) => p.eficiencia > 0)
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
    const dica = h("span", { class: "painel-dica" }, icone("descer", { tamanho: 14 }), "menor é melhor");
    if (pontos.length < 2) {
      return cartao({ titulo: "Eficiência", acao: dica },
        h("p", { class: "painel-nota" }, pontos.length
          ? "Falta uma sessão com frequência cardíaca para mostrar a tendência."
          : "Nenhuma sessão com frequência cardíaca neste período. Digite a FC durante o treino ou conecte o sensor."),
      );
    }
    return cartao({ titulo: "Eficiência", acao: dica },
      graficoEficiencia(pontos),
      h("p", { class: "painel-nota" }, "Batimentos por MET: quanto menos o coração bate para o mesmo esforço, mais condicionado você está. A intensidade pesa, então compare treinos parecidos."),
    );
  }

  // ---------- Lista ----------
  function linhaSessao(sessao) {
    const r = resumo(sessao);
    const miniatura = perfilRampa(fasesExecutadas(sessao), {
      compacto: true,
      planejado: sessao.fases,
      rotulo: `Perfil de ${nomeDoTreino(sessao)}, executado sobre o planejado`,
    });
    const [numero, legenda] = sessao.t7
      ? [num(sessao.t7.vo2max, 1), "VO2máx"]
      : [r.acertoFaixa != null ? `${num(r.acertoFaixa * 100, 0)}%` : "–", "na faixa"];
    return linha({
      // Espaços sem quebra: em tela estreita a linha só quebra entre a data e a duração.
      rotulo: `${formatar.data(sessao.inicio)} · ${formatar.duracao(r.duracaoS)}`.replace(/(\d) (\p{L})|, /gu, (m, a, b) => (a ? `${a}\u00a0${b}` : ",\u00a0")),
      detalhe: nomeDoTreino(sessao),
      icone: miniatura,
      valor: h("span", { class: "painel-sessao-valor" }, h("span", { class: "num" }, numero), h("span", null, legenda)),
      rotuloAria: `${formatar.data(sessao.inicio)}, ${nomeDoTreino(sessao)}, ${formatar.duracao(r.duracaoS)}, ${numero} ${legenda}. Abrir detalhe`,
      onClick: (e) => abrirDetalhe(sessao, e.currentTarget),
    });
  }

  function listaSessoes(noPeriodo) {
    const titulo = `Sessões (${noPeriodo.length})`;
    if (!noPeriodo.length) {
      return grupo({ titulo },
        linha({ rotulo: "Nenhuma sessão neste período", detalhe: "Escolha Tudo ou comece um treino na aba Hoje." }),
      );
    }
    const mostradas = noPeriodo.slice(0, limite);
    const linhas = mostradas.map(linhaSessao);
    if (noPeriodo.length > limite) {
      linhas.push(linha({
        rotulo: `Mostrar mais ${Math.min(POR_PAGINA, noPeriodo.length - limite)}`,
        tom: "acao",
        onClick: () => {
          limite += POR_PAGINA;
          desenhar();
        },
      }));
    }
    const g = grupo({ titulo, rodape: "Toque numa sessão para ver o detalhe." }, ...linhas);
    g.classList.add("painel-lista");
    return g;
  }

  // ---------- Detalhe ----------
  function abrirDetalhe(sessao, gatilho) {
    const r = resumo(sessao);
    const exec = fasesExecutadas(sessao);
    let tela = null;
    const fechar = () => tela?.fechar();
    // O Esc também fecha a confirmação; enquanto ela estiver aberta, o Esc é dela.
    const aoTeclar = (e) => {
      if (e.key === "Escape" && !document.querySelector(".sheet")) fechar();
    };

    async function apagar() {
      const ok = await confirmar({
        titulo: "Apagar esta sessão?",
        mensagem: `${sessao.treino} de ${formatar.data(sessao.inicio)} sai do histórico e dos gráficos. Não dá para desfazer.`,
        confirmar: "Apagar",
        perigo: true,
      });
      if (!ok) return;
      fechar();
      try {
        await ctx.estado.apagarSessao(sessao.id);
        toast("Sessão apagada");
      } catch (erro) {
        if (!erro?.avisado) toast("Não deu para apagar a sessão. Tente de novo.");
      }
    }

    const voltar = botao({ tipo: "texto", icone: "voltar", rotulo: "Painel", onClick: fechar, id: "painel-detalhe-voltar" });
    const metricas = metricasDaSessao(sessao, r);
    const registro = linhasDeRegistro(sessao);

    const corpo = h("div", { class: "painel-detalhe-corpo" },
      h("div", null,
        h("h1", { class: "painel-detalhe-titulo" }, nomeDoTreino(sessao)),
        h("p", { class: "painel-detalhe-sub" },
          [formatar.dataLonga(sessao.inicio), formatar.hora(sessao.inicio), sessao.planoRef ? `sessão ${sessao.planoRef} do plano` : null].filter(Boolean).join(" · ")),
      ),
      sessao.exemplo && h("div", { class: "painel-exemplo", role: "note" },
        icone("info", { tamanho: 20 }),
        h("div", null, h("p", null, h("strong", null, "Sessão de exemplo.")), h("p", null, "Ela não está salva e não pode ser apagada.")),
      ),
      h("figure", { class: "painel-detalhe-rampa" },
        perfilRampa(exec, { altura: 56, planejado: sessao.fases, rotulo: "Perfil executado sobre o planejado" }),
        h("figcaption", null, "Executado em cor, planejado em cinza"),
      ),
      cartao({ titulo: "Intensidade no tempo" }, graficoSessao(sessao)),
      cartao({ titulo: sessao.t7 ? "Resultado do teste" : "Resumo" }, h("div", { class: "painel-metricas" }, metricas)),
      registro.length ? grupo({ titulo: "Registro" }, ...registro) : null,
      sessao.exemplo ? null : grupo({}, linha({ rotulo: "Apagar sessão", tom: "destrutiva", onClick: apagar, id: "painel-apagar-sessao" })),
    );

    const conteudo = h("div", { class: "painel-detalhe" },
      h("div", { class: "painel-detalhe-topo" }, voltar),
      h("div", { class: "painel-detalhe-rolagem" }, corpo),
    );

    document.addEventListener("keydown", aoTeclar);
    tela = ctx.abrirTelaCheia(conteudo, {
      rotulo: `Sessão de ${formatar.dataLonga(sessao.inicio)}`,
      aoFechar: () => {
        document.removeEventListener("keydown", aoTeclar);
        if (gatilho?.isConnected) gatilho.focus();
      },
    });
    requestAnimationFrame(() => voltar.focus());
  }

  function metricasDaSessao(sessao, r) {
    const { metrica } = ctx.ui;
    const m = (rotulo, valor, unidade, extra = {}) => metrica({ rotulo, valor, unidade, ...extra });
    if (sessao.t7) {
      const anterior = historicoVO2(ctx.estado.sessoes).filter((t) => t.data < sessao.inicio).pop();
      const dif = anterior ? sessao.t7.vo2max - anterior.vo2max : null;
      return [
        m("VO2máx", sessao.t7.vo2max, "ml/kg/min", { casas: 1, tom: "destaque" }),
        dif != null ? m("Desde o teste anterior", delta(dif, 1), "ml/kg/min", { tom: dif > 0 ? "ok" : undefined }) : null,
        m("FC final", sessao.t7.fcFinal, "bpm"),
        m("Velocidade", sessao.t7.velocidade, "km/h", { casas: 1 }),
        m("Duração", formatar.duracao(r.duracaoS)),
        m("METs médios", r.metsMedio, null, { casas: 1, tamanho: "pequena" }),
      ].filter(Boolean);
    }
    return [
      r.acertoFaixa != null ? m("Na faixa", num(r.acertoFaixa * 100, 0), "%", { tom: "destaque" }) : null,
      m("Duração", formatar.duracao(r.duracaoS)),
      m("Distância", r.distanciaKm, "km", { casas: 2, tamanho: "pequena" }),
      m("Subida", r.subidaM, "m", { casas: 0, tamanho: "pequena" }),
      m("METs médios", r.metsMedio, null, { casas: 1, tamanho: "pequena" }),
      m("% do VO2máx médio", r.pctVO2Medio, "%", { casas: 0, tamanho: "pequena" }),
      r.fcMedia != null ? m("FC média", r.fcMedia, "bpm", { casas: 0, tamanho: "pequena" }) : null,
      r.fcMax != null ? m("FC máxima", r.fcMax, "bpm", { casas: 0, tamanho: "pequena" }) : null,
      r.kcal != null ? m("Calorias", r.kcal, "kcal", { casas: 0, tamanho: "pequena" }) : null,
      r.eficiencia != null ? m("Eficiência", r.eficiencia, "bpm/MET", { casas: 1, tamanho: "pequena" }) : null,
    ].filter(Boolean);
  }

  function linhasDeRegistro(sessao) {
    const linhas = [];
    if (sessao.rpe != null) linhas.push(linha({ rotulo: "Esforço percebido", valor: `${sessao.rpe} de 10` }));
    const rel = sessao.relogio;
    if (rel) {
      const partes = [
        rel.fcMedia ? `FC média ${num(rel.fcMedia)} bpm` : null,
        rel.fcMax ? `máx ${num(rel.fcMax)}` : null,
        rel.kcal ? `${num(rel.kcal)} kcal` : null,
        rel.carga ? `carga ${num(rel.carga)}` : null,
        rel.pai ? `PAI ${num(rel.pai)}` : null,
      ].filter(Boolean);
      if (partes.length) linhas.push(linha({ rotulo: "Dados do relógio", detalhe: partes.join(" · ") }));
    }
    if (sessao.notas) linhas.push(linha({ rotulo: "Notas", detalhe: sessao.notas }));
    return linhas;
  }

  // ---------- Tela ----------
  const seletor = segmentado({
    id: "painel-periodo",
    rotulo: "Período",
    opcoes: [{ valor: "4", rotulo: "4 sem" }, { valor: "8", rotulo: "8 sem" }, { valor: "tudo", rotulo: "Tudo" }],
    valor: periodo,
    onChange: (valor) => {
      periodo = valor;
      limite = POR_PAGINA;
      guardarPeriodo(valor);
      desenhar();
    },
  });
  const conteudo = h("div", { class: "painel-conteudo" });
  const el = h("div", { class: "painel" }, seletor, conteudo);

  function desenhar() {
    // O aviso de dados de exemplo é o do topo (main.js), comum a todas as abas.
    const { sessoes, perfil } = ctx.estado;
    const hoje = new Date();
    const semanas = semanasDoPeriodo(periodo, sessoes, hoje);
    const serie = serieSemanal(sessoes, hoje, semanas).map((w) => ({
      inicio: w.inicio,
      minutos: w.minutosNaFaixa,
      sessoes: w.sessoes,
      meta: metaDaSemana(w.inicio, perfil?.inicioPlano),
    }));
    const corte = periodo === "tudo" ? null : serie[0].inicio;
    const noPeriodo = corte ? sessoes.filter((x) => new Date(x.inicio) >= corte) : sessoes;
    seletor.definir(periodo);
    conteudo.replaceChildren(
      ...[
        cartaoVO2(sessoes, corte),
        cartaoSemanas(serie),
        cartaoEficiencia(noPeriodo),
        listaSessoes(noPeriodo),
      ].filter(Boolean),
    );
  }

  ctx.estado.assinar(() => {
    if (visivel) desenhar();
  });
  desenhar();

  return {
    el,
    titulo: "Painel",
    aoMostrar() {
      visivel = true;
      desenhar();
    },
    aoOcultar() {
      visivel = false;
    },
  };
}

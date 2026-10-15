// Aba Hoje: treino do dia, VO2máx, minutos na faixa da semana, lista da semana
// e a sheet "Outro treino" (T1–T7 livre).

import { PLANO, TREINOS, montarFases, duracaoTotal, semanaDoPlano, proximaSessao, modoDoTreino } from "../../src/treinos.js";
import { inclinacaoParaMets } from "../../src/calculadora.js";
import { resumirSessao, historicoVO2, inicioDaSemana } from "../../src/resumo.js";

const dois = (n) => String(n).padStart(2, "0");
const isoLocal = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
const hojeISO = () => isoLocal(new Date());

// "2026-10-15" como data local à meia-noite (Date.parse leria como UTC).
function dataLocal(iso, somaDias = 0) {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d + somaDias);
}

// ---------- Descrição de um treino em palavras ----------
const curto = (v) => (Number.isInteger(v) ? String(v) : String(v).replace(".", ","));
const pctTexto = (alvo) => (Array.isArray(alvo) ? `${alvo[0]}–${alvo[1]}%` : `${alvo}%`);
const centro = (alvo) => (Array.isArray(alvo) ? (alvo[0] + alvo[1]) / 2 : alvo);

// Inclinação (arredondada a 0,5) para ficar em `pct` do VO2máx na velocidade dada.
function inclinacaoPara(pct, velocidadeKmh, vo2max, modo) {
  if (!(vo2max > 0)) return null;
  const inc = inclinacaoParaMets({ velocidadeKmh, mets: ((pct / 100) * vo2max) / 3.5, modo });
  return Math.round(inc * 2) / 2;
}

function textoInclinacao(pcts, velocidadeKmh, vo2max, modo) {
  const incs = pcts.map((p) => inclinacaoPara(p, velocidadeKmh, vo2max, modo));
  if (incs.some((i) => i == null)) return null;
  const vel = `${curto(velocidadeKmh)}\u00a0km/h`;
  if (incs.some((i) => i > 20)) return `acima de 20% a ${vel}: use mais velocidade`;
  if (incs.every((i) => i < 0)) return `já passa do alvo a ${vel}: use menos velocidade`;
  const lista = incs.map((i) => curto(Math.max(0, i))).join("→");
  return `~${lista}% a ${vel}`;
}

// { fases, duracaoS, alvo, inclinacao }: alvo e inclinacao são frases curtas (ou null).
export function descreverTreino(sessao, { vo2max, velocidade, velocidadeT7 }) {
  const fases = montarFases(sessao);
  const duracaoS = duracaoTotal(fases);
  const comAlvo = fases.filter((f) => f.alvo);
  let alvo = null;
  let inclinacao = null;
  const modo = modoDoTreino(sessao.treino);
  switch (sessao.treino) {
    case "T1":
      alvo = `${pctTexto(sessao.alvo)} do VO2máx`;
      inclinacao = textoInclinacao([centro(sessao.alvo)], velocidade, vo2max, modo);
      break;
    case "T2":
      alvo = `${pctTexto(sessao.alvo)} do VO2máx`;
      inclinacao = "inclinação fixa em 1%";
      break;
    case "T3": {
      const topo = sessao.topo ?? 70;
      alvo = `50→${topo}% do VO2máx`;
      inclinacao = textoInclinacao([50, topo], velocidade, vo2max, modo);
      break;
    }
    case "T4": {
      const tiros = fases.filter((f) => f.tipo === "tiro");
      alvo = `${tiros.length} tiros de ${tiros[0].segundos} s acima de 85%`;
      const t = textoInclinacao([92], velocidade, vo2max, modo);
      inclinacao = t ? `tiro a ${t}` : null;
      break;
    }
    case "T5":
      alvo = `${comAlvo.length} blocos de ${comAlvo[0].segundos / 60} min a 78–85%`;
      inclinacao = "inclinação fixa em 1%";
      break;
    case "T6":
      alvo = `${comAlvo.length} subidas de 5 min a 70–85%`;
      inclinacao = `inclinação fixa em ${comAlvo[0].inclinacaoFixa}%`;
      break;
    case "T7":
      alvo = "4 min a 0% e 4 min a 5%";
      inclinacao = velocidadeT7 ? `sempre a ${curto(velocidadeT7)} km/h` : "mesma velocidade nos dois estágios";
      break;
  }
  return { fases, duracaoS, alvo, inclinacao };
}

// ---------- Tela ----------
export function criarTela(ctx) {
  const { h, s, formatar, grupo, linha, cartao, metrica, botao, chip, segmentado, stepper, abrirSheet, toast } = ctx.ui;
  const { perfilRampa } = ctx.rampa;
  const estado = ctx.estado;

  const el = h("div", { class: "hoje" });
  let selecionadaId = null; // sessão da semana escolhida na lista
  let alternativaId = null; // sessão cuja alternativa do dia está ativa
  let visivel = false;
  let sujo = true;
  let diaDesenhado = null;

  const tela = {
    el,
    titulo: "Hoje",
    subtitulo: () => formatar.dataLonga(new Date()),
    aoMostrar() {
      visivel = true;
      if (sujo || diaDesenhado !== hojeISO()) desenhar();
    },
    aoOcultar() { visivel = false; },
  };

  estado.assinar(() => {
    sujo = true;
    if (visivel) desenhar();
  });

  // ---------- Dados derivados ----------
  function sessoesDoPlano(inicioPlano) {
    return estado.sessoes.filter((x) => x.planoRef && isoLocal(new Date(x.inicio)) >= inicioPlano);
  }

  function minutosNaFaixa(ini, fim) {
    let total = 0;
    for (const x of estado.sessoes) {
      const t = new Date(x.inicio);
      if (t < ini || t >= fim) continue;
      try { total += resumirSessao(x).minutosNaFaixa; } catch { /* sessão malformada: ignora */ }
    }
    return total;
  }

  const metaSemana = (semana) => Math.round(
    PLANO[semana - 1].sessoes
      .filter((x) => !x.opcional)
      .reduce((soma, x) => soma + montarFases(x).filter((f) => f.alvo).reduce((a, f) => a + f.segundos, 0), 0) / 60,
  );

  // ---------- Peças ----------
  function iniciar(sessaoPlano) {
    ctx.iniciarTreino(sessaoPlano);
  }

  function arco({ valor, meta }) {
    const raio = 40;
    const ponto = (graus) => {
      const r = (graus * Math.PI) / 180;
      return `${(50 + raio * Math.cos(r)).toFixed(2)} ${(50 + raio * Math.sin(r)).toFixed(2)}`;
    };
    // 270° com a abertura embaixo: de 135° (baixo-esquerda) a 45° (baixo-direita), pelo topo.
    const d = `M ${ponto(135)} A ${raio} ${raio} 0 1 1 ${ponto(45)}`;
    const fracao = meta > 0 ? Math.min(1, valor / meta) : 0;
    const completo = meta > 0 && valor >= meta;
    return s("svg", { class: "hoje-arco-svg", viewBox: "0 0 100 100", "aria-hidden": "true" },
      s("path", { d, class: "hoje-arco-pista", pathLength: 100 }),
      fracao > 0 && s("path", {
        d,
        class: ["hoje-arco-valor", completo && "completo"],
        pathLength: 100,
        "stroke-dasharray": `${(fracao * 100).toFixed(2)} 100`,
      }),
    );
  }

  function cartaoVO2(ef) {
    const hist = historicoVO2(estado.sessoes);
    const vo2 = ef.vo2max;
    const origem = {
      t7: () => `Medido no T7 de ${formatar.data(estado.ultimoT7().inicio)}`,
      manual: () => "Informado no Perfil",
      estimado: () => "Estimado pela FC. Faça o T7",
      exemplo: () => "Valor de exemplo",
    }[ef.vo2maxOrigem]?.() ?? "Faça o T7 ou informe no Perfil";
    let variacao = null;
    if (hist.length >= 2) {
      const d = hist[hist.length - 1].vo2max - hist[0].vo2max;
      variacao = h("p", { class: ["hoje-delta t-footnote", d > 0 ? "sobe" : d < 0 ? "desce" : null] },
        h("span", { class: "num" }, formatar.delta(d, 1)), " desde o 1º T7");
    }
    return cartao({ titulo: "VO2máx", classe: "hoje-cartao" },
      metrica({ valor: vo2, casas: 1, tamanho: undefined }),
      h("p", { class: "t-footnote texto-2 hoje-unidade" },
        vo2 ? `ml/kg/min · ${formatar.num(vo2 / 3.5, 1)} METs` : "ml/kg/min"),
      variacao,
      h("p", { class: "t-caption texto-2" }, origem),
    );
  }

  function cartaoFaixa(semana, ef) {
    let ini;
    let fim;
    // Passadas as 8 semanas, semanaDoPlano fica em 8: a janela do plano já
    // ficou para trás, então o arco usa a semana do calendário, sem meta.
    const planoAcabou = !!ef.inicioPlano && dataLocal(ef.inicioPlano, 56) <= dataLocal(hojeISO());
    if (ef.inicioPlano && semana && !planoAcabou) {
      ini = dataLocal(ef.inicioPlano, (semana - 1) * 7);
      fim = dataLocal(ef.inicioPlano, semana * 7);
    } else {
      ini = inicioDaSemana(new Date());
      fim = new Date(ini);
      fim.setDate(fim.getDate() + 7);
    }
    const minutos = minutosNaFaixa(ini, fim);
    const meta = ef.inicioPlano && semana && !planoAcabou ? metaSemana(semana) : 0;
    const texto = meta ? `de ${meta} min` : "min esta semana";
    return cartao({ titulo: "Na faixa", classe: "hoje-cartao" },
      h("div", {
        class: "hoje-arco",
        role: "img",
        "aria-label": meta
          ? `${formatar.num(minutos, 0)} de ${meta} minutos na faixa nesta semana`
          : `${formatar.num(minutos, 0)} minutos na faixa nesta semana`,
      },
        arco({ valor: minutos, meta }),
        h("div", { class: "hoje-arco-texto" },
          h("span", { class: "num" }, formatar.num(minutos, 0)),
          h("span", { class: "t-caption texto-2" }, texto),
        ),
      ),
      h("p", { class: "t-caption texto-2 hoje-legenda" },
        meta ? "minutos nesta semana" : planoAcabou ? "Plano concluído: sem meta" : "Comece o plano para ter meta"),
    );
  }

  function cartaoTreino({ sessao, rotuloSemana, ef, opcional, alternativa, aoAlternar, usandoAlternativa }) {
    const desc = descreverTreino(sessao, { vo2max: ef.vo2max, velocidade: ef.velocidadePadrao, velocidadeT7: ef.velocidadeT7 });
    const meta = [formatar.duracao(desc.duracaoS), desc.alvo, desc.inclinacao].filter(Boolean).join(" · ");
    const complemento = !usandoAlternativa && sessao.complemento
      ? `Depois do teste: mais ${sessao.complemento.minutos} min de caminhada a ${pctTexto(sessao.complemento.alvo)} do VO2máx.`
      : null;
    return cartao(
      { titulo: rotuloSemana, classe: "hoje-destaque", acao: { rotulo: "Outro treino", onClick: abrirOutroTreino, id: "hoje-outro-treino" } },
      perfilRampa(desc.fases, { altura: sessao.treino === "T7" ? 40 : 64, rotulo: `Perfil do treino: ${TREINOS[sessao.treino].nome}, ${formatar.duracao(desc.duracaoS)}` }),
      h("div", { class: "hoje-texto" },
        h("h2", { class: "hoje-nome" }, `${sessao.treino} · ${TREINOS[sessao.treino].nome}`),
        h("p", { class: "hoje-meta" }, meta),
        complemento && h("p", { class: "t-footnote texto-2" }, complemento),
        opcional && h("p", { class: "t-footnote texto-2" }, "Sessão opcional da semana."),
      ),
      alternativa && chip({
        id: "hoje-alternativa",
        rotulo: usandoAlternativa ? "Voltar ao treino do plano" : `Usar a alternativa: ${alternativa}`,
        onClick: aoAlternar,
      }),
      botao({ id: "hoje-comecar", rotulo: "Começar", icone: "play", tipo: "primario", grande: true, largo: true, onClick: () => iniciar(sessao) }),
    );
  }

  function cartaoSemConteudo({ titulo, texto, rotuloBotao, aoClicar, fases }) {
    return cartao(
      { titulo, classe: "hoje-destaque", acao: { rotulo: "Outro treino", onClick: abrirOutroTreino, id: "hoje-outro-treino" } },
      fases && perfilRampa(fases, { altura: 64, rotulo: "Exemplo de perfil de treino" }),
      h("div", { class: "hoje-texto" }, h("p", { class: "hoje-meta" }, texto)),
      rotuloBotao && botao({ id: "hoje-convite", rotulo: rotuloBotao, tipo: "primario", grande: true, largo: true, onClick: aoClicar }),
    );
  }

  async function comecarPlano() {
    try {
      await estado.salvarPerfil({ inicioPlano: hojeISO() });
      selecionadaId = null;
      alternativaId = null;
      toast("Plano iniciado hoje");
    } catch (erro) {
      if (!erro?.avisado) toast("Não consegui salvar. Tente de novo.");
    }
  }

  // ---------- Desenho ----------
  function desenhar() {
    sujo = false;
    diaDesenhado = hojeISO();
    const ef = estado.perfilEfetivo();
    const filhos = [];
    let semana = null;
    const feitas = new Map();

    if (!ef.inicioPlano) {
      filhos.push(cartaoSemConteudo({
        titulo: "Plano de 8 semanas",
        texto: "Comece hoje e o app mostra o treino de cada dia, da base aeróbica até as subidas.",
        rotuloBotao: "Começar o plano hoje",
        aoClicar: comecarPlano,
        fases: montarFases({ treino: "T3", topo: 70 }),
      }));
    } else {
      semana = semanaDoPlano(ef.inicioPlano, hojeISO());
      for (const x of sessoesDoPlano(ef.inicioPlano)) if (!feitas.has(x.planoRef)) feitas.set(x.planoRef, x);
      const dadosSemana = PLANO[semana - 1];

      const obrigatoria = proximaSessao(semana, [...feitas.keys()]);
      const escolhida = selecionadaId && !feitas.has(selecionadaId)
        ? dadosSemana.sessoes.find((x) => x.id === selecionadaId) : null;
      const opcionalPendente = dadosSemana.sessoes.find((x) => x.opcional && !feitas.has(x.id));
      const sessaoDoDia = escolhida ?? obrigatoria ?? opcionalPendente ?? null;

      if (sessaoDoDia) {
        const usandoAlternativa = !!sessaoDoDia.alternativa && alternativaId === sessaoDoDia.id;
        const sessao = usandoAlternativa ? { id: sessaoDoDia.id, ...sessaoDoDia.alternativa } : sessaoDoDia;
        const alt = sessaoDoDia.alternativa;
        filhos.push(cartaoTreino({
          sessao,
          rotuloSemana: escolhida ? "Treino em foco" : "Próximo treino",
          ef,
          opcional: sessaoDoDia.opcional,
          alternativa: alt ? `${alt.treino} · ${formatar.duracao(duracaoTotal(montarFases(alt)))}` : null,
          usandoAlternativa,
          aoAlternar: () => {
            alternativaId = usandoAlternativa ? null : sessaoDoDia.id;
            desenhar();
          },
        }));
      } else if (semana === 8) {
        filhos.push(cartaoSemConteudo({
          titulo: "Plano concluído",
          texto: "Você fez as 8 semanas. Veja a evolução no Painel ou recomece o plano.",
          rotuloBotao: "Recomeçar o plano hoje",
          aoClicar: comecarPlano,
        }));
      } else {
        const proxima = dataLocal(ef.inicioPlano, semana * 7);
        filhos.push(cartaoSemConteudo({
          titulo: `Semana ${semana} concluída`,
          texto: `A semana ${semana + 1} começa em ${formatar.data(proxima)}. Para treinar antes, escolha outro treino.`,
        }));
      }
    }

    filhos.push(h("div", { class: "grade-2" }, cartaoVO2(ef), cartaoFaixa(semana, ef)));

    if (semana) {
      const dados = PLANO[semana - 1];
      const idDoDia = (() => {
        const ob = proximaSessao(semana, [...feitas.keys()]);
        return selecionadaId && !feitas.has(selecionadaId) ? selecionadaId : ob?.id;
      })();
      const linhas = dados.sessoes.map((x) => {
        const feita = feitas.get(x.id);
        const duracao = formatar.duracao(duracaoTotal(montarFases(x)));
        const partes = [x.id, x.treino];
        if (x.opcional) partes.push("opcional");
        if (feita) partes.push(`feito ${formatar.data(feita.inicio)}`);
        else if (x.alternativa) {
          partes.push(`ou ${x.alternativa.treino} · ${formatar.duracao(duracaoTotal(montarFases(x.alternativa)))}`);
        }
        const noDia = !feita && x.id === idDoDia;
        // "Em foco" vai no detalhe, e o acessório tem largura fixa (check ou
        // vazio): assim as durações ficam alinhadas na mesma coluna.
        const detalhe = noDia
          ? [partes.join(" · "), " · ", h("span", { class: "hoje-marca" }, "em foco")]
          : partes.join(" · ");
        return linha({
          id: `hoje-sessao-${x.id}`,
          rotulo: TREINOS[x.treino].nome,
          detalhe,
          valor: duracao,
          acessorio: feita ? "check" : h("span", { class: "hoje-acessorio-vazio", "aria-hidden": "true" }),
          onClick: feita ? undefined : () => {
            selecionadaId = x.id;
            desenhar();
            window.scrollTo({ top: 0, behavior: "smooth" });
          },
        });
      });
      filhos.push(grupo({
        titulo: `Semana ${semana} · ${dados.fase}`,
        id: "hoje-semana",
        rodape: "Toque numa sessão pendente para vê-la em destaque.",
      }, ...linhas));
    }

    el.replaceChildren(...filhos);
  }

  // ---------- Sheet "Outro treino" ----------
  function abrirOutroTreino() {
    const ef = estado.perfilEfetivo();
    const padroes = {
      T1: { minutos: 30, alvo: 55 },
      T2: { minutos: 25, alvo: 60 },
      T3: { topo: 65 },
      T4: { nivel: 1 },
      T5: { blocos: 2, minutos: 8 },
      T6: { blocos: 3 },
      T7: {},
    };
    let treino = "T1";
    const params = structuredClone(padroes);
    const montar = () => ({ treino, ...params[treino] });

    const nome = h("h3", { class: "hoje-sheet-nome" });
    const resumo = h("p", { class: "t-footnote texto-2" });
    const campos = h("div", { class: "hoje-campos" });
    const previa = h("div", { class: "hoje-previa" });

    const pintarPrevia = () => {
      const sessao = montar();
      const desc = descreverTreino(sessao, { vo2max: ef.vo2max, velocidade: ef.velocidadePadrao, velocidadeT7: ef.velocidadeT7 });
      previa.replaceChildren(
        perfilRampa(desc.fases, { altura: 56, rotulo: `Prévia do ${treino}` }),
        h("p", { class: "hoje-meta", "aria-live": "polite" },
          [formatar.duracao(desc.duracaoS), desc.alvo, desc.inclinacao].filter(Boolean).join(" · ")),
      );
    };

    const campo = (cfg) => stepper({ ...cfg, onChange: (v) => { params[treino][cfg.chave] = v; pintarPrevia(); } });

    const pintarCampos = () => {
      const p = params[treino];
      nome.textContent = TREINOS[treino].nome;
      resumo.textContent = TREINOS[treino].resumo;
      let conteudo;
      if (treino === "T1" || treino === "T2") {
        conteudo = h("div", { class: "grade-2" },
          campo({ chave: "minutos", id: "outro-minutos", rotulo: "Duração", valor: p.minutos, passo: 5, min: 10, max: 90, unidade: "min" }),
          campo({ chave: "alvo", id: "outro-alvo", rotulo: "Alvo, % do VO2máx", valor: p.alvo, passo: 5, min: 45, max: 85, unidade: "%" }),
        );
      } else if (treino === "T3") {
        conteudo = campo({ chave: "topo", id: "outro-topo", rotulo: "Topo da pirâmide", valor: p.topo, passo: 5, min: 55, max: 75, unidade: "% do VO2máx" });
      } else if (treino === "T4") {
        conteudo = segmentado({
          id: "outro-nivel",
          rotulo: "Nível dos tiros",
          opcoes: [1, 2, 3].map((n) => ({ valor: n, rotulo: `Nível ${n}` })),
          valor: p.nivel,
          onChange: (v) => { p.nivel = v; pintarPrevia(); },
        });
      } else if (treino === "T5") {
        conteudo = h("div", { class: "grade-2" },
          campo({ chave: "blocos", id: "outro-blocos", rotulo: "Blocos", valor: p.blocos, passo: 1, min: 2, max: 4 }),
          campo({ chave: "minutos", id: "outro-minutos-bloco", rotulo: "Por bloco", valor: p.minutos, passo: 1, min: 4, max: 15, unidade: "min" }),
        );
      } else if (treino === "T6") {
        conteudo = campo({ chave: "blocos", id: "outro-blocos", rotulo: "Subidas", valor: p.blocos, passo: 1, min: 2, max: 6 });
      } else {
        conteudo = h("p", { class: "t-callout texto-2" },
          "Sem parâmetros. Caminhe numa velocidade fixa entre 3,2 e 7,2 km/h e use a mesma em todos os testes.");
      }
      campos.replaceChildren(conteudo);
    };

    const seletor = segmentado({
      id: "outro-treino-tipo",
      rotulo: "Treino",
      opcoes: Object.keys(TREINOS).map((t) => ({ valor: t, rotulo: t })),
      valor: treino,
      onChange: (v) => { treino = v; pintarCampos(); pintarPrevia(); },
    });

    pintarCampos();
    pintarPrevia();

    abrirSheet({
      titulo: "Outro treino",
      classe: "hoje-sheet",
      conteudo: h("div", { class: "pilha hoje-sheet-corpo" },
        seletor,
        h("div", { class: "hoje-sheet-cabeca" }, nome, resumo),
        campos,
        previa,
      ),
      acoes: [{
        rotulo: "Começar",
        tipo: "primario",
        icone: "play",
        id: "outro-comecar",
        onClick: (fechar) => { fechar(); iniciar(montar()); },
      }],
    });
  }

  desenhar();
  return tela;
}

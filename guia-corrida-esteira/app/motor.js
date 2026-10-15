// Motor da sessão ao vivo: cronômetro, fases, amostras, leituras e o T7.
// Não toca no DOM. Relógio e agendador são injetáveis para testar em Node
// com tempo falso.
//
// O tempo ativo vem do relógio (performance.now), não da contagem de
// chamadas do agendador: um setInterval atrasado ou uma aba em segundo plano
// não faz o cronômetro escorregar, só processa os segundos de uma vez.

import { montarFases, modoDoTreino } from "../src/treinos.js";
import { vo2Esteira, inclinacaoParaMets, vo2maxEbbeling, ML_POR_MET } from "../src/calculadora.js";

export const PASSO_AMOSTRA = 5;
export const MIN_ATIVO_S = 60;
export const INTERVALO_AVISO_S = 20;
export const LIMITES = {
  velocidade: { min: 1, max: 18 },
  inclinacao: { min: 0, max: 20 },
  fc: { min: 30, max: 240 },
};
// FC mais velha que isso não entra na amostra.
const FC_VALIDA_MS = 60000;
// FC do Bluetooth mais nova que isso responde sozinha ao pedido do T7.
const FC_AUTOMATICA_MS = 10000;
// Protocolo de Ebbeling (docs/04): se as leituras dos minutos 3 e 4 diferirem
// mais de 5 bpm, caminha mais 1 minuto e usa as duas últimas.
const DIFERENCA_T7 = 5;
const EXTENSAO_T7 = 60;
const MAX_EXTENSOES_T7 = 1;
const VELOCIDADE_T7 = { min: 3.2, max: 7.2 };
const MIN_TICK_MS = 250;

const arred = (v, passo) => Number((Math.round(v / passo) * passo).toFixed(2));
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
const umaCasa = (v) => Math.round(v * 10) / 10;
const copiar = (obj) => JSON.parse(JSON.stringify(obj));

function agendadorPadrao(fn, ms) {
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
}

const relogioPadrao = () => performance.now();

// Nos tiros (teto 100%) só o piso conta: passar dele ainda é acerto.
export function situacaoPara(pct, alvo) {
  if (!alvo || !Number.isFinite(pct)) return "sem-alvo";
  if (pct < alvo.de) return "abaixo";
  if (alvo.ate < 100 && pct > alvo.ate) return "acima";
  return "na-faixa";
}

// Velocidade (passo 0,1) para o VO2 pedido na inclinação dada: a menor que
// alcança o alvo, se ela ainda cabe na faixa. Varre em vez de resolver a
// equação porque no modo "auto" (tiros) a troca caminhada/corrida em 6,5 km/h
// deixa o custo descontínuo: com VO2máx baixo, 6,4 fica abaixo da faixa e 6,5
// acima dela. Nesse caso devolve a mais próxima do centro e exata = false.
function velocidadeParaVo2(vo2Alvo, inclinacaoPct, faixa = null, modo = "auto") {
  const { min, max } = LIMITES.velocidade;
  const custo = (v) => vo2Esteira({ velocidadeKmh: v, inclinacaoPct, modo });
  const naFaixa = (vo2) => !faixa || (vo2 >= faixa.de - 1e-9 && vo2 <= faixa.ate + 1e-9);
  let primeira = null;
  let melhor = max;
  let menorDistancia = Infinity;
  for (let v = min; v <= max + 1e-9; v = umaCasa(v + 0.1)) {
    const vo2 = custo(v);
    if (primeira == null && vo2 >= vo2Alvo) primeira = v;
    const distancia = Math.abs(vo2 - vo2Alvo);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      melhor = v;
    }
  }
  if (primeira != null && naFaixa(custo(primeira))) return { kmh: primeira, exata: true };
  return { kmh: melhor, exata: naFaixa(custo(melhor)) };
}

// Carga que leva ao centro da faixa-alvo. Sem inclinação fixa, sugere a
// inclinação na velocidade atual (0,5 em 0,5, de 0 a 20%) e, se nem 20% ou
// nem 0% resolvem, uma velocidade. Com inclinação fixa, sugere só a velocidade.
// semVelocidadeNaFaixa: nenhuma velocidade cai na faixa nessa inclinação; a
// sugerida é só a mais próxima.
export function sugerirCarga({ velocidade, alvo, vo2max, inclinacaoFixa = null, modo = "auto" }) {
  const temAlvo = !!alvo && vo2max > 0 && velocidade > 0;
  if (!temAlvo) return { inclinacaoSugerida: inclinacaoFixa ?? null, kmhSugerida: null, semVelocidadeNaFaixa: false };
  const centro = (alvo.de + alvo.ate) / 2;
  const vo2Alvo = (centro / 100) * vo2max;
  // Nos tiros (teto 100%) não há teto prático: só o piso conta.
  const faixa = { de: (alvo.de / 100) * vo2max, ate: alvo.ate >= 100 ? Infinity : (alvo.ate / 100) * vo2max };
  if (inclinacaoFixa != null) {
    const { kmh, exata } = velocidadeParaVo2(vo2Alvo, inclinacaoFixa, faixa, modo);
    return { inclinacaoSugerida: inclinacaoFixa, kmhSugerida: kmh, semVelocidadeNaFaixa: !exata };
  }
  const bruta = inclinacaoParaMets({ velocidadeKmh: velocidade, mets: vo2Alvo / ML_POR_MET, modo });
  const { min, max } = LIMITES.inclinacao;
  const inclinacaoSugerida = limitar(arred(bruta, 0.5), min, max);
  let kmhSugerida = null;
  let semVelocidadeNaFaixa = false;
  if (bruta > max || bruta < min) {
    const { kmh, exata } = velocidadeParaVo2(vo2Alvo, bruta > max ? max : min, faixa, modo);
    kmhSugerida = kmh;
    semVelocidadeNaFaixa = !exata;
  }
  return { inclinacaoSugerida, kmhSugerida, semVelocidadeNaFaixa };
}

export function sessaoSalvavel(sessao) {
  const { amostras } = sessao ?? {};
  return !!amostras && amostras.v.length * (amostras.passo ?? PASSO_AMOSTRA) >= MIN_ATIVO_S;
}

function limparFase({ dica, coletarFc, ...fase }) {
  return fase;
}

/**
 * criarSessao({ treino, planoRef, sessaoPlano, perfil, relogio?, agendador?, agora?, rascunho? })
 *   perfil      perfil efetivo (vo2max, idade, sexo, pesoKg, fcMax, fcRepouso, velocidadePadrao, velocidadeT7)
 *   relogio()   ms monotônicos (padrão performance.now)
 *   agendador(fn, ms) → cancelar   (padrão setInterval)
 *   agora()     ms de época, para inicio e idade da FC (padrão Date.now)
 *   rascunho    objeto de motor.rascunho(); a sessão volta em pausa
 */
export function criarSessao({
  treino,
  planoRef,
  sessaoPlano,
  perfil = {},
  relogio = relogioPadrao,
  agendador = agendadorPadrao,
  agora = () => Date.now(),
  rascunho = null,
} = {}) {
  const plano = sessaoPlano ?? rascunho?.sessaoPlano ?? { treino };
  const modo = modoDoTreino(plano.treino);
  treino = treino ?? rascunho?.treino ?? plano.treino;
  planoRef = planoRef ?? rascunho?.planoRef ?? null;
  const perfilSessao = { ...(rascunho?.perfil ?? perfil) };
  const vo2max = perfilSessao.vo2max > 0 ? perfilSessao.vo2max : null;
  const ouvintes = new Map();

  const velocidadeInicial = limitar(
    (treino === "T7" ? perfilSessao.velocidadeT7 : null) ?? perfilSessao.velocidadePadrao ?? 5,
    LIMITES.velocidade.min, LIMITES.velocidade.max,
  );

  const e = {
    fases: montarFases(plano),
    iFase: 0,
    segFase: 0,
    segTotal: 0,
    rodando: false,
    iniciado: false,
    terminado: false,
    velocidade: velocidadeInicial,
    inclinacao: 0,
    fc: null,
    fcEm: null,
    fcOrigem: null,
    amostras: { passo: PASSO_AMOSTRA, v: [], i: [], fc: [], f: [] },
    t7: treino === "T7" ? { leituras: [], pendente: null, marcas: null, extensoes: 0, somaV: 0, nV: 0, resultado: null } : null,
    inicio: null,
    situacaoAvisada: "sem-alvo",
    ultimoAviso: null,
  };

  let ativoMs = 0; // tempo ativo acumulado até a última pausa
  let desde = null; // relogio() de quando voltou a rodar
  let cancelar = null;

  if (rascunho?.estado) {
    Object.assign(e, copiar(rascunho.estado), { rodando: false, iniciado: true, fc: null, fcEm: null, fcOrigem: null });
    ativoMs = e.segTotal * 1000;
  }

  function emitir(evento, dados) {
    for (const fn of ouvintes.get(evento) ?? []) {
      try {
        fn(dados, motor);
      } catch (erro) {
        console.error(erro);
      }
    }
  }

  const faseAtual = () => e.fases[e.iFase];
  const ativoAgoraMs = () => ativoMs + (e.rodando && desde != null ? relogio() - desde : 0);

  function fcValida(janelaMs) {
    return e.fc != null && e.fcEm != null && agora() - e.fcEm <= janelaMs;
  }

  function leituras() {
    const fase = faseAtual();
    const { velocidade, inclinacao } = e;
    const vo2 = velocidade > 0 ? vo2Esteira({ velocidadeKmh: velocidade, inclinacaoPct: inclinacao, modo }) : null;
    const pctVO2 = vo2 != null && vo2max ? (vo2 / vo2max) * 100 : null;
    const alvo = fase?.alvo ?? null;
    const sugestao = sugerirCarga({ velocidade, alvo, vo2max, inclinacaoFixa: fase?.inclinacaoFixa ?? null, modo });
    let pctSugerido = null;
    if (vo2max && sugestao.inclinacaoSugerida != null) {
      const v = sugestao.kmhSugerida ?? velocidade;
      pctSugerido = (vo2Esteira({ velocidadeKmh: v, inclinacaoPct: sugestao.inclinacaoSugerida, modo }) / vo2max) * 100;
    }
    return {
      vo2,
      mets: vo2 != null ? vo2 / ML_POR_MET : null,
      pctVO2,
      alvo,
      situacao: situacaoPara(pctVO2, alvo),
      ...sugestao,
      pctSugerido,
    };
  }

  function registrarAmostra() {
    const { amostras } = e;
    amostras.v.push(e.velocidade);
    amostras.i.push(e.inclinacao);
    amostras.fc.push(fcValida(FC_VALIDA_MS) ? e.fc : null);
    amostras.f.push(e.iFase);
    emitir("amostra", { indice: amostras.v.length - 1 });
  }

  // Mudança de situação avisa (bipe), no máximo uma vez a cada 20 s.
  // A troca para "sem-alvo" e a situação ao entrar numa fase não avisam:
  // a pílula da troca de fase já cumpre esse papel.
  function avaliarSituacao() {
    const atual = leituras().situacao;
    if (atual === e.situacaoAvisada) return;
    if (atual === "sem-alvo") {
      e.situacaoAvisada = atual;
      return;
    }
    if (e.ultimoAviso != null && e.segTotal - e.ultimoAviso < INTERVALO_AVISO_S) return;
    const de = e.situacaoAvisada;
    e.situacaoAvisada = atual;
    e.ultimoAviso = e.segTotal;
    emitir("situacao", { de, para: atual, leituras: leituras() });
  }

  function entrarNaFase(k, motivo) {
    const anterior = e.iFase;
    e.iFase = k;
    e.segFase = 0;
    const fase = faseAtual();
    if (fase.inclinacaoFixa != null) e.inclinacao = fase.inclinacaoFixa;
    if (fase.coletarFc && e.t7 && !e.t7.marcas) e.t7.marcas = [...fase.coletarFc];
    e.situacaoAvisada = leituras().situacao;
    emitir("fase", { iFase: k, anterior, fase, motivo, leituras: leituras() });
  }

  function terminar() {
    if (e.rodando) {
      ativoMs = ativoAgoraMs();
      e.rodando = false;
    }
    e.terminado = true;
    e.segFase = faseAtual().segundos;
    cancelar?.();
    cancelar = null;
    emitir("fim", { segTotal: e.segTotal });
  }

  function irPara(k, motivo) {
    if (k >= e.fases.length) return terminar();
    entrarNaFase(Math.max(0, k), motivo);
  }

  // ---------- T7 ----------
  function pedirFc(marca) {
    const t7 = e.t7;
    if (e.fcOrigem === "bluetooth" && fcValida(FC_AUTOMATICA_MS)) {
      t7.leituras.push({ marca, fc: e.fc });
      emitir("pedirFc", { marca, automatico: true, fc: e.fc });
      return;
    }
    // Um pedido anterior sem resposta fica registrado como perdido.
    if (t7.pendente != null) t7.leituras.push({ marca: t7.pendente, fc: null });
    t7.pendente = marca;
    emitir("pedirFc", { marca, automatico: false });
  }

  function calcularT7() {
    const t7 = e.t7;
    if (t7.pendente != null) {
      t7.leituras.push({ marca: t7.pendente, fc: null });
      t7.pendente = null;
    }
    const validas = t7.leituras.filter((l) => l.fc > 0).slice(-2);
    const velocidade = t7.nV ? umaCasa(t7.somaV / t7.nV) : null;
    const resultado = { velocidade, fcFinal: null, vo2max: null, leituras: validas.map((l) => l.fc), erro: null };
    if (!validas.length) {
      resultado.erro = "sem-fc";
    } else {
      resultado.fcFinal = umaCasa(validas.reduce((s, l) => s + l.fc, 0) / validas.length);
      const { idade, sexo } = perfilSessao;
      if (!(velocidade >= VELOCIDADE_T7.min && velocidade <= VELOCIDADE_T7.max)) resultado.erro = "velocidade";
      else if (!(idade > 0) || (sexo !== "m" && sexo !== "f")) resultado.erro = "perfil";
      else resultado.vo2max = umaCasa(vo2maxEbbeling({ velocidadeKmh: velocidade, fcFinal: resultado.fcFinal, idade, sexo }));
    }
    t7.resultado = resultado;
    emitir("t7", resultado);
  }

  // Fim do estágio com coleta: espera a FC pendente, estende se preciso, calcula.
  function concluirEstagioT7() {
    const t7 = e.t7;
    if (t7.pendente != null) return false; // o estágio continua até a FC chegar
    const validas = t7.leituras.filter((l) => l.fc > 0).slice(-2);
    if (validas.length === 2 && Math.abs(validas[0].fc - validas[1].fc) > DIFERENCA_T7 && t7.extensoes < MAX_EXTENSOES_T7) {
      t7.extensoes++;
      // Conta a partir de agora, não do fim previsto: se a FC chegou atrasada,
      // o minuto extra ainda é inteiro e a terceira leitura fica no futuro.
      const fase = faseAtual();
      fase.segundos = e.segFase + EXTENSAO_T7;
      t7.marcas.push(fase.segundos);
      emitir("extensao", { diferenca: Math.abs(validas[0].fc - validas[1].fc), segundos: fase.segundos });
      return false;
    }
    calcularT7();
    return true;
  }

  function concluirFase() {
    const fase = faseAtual();
    if (fase.coletarFc && e.t7 && !e.t7.resultado && !concluirEstagioT7()) return;
    irPara(e.iFase + 1, "tempo");
  }

  function umSegundo(emTempoReal) {
    e.segTotal++;
    e.segFase++;
    const fase = faseAtual();
    if (e.t7 && fase.coletarFc && !e.t7.resultado) {
      e.t7.somaV += e.velocidade;
      e.t7.nV++;
      if (e.t7.marcas?.includes(e.segFase)) pedirFc(e.segFase);
    }
    if (e.segTotal % PASSO_AMOSTRA === 0) registrarAmostra();
    avaliarSituacao();
    if (e.segFase >= fase.segundos) {
      concluirFase();
      return;
    }
    const restante = fase.segundos - e.segFase;
    // No estágio com coleta o fim depende da FC; contagem ali confundiria.
    if (emTempoReal && restante <= 3 && !(fase.coletarFc && e.t7 && !e.t7.resultado)) {
      emitir("contagem", { restante, proxima: e.fases[e.iFase + 1] ?? null });
    }
  }

  function atualizar() {
    if (!e.rodando || e.terminado) return;
    const alvo = Math.floor(ativoAgoraMs() / 1000);
    if (alvo <= e.segTotal) return;
    while (e.rodando && !e.terminado && e.segTotal < alvo) umSegundo(alvo - e.segTotal <= 1);
    emitir("tick", { segTotal: e.segTotal, segFase: e.segFase, iFase: e.iFase });
  }

  function ligarAgendador() {
    cancelar ??= agendador(atualizar, MIN_TICK_MS);
  }

  const motor = {
    get estado() {
      return e;
    },
    get fase() {
      return faseAtual();
    },
    get perfil() {
      return perfilSessao;
    },
    get salvavel() {
      return e.segTotal >= MIN_ATIVO_S;
    },
    // Segundos que faltam na fase atual (0 enquanto o T7 espera a FC).
    get restanteFase() {
      return Math.max(0, faseAtual().segundos - e.segFase);
    },
    leituras,
    atualizar,

    ao(evento, fn) {
      if (!ouvintes.has(evento)) ouvintes.set(evento, new Set());
      ouvintes.get(evento).add(fn);
      return () => ouvintes.get(evento)?.delete(fn);
    },

    iniciar() {
      if (e.iniciado) return motor.retomar();
      e.iniciado = true;
      e.inicio = new Date(agora()).toISOString();
      entrarNaFase(0, "inicio");
      e.rodando = true;
      desde = relogio();
      ligarAgendador();
    },

    pausar() {
      if (!e.rodando) return;
      atualizar();
      ativoMs = ativoAgoraMs();
      e.rodando = false;
      desde = null;
      emitir("pausa", { rodando: false });
    },

    retomar() {
      if (e.rodando || e.terminado) return;
      if (!e.iniciado) return motor.iniciar();
      e.rodando = true;
      desde = relogio();
      ligarAgendador();
      emitir("pausa", { rodando: true });
    },

    pularFase() {
      if (e.terminado) return;
      const fase = faseAtual();
      if (fase.coletarFc && e.t7 && !e.t7.resultado) calcularT7();
      irPara(e.iFase + 1, "pulo");
    },

    voltarFase() {
      if (e.terminado) return;
      irPara(e.iFase - 1, "volta");
    },

    definirVelocidade(kmh) {
      if (!Number.isFinite(kmh)) return e.velocidade;
      e.velocidade = umaCasa(limitar(kmh, LIMITES.velocidade.min, LIMITES.velocidade.max));
      return e.velocidade;
    },

    definirInclinacao(pct) {
      if (!Number.isFinite(pct)) return e.inclinacao;
      e.inclinacao = arred(limitar(pct, LIMITES.inclinacao.min, LIMITES.inclinacao.max), 0.5);
      return e.inclinacao;
    },

    definirFc(bpm, origem = "manual") {
      const fc = Math.round(bpm);
      if (!(fc >= LIMITES.fc.min && fc <= LIMITES.fc.max)) return false;
      e.fc = fc;
      e.fcEm = agora();
      e.fcOrigem = origem;
      const t7 = e.t7;
      if (t7?.pendente != null) {
        t7.leituras.push({ marca: t7.pendente, fc });
        const marca = t7.pendente;
        t7.pendente = null;
        emitir("fcColetada", { marca, fc });
        const fase = faseAtual();
        if (fase.coletarFc && e.segFase >= fase.segundos && !e.terminado) concluirFase();
      }
      emitir("fc", { fc, origem });
      return true;
    },

    // Estado serializável para o rascunho (localStorage).
    rascunho() {
      const { rodando, iniciado, fc, fcEm, fcOrigem, ...resto } = e;
      return copiar({
        versao: 1,
        treino,
        planoRef,
        sessaoPlano: plano,
        perfil: perfilSessao,
        segTotal: e.segTotal,
        estado: resto,
      });
    },

    // Para o cronômetro e devolve a sessão no formato de src/resumo.js.
    encerrar() {
      atualizar();
      if (e.rodando) ativoMs = ativoAgoraMs();
      e.rodando = false;
      cancelar?.();
      cancelar = null;
      const inicio = e.inicio ?? new Date(agora()).toISOString();
      const sessao = {
        id: `s_${Date.parse(inicio).toString(36)}`,
        inicio,
        treino,
        planoRef,
        vo2max,
        pesoKg: perfilSessao.pesoKg ?? null,
        fcMax: perfilSessao.fcMax ?? null,
        fcRepouso: perfilSessao.fcRepouso ?? null,
        fases: e.fases.map(limparFase),
        amostras: copiar(e.amostras),
      };
      const r = e.t7?.resultado;
      if (r?.vo2max) sessao.t7 = { velocidade: r.velocidade, fcFinal: r.fcFinal, vo2max: r.vo2max };
      return sessao;
    },
  };
  return motor;
}

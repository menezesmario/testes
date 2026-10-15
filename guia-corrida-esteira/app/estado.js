// Store da aplicação: perfil, sessões, onde os dados estão e a sessão ativa.
// Enquanto não há dados do usuário, mostra o EXEMPLO (nunca gravado).

import * as armazenamento from "./armazenamento.js";
import { toast } from "./ui.js";
import { fcMaxEstimada, vo2maxUth } from "../src/calculadora.js";
import { perfilExemplo, sessoesExemplo } from "./exemplo.js";

const ouvintes = new Set();

export const estado = {
  perfil: perfilExemplo(),
  perfilExemplo: true, // perfil acima é o de exemplo
  sessoes: sessoesExemplo(), // desc por inicio; não mutar
  exemplo: true, // sessões acima são de exemplo
  modoArmazenamento: "carregando", // 'conta' | 'aparelho' | 'carregando'
  carregado: false, // perfil e sessões do armazenamento já chegaram
  perfilLido: false, // a primeira leitura do perfil já terminou (com ou sem erro)
  erroCarga: false, // o perfil guardado existe mas não deu para ler
  sessaoAtiva: null,
};

function emitir() {
  for (const fn of ouvintes) {
    try {
      fn(estado);
    } catch (e) {
      console.error(e);
    }
  }
}

export function assinar(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function aplicarPerfil(perfil) {
  if (perfil && typeof perfil === "object") {
    estado.perfil = perfil;
    estado.perfilExemplo = false;
  } else {
    estado.perfil = perfilExemplo();
    estado.perfilExemplo = true;
  }
}

function aplicarSessoes(lista) {
  if (lista?.length) {
    estado.sessoes = [...lista].sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
    estado.exemplo = false;
  } else {
    estado.sessoes = sessoesExemplo();
    estado.exemplo = true;
  }
}

let promessaInicio = null;
let promessaPerfil = null;

// Erro ao ler não é o mesmo que perfil ausente: com erro, o exemplo aparece
// na tela, mas nenhuma gravação pode partir dele (apagaria o perfil guardado).
async function lerPerfil() {
  try {
    aplicarPerfil(await armazenamento.carregarPerfil());
    estado.erroCarga = false;
  } catch {
    if (estado.perfilExemplo) aplicarPerfil(null);
    estado.erroCarga = true;
  }
}

export function iniciar() {
  promessaInicio ??= (async () => {
    armazenamento.aoMudarModo(async (modo) => {
      estado.modoArmazenamento = modo;
      emitir();
      // Caiu da conta para o aparelho no meio do uso: recarrega o perfil local.
      if (modo === "aparelho" && estado.carregado) {
        await lerPerfil();
        emitir();
      }
    });
    promessaPerfil = (async () => {
      estado.modoArmazenamento = await armazenamento.iniciar();
      emitir();
      await lerPerfil();
      estado.perfilLido = true;
      emitir();
    })();
    await promessaPerfil;
    await new Promise((pronto) => {
      let primeira = true;
      // Se a primeira lista não chegar, o app segue com o que tem.
      const limite = setTimeout(pronto, 12000);
      armazenamento.assinarSessoes((lista) => {
        aplicarSessoes(lista);
        if (primeira) {
          primeira = false;
          clearTimeout(limite);
          pronto();
        } else emitir();
      });
    });
    estado.carregado = true;
    emitir();
  })();
  return promessaInicio;
}

const falha = (mensagem, code) => {
  toast(mensagem, { duracao: 4000 });
  return Object.assign(new Error(mensagem), { code, avisado: true });
};

// Antes de gravar o perfil: espera a leitura e, se ela falhou, tenta de novo.
// Sem o perfil real em mãos, recusa; gravar por cima do exemplo apagaria o guardado.
async function perfilPronto() {
  iniciar();
  await promessaPerfil;
  if (estado.erroCarga) {
    await lerPerfil();
    emitir();
  }
  if (estado.erroCarga) throw falha("Não deu para ler seu perfil salvo. Recarregue a página antes de editar.", "carga_falhou");
}

// Gravações de sessão esperam também a primeira lista, para não esconder
// as sessões guardadas nem apagar só parte delas.
async function tudoPronto() {
  await perfilPronto();
  await iniciar();
}

const semVazios = (obj) => Object.fromEntries(
  Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "" && !Number.isNaN(v)),
);

// Sobre o exemplo, o merge aproveita os dados pessoais mas não o VO2máx,
// a velocidade do T7 nem o início do plano, que são só ilustração.
function baseParaSalvar() {
  if (!estado.perfilExemplo) return estado.perfil;
  const { vo2max, velocidadeT7, inicioPlano, exemplo, nome, ...resto } = estado.perfil;
  return resto;
}

// Aplica já (a tela responde na hora) e desfaz se a gravação falhar.
async function otimista(aplicar, gravar) {
  const antes = { perfil: estado.perfil, perfilExemplo: estado.perfilExemplo, sessoes: estado.sessoes, exemplo: estado.exemplo };
  aplicar();
  emitir();
  try {
    await gravar();
  } catch (erro) {
    Object.assign(estado, antes);
    emitir();
    throw erro;
  }
}

export async function salvarPerfil(parcial) {
  await perfilPronto();
  const novo = semVazios({ ...baseParaSalvar(), ...parcial });
  delete novo.exemplo;
  await otimista(() => aplicarPerfil(novo), () => armazenamento.salvarPerfil(novo));
  return novo;
}

export async function salvarSessao(sessao) {
  await tudoPronto();
  const { exemplo, ...limpa } = sessao;
  const base = estado.exemplo ? [] : estado.sessoes.filter((s) => s.id !== limpa.id);
  await otimista(() => aplicarSessoes([...base, limpa]), () => armazenamento.salvarSessao(limpa));
  return limpa;
}

export async function apagarSessao(id) {
  await tudoPronto();
  if (estado.exemplo) return;
  await otimista(() => aplicarSessoes(estado.sessoes.filter((s) => s.id !== id)), () => armazenamento.apagarSessao(id));
}

export async function apagarTudo() {
  await tudoPronto();
  await armazenamento.apagarTudo();
  aplicarPerfil(null);
  aplicarSessoes([]);
  emitir();
}

// Restaura um backup JSON { perfil, sessoes }. Grava uma sessão por vez.
export async function importarBackup({ perfil, sessoes = [] } = {}) {
  await tudoPronto();
  if (perfil) {
    const limpo = semVazios({ ...perfil });
    delete limpo.exemplo;
    await armazenamento.salvarPerfil(limpo);
    aplicarPerfil(limpo);
  }
  const validas = sessoes.filter((s) => s && s.id && s.inicio && s.amostras);
  const gravadas = [];
  try {
    for (const s of validas) {
      await armazenamento.salvarSessao(s);
      gravadas.push(s);
    }
  } finally {
    // Mostra só o que de fato foi gravado, mesmo se parou no meio.
    const ids = new Set(gravadas.map((s) => s.id));
    const atuais = estado.exemplo ? [] : estado.sessoes.filter((s) => !ids.has(s.id));
    if (gravadas.length) aplicarSessoes([...atuais, ...gravadas]);
    emitir();
  }
  return gravadas.length;
}

// O T7 das sessões de exemplo não é do usuário: não vira VO2máx dele.
export function ultimoT7() {
  if (estado.exemplo) return null;
  return estado.sessoes.find((s) => s.t7?.vo2max > 0 && !s.exemplo) ?? null;
}

// Perfil com os valores que faltam preenchidos.
// vo2maxOrigem: 'manual' | 't7' | 'estimado' (Uth) | 'exemplo' | null
export function perfilEfetivo() {
  const p = { sexo: "m", velocidadePadrao: 5, ...estado.perfil };
  const fcMaxInformada = p.fcMax > 0;
  const fcMax = fcMaxInformada ? p.fcMax : p.idade > 0 ? fcMaxEstimada(p.idade) : null;
  const t7 = ultimoT7();
  let vo2max = null;
  let vo2maxOrigem = null;
  if (p.vo2max > 0) {
    vo2max = p.vo2max;
    vo2maxOrigem = estado.perfilExemplo ? "exemplo" : "manual";
  } else if (t7) {
    vo2max = t7.t7.vo2max;
    vo2maxOrigem = "t7";
  } else if (fcMax && p.fcRepouso > 0 && p.fcRepouso < fcMax) {
    vo2max = vo2maxUth({ fcMax, fcRepouso: p.fcRepouso });
    vo2maxOrigem = "estimado";
  }
  return {
    ...p,
    fcMax,
    fcMaxOrigem: fcMax ? (fcMaxInformada ? "informada" : "estimada") : null,
    velocidadePadrao: p.velocidadePadrao > 0 ? p.velocidadePadrao : 5,
    vo2max,
    vo2maxOrigem,
    exemplo: estado.perfilExemplo,
  };
}

export function definirSessaoAtiva(sessao) {
  estado.sessaoAtiva = sessao ?? null;
  emitir();
}

// Rascunho da sessão ao vivo: sempre neste aparelho (localStorage).
export const salvarRascunho = (r) => armazenamento.salvarRascunho(r);
export const lerRascunho = () => armazenamento.lerRascunho();
export const apagarRascunho = () => armazenamento.apagarRascunho();

// Os métodos também ficam no próprio objeto (não enumeráveis), para as telas
// usarem ctx.estado.perfil e ctx.estado.assinar(...) com o mesmo objeto.
Object.defineProperties(estado, Object.fromEntries(Object.entries({
  assinar, iniciar, salvarPerfil, salvarSessao, apagarSessao, apagarTudo, importarBackup,
  perfilEfetivo, ultimoT7, definirSessaoAtiva, salvarRascunho, lerRascunho, apagarRascunho,
}).map(([nome, fn]) => [nome, { value: fn, enumerable: false }])));

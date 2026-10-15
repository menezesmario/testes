// Persistência: db do Artifact (conta do Claude) ou localStorage (este aparelho).
// O rascunho da sessão ativa fica sempre no localStorage, porque precisa
// sobreviver a uma queda de conexão no meio do treino.

import { toast } from "./ui.js";

const CHAVE = {
  perfil: "esteira:perfil",
  sessoes: "esteira:sessoes",
  rascunho: "esteira:rascunho",
};
const DOC_PERFIL = "perfil/atual";
const COLECAO_SESSOES = "sessoes";
// Códigos que significam "este view não tem mais db": seguimos no aparelho.
const SEM_DB = new Set(["revoked", "not_granted", "capability_disabled", "capability_removed"]);

let db = null;
let modoAtual = "carregando";
let promessaInicio = null;
let pararSnapshot = null;
let ultimasSessoes = null;
let assinaturaIniciada = false;
const ouvintesSessoes = new Set();
const ouvintesModo = new Set();

// ---------- localStorage ----------
function lerLocal(chave, padrao) {
  try {
    const texto = localStorage.getItem(chave);
    return texto ? JSON.parse(texto) : padrao;
  } catch {
    return padrao;
  }
}

function gravarLocal(chave, valor) {
  try {
    if (valor == null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

const ordenar = (lista) => [...lista].sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
const sessoesLocais = () => ordenar(lerLocal(CHAVE.sessoes, []).filter((s) => s && s.id));

function gravarLocalOuAvisar(chave, valor) {
  if (!gravarLocal(chave, valor)) {
    toast("Não deu para salvar neste aparelho. O armazenamento do navegador está cheio ou bloqueado.");
    throw Object.assign(new Error("localStorage indisponível"), { code: "local_falhou", avisado: true });
  }
}

// ---------- modo e avisos ----------
export const modo = () => modoAtual;

export function aoMudarModo(fn) {
  ouvintesModo.add(fn);
  return () => ouvintesModo.delete(fn);
}

function definirModo(novo) {
  if (novo === modoAtual) return;
  modoAtual = novo;
  for (const fn of ouvintesModo) fn(novo);
}

function emitirSessoes(lista) {
  ultimasSessoes = lista;
  for (const fn of ouvintesSessoes) fn(lista);
}

function cairParaAparelho() {
  db = null;
  pararSnapshot?.();
  pararSnapshot = null;
  definirModo("aparelho");
  if (assinaturaIniciada) emitirSessoes(sessoesLocais());
}

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function comRetentativa(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e?.code !== "unavailable") throw e;
    await esperar(300 + Math.random() * 500);
    return fn();
  }
}

// Roda a operação no db; se o db sumiu, cai para o aparelho e roda lá.
// Falha de gravação avisa aqui (erro.avisado), e quem chamou não repete o aviso.
// Falha de leitura não avisa: quem lê decide o que mostrar.
async function executar({ conta, aparelho, leitura = false }) {
  await iniciar();
  if (db) {
    try {
      return await comRetentativa(() => conta(db));
    } catch (e) {
      if (SEM_DB.has(e?.code)) {
        cairParaAparelho();
      } else if (!leitura) {
        if (e?.code === "quota_exceeded") {
          toast("O espaço de dados da conta acabou. Apague sessões antigas ou exporte um backup.", { duracao: 5000 });
        } else {
          toast("Não deu para salvar agora. Tente de novo em instantes.");
        }
        if (e && typeof e === "object") e.avisado = true;
        throw e;
      } else {
        throw e;
      }
    }
  }
  return aparelho();
}

// ---------- API ----------
// Não bloqueia a primeira pintura: quem chama renderiza antes e espera depois.
export function iniciar() {
  promessaInicio ??= (async () => {
    let namespace = null;
    try {
      namespace = typeof window.claude?.use === "function" ? await window.claude.use("db") : null;
    } catch {
      namespace = null;
    }
    db = namespace ?? null;
    definirModo(db ? "conta" : "aparelho");
    return modoAtual;
  })();
  return promessaInicio;
}

export function carregarPerfil() {
  return executar({
    conta: async (banco) => {
      const doc = await banco.doc(DOC_PERFIL).get();
      return doc.exists ? { ...doc.data() } : null;
    },
    aparelho: () => lerLocal(CHAVE.perfil, null),
    leitura: true,
  });
}

export function salvarPerfil(perfil) {
  return executar({
    conta: (banco) => banco.doc(DOC_PERFIL).set(perfil),
    aparelho: () => gravarLocalOuAvisar(CHAVE.perfil, perfil),
  });
}

function assinarNoDb() {
  let tentouDeNovo = false;
  const ligar = () => {
    pararSnapshot = db.collection(COLECAO_SESSOES).orderBy("inicio", "desc").onSnapshot(
      (snap) => emitirSessoes(snap.docs.map((d) => d.data())),
      (erro) => {
        pararSnapshot = null;
        if (SEM_DB.has(erro?.code)) return cairParaAparelho();
        // `unavailable` aqui é a ponte do viewer morta: só uma assinatura nova recupera.
        if (erro?.code === "unavailable" && !tentouDeNovo && db) {
          tentouDeNovo = true;
          setTimeout(() => db && ligar(), 300 + Math.random() * 500);
        }
      },
    );
  };
  ligar();
}

// fn(sessoes) recebe a lista inteira, ordenada por inicio desc, a cada mudança.
export function assinarSessoes(fn) {
  ouvintesSessoes.add(fn);
  if (ultimasSessoes) fn(ultimasSessoes);
  if (!assinaturaIniciada) {
    assinaturaIniciada = true;
    iniciar().then(() => {
      if (db) {
        try {
          assinarNoDb();
          return;
        } catch {
          cairParaAparelho();
          return;
        }
      }
      emitirSessoes(sessoesLocais());
    });
  }
  return () => ouvintesSessoes.delete(fn);
}

export function salvarSessao(sessao) {
  return executar({
    conta: (banco) => banco.collection(COLECAO_SESSOES).doc(sessao.id).set(sessao),
    aparelho: () => {
      const lista = sessoesLocais().filter((s) => s.id !== sessao.id);
      const nova = ordenar([...lista, sessao]);
      gravarLocalOuAvisar(CHAVE.sessoes, nova);
      emitirSessoes(nova);
    },
  });
}

export function apagarSessao(id) {
  return executar({
    conta: (banco) => banco.collection(COLECAO_SESSOES).doc(id).delete(),
    aparelho: () => {
      const nova = sessoesLocais().filter((s) => s.id !== id);
      gravarLocalOuAvisar(CHAVE.sessoes, nova);
      emitirSessoes(nova);
    },
  });
}

// Apaga perfil e todas as sessões do modo atual (o rascunho também).
export async function apagarTudo() {
  const ids = (ultimasSessoes ?? []).map((s) => s.id);
  await executar({
    conta: async (banco) => {
      for (const id of ids) await banco.collection(COLECAO_SESSOES).doc(id).delete();
      await banco.doc(DOC_PERFIL).delete();
    },
    aparelho: () => {
      gravarLocal(CHAVE.sessoes, null);
      gravarLocal(CHAVE.perfil, null);
      emitirSessoes([]);
    },
  });
  apagarRascunho();
}

// ---------- Rascunho (sempre local) ----------
export function salvarRascunho(rascunho) {
  return gravarLocal(CHAVE.rascunho, { ...rascunho, salvoEm: Date.now() });
}

export function lerRascunho() {
  return lerLocal(CHAVE.rascunho, null);
}

export function apagarRascunho() {
  gravarLocal(CHAVE.rascunho, null);
}

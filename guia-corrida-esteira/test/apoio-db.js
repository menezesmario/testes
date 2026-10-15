// Apoio dos testes do estado: db falso com a mesma API do db do Artifact e um
// document mínimo (o toast da ui.js cria nós). Nada aqui roda no app.

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

export function documentoFalso() {
  const no = () => ({
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    appendChild() {},
    addEventListener() {},
    remove() {},
  });
  globalThis.Node = class {};
  globalThis.document = {
    createElement: no,
    createElementNS: no,
    createTextNode: () => ({}),
    querySelector: () => no(),
    getElementById: () => no(),
    body: no(),
    documentElement: no(),
  };
}

// docs: { "perfil/atual": {...}, "sessoes/<id>": {...} }
// falhas: { get?: () => erro|null, set?: () => erro|null }
export function dbFalso({ docs = {}, atrasoMs = 0, falhas = {} } = {}) {
  const gravados = [];
  const banco = {
    docs,
    gravados,
    doc(caminho) {
      return {
        async get() {
          await espera(atrasoMs);
          const erro = falhas.get?.();
          if (erro) throw erro;
          return { exists: caminho in docs, data: () => structuredClone(docs[caminho]) };
        },
        async set(valor) {
          const erro = falhas.set?.();
          if (erro) throw erro;
          docs[caminho] = structuredClone(valor);
          gravados.push(caminho);
        },
        async delete() {
          delete docs[caminho];
        },
      };
    },
    collection(nome) {
      return {
        orderBy() {
          return {
            onSnapshot(aoMudar) {
              const lista = Object.entries(docs).filter(([k]) => k.startsWith(`${nome}/`)).map(([, v]) => ({ data: () => v }));
              setTimeout(() => aoMudar({ docs: lista }), atrasoMs);
              return () => {};
            },
          };
        },
        doc: (id) => banco.doc(`${nome}/${id}`),
      };
    },
  };
  return banco;
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dbFalso, documentoFalso } from "./apoio-db.js";

// Leitura do perfil falha: o app mostra o exemplo, mas não pode gravar por cima.
const REAL = { idade: 41, sexo: "f", pesoKg: 61, fcRepouso: 52, vo2max: 33.1, inicioPlano: "2026-09-01" };
let lerFalha = true;
let gravarFalha = false;
const db = dbFalso({
  docs: { "perfil/atual": { ...REAL } },
  falhas: {
    get: () => (lerFalha ? Object.assign(new Error("interno"), { code: "internal" }) : null),
    set: () => (gravarFalha ? Object.assign(new Error("interno"), { code: "internal" }) : null),
  },
});
documentoFalso();
globalThis.window = { claude: { use: async () => db } };
const { estado, iniciar, salvarPerfil } = await import("../app/estado.js");

describe("estado: perfil que não deu para ler", () => {
  it("recusa gravar e não toca no perfil guardado", async () => {
    await iniciar();
    assert.equal(estado.erroCarga, true);
    assert.equal(estado.perfilExemplo, true);
    await assert.rejects(salvarPerfil({ pesoKg: 62 }), (e) => e.code === "carga_falhou" && e.avisado);
    assert.deepEqual(db.docs["perfil/atual"], REAL);
    assert.deepEqual(db.gravados, []);
  });

  it("quando a leitura volta, a edição entra sobre o perfil real", async () => {
    lerFalha = false;
    await salvarPerfil({ pesoKg: 62 });
    assert.deepEqual(db.docs["perfil/atual"], { ...REAL, pesoKg: 62 });
    assert.equal(estado.erroCarga, false);
  });

  it("gravação recusada desfaz a mudança na tela", async () => {
    gravarFalha = true;
    await assert.rejects(salvarPerfil({ pesoKg: 70 }), (e) => e.avisado);
    assert.equal(estado.perfil.pesoKg, 62);
    assert.equal(db.docs["perfil/atual"].pesoKg, 62);
  });
});

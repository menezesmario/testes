import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dbFalso, documentoFalso } from "./apoio-db.js";

// Conta com perfil real e db lento: o app pinta o exemplo antes de o perfil chegar.
const REAL = { idade: 41, sexo: "f", pesoKg: 61, fcRepouso: 52, inicioPlano: "2026-09-01", velocidadeT7: 4.8 };
const db = dbFalso({ docs: { "perfil/atual": { ...REAL } }, atrasoMs: 150 });
documentoFalso();
globalThis.window = { claude: { use: async () => db } };
const { estado, iniciar, salvarPerfil, perfilEfetivo, ultimoT7 } = await import("../app/estado.js");

describe("estado: gravar antes de o perfil carregar", () => {
  it("edição durante a carga entra sobre o perfil real, não sobre o exemplo", async () => {
    iniciar();
    assert.equal(estado.perfilExemplo, true);
    const salvo = await salvarPerfil({ pesoKg: 62 });
    assert.deepEqual(db.docs["perfil/atual"], { ...REAL, pesoKg: 62 });
    assert.deepEqual(salvo, { ...REAL, pesoKg: 62 });
    assert.equal(estado.perfil.idade, 41);
    assert.equal(estado.perfilExemplo, false);
  });

  it("o T7 das sessões de exemplo não vira VO2máx do perfil real", async () => {
    await iniciar();
    assert.equal(estado.exemplo, true);
    assert.equal(ultimoT7(), null);
    const ef = perfilEfetivo();
    assert.equal(ef.vo2maxOrigem, "estimado");
    assert.ok(Math.abs(ef.vo2max - 15.3 * (ef.fcMax / 52)) < 1e-9);
  });
});

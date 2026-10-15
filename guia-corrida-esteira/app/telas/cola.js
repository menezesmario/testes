// Aba Cola: inclinação que leva cada velocidade até a % do VO2máx desejada.
// conteudoCola também serve a sheet "Cola" da sessão ao vivo (compacto).

import { inclinacaoParaMets } from "../../src/calculadora.js";

const PORCENTAGENS = [50, 55, 60, 65, 70, 85];
const VELOCIDADES = [4, 4.5, 5, 5.5, 6, 6.5, 7];
const INCLINACAO_MAX = 20;

// Lembrados entre a aba e a sheet da sessão, que são instâncias diferentes.
let pctLembrado = 60;
let modoLembrado = "lista";

// { inc: número arredondado a 0,5, tipo: 'ok' | 'abaixo' | 'acima' }.
// 'abaixo': o plano já passa do alvo nessa velocidade (↓); 'acima': a esteira não alcança.
export function inclinacaoCola(vo2max, velocidadeKmh, pct) {
  const inc = inclinacaoParaMets({ velocidadeKmh, mets: ((pct / 100) * vo2max) / 3.5, modo: "caminhada" });
  const inc5 = Math.round(inc * 2) / 2;
  if (inc5 < 0) return { inc: inc5, tipo: "abaixo" };
  if (inc5 > INCLINACAO_MAX) return { inc: inc5, tipo: "acima" };
  return { inc: inc5, tipo: "ok" };
}

export function conteudoCola(ctx, { compacto = false } = {}) {
  const { h, formatar, segmentado, botao, vazio } = ctx.ui;
  const { nivelIntensidade, corIntensidade } = ctx.rampa;
  const estado = ctx.estado;

  const raiz = h("div", { class: ["cola", compacto && "cola--compacta"], id: compacto ? "cola-compacta" : "cola" });
  const corpo = h("div", { class: "cola-corpo" });
  const barra = h("div", { class: "cola-barra" });
  const idSufixo = compacto ? "-c" : "";

  const seletorPct = segmentado({
    id: `cola-pct${idSufixo}`,
    rotulo: "Porcentagem do VO2máx",
    opcoes: PORCENTAGENS.map((p) => ({ valor: p, rotulo: `${p}%` })),
    valor: pctLembrado,
    onChange: (v) => { pctLembrado = v; desenhar(); },
  });
  const resumo = h("p", { class: "cola-resumo", "aria-live": "polite" });
  const alternar = botao({
    id: `cola-modo${idSufixo}`,
    tipo: "texto",
    rotulo: "",
    onClick: () => { modoLembrado = modoLembrado === "lista" ? "tabela" : "lista"; desenhar(); },
  });
  barra.append(resumo, alternar);
  raiz.append(seletorPct, barra, corpo);

  const textoVelocidade = (v) => formatar.num(v, 1);

  function listaVelocidades(ef) {
    const todas = new Set(VELOCIDADES);
    todas.add(Math.round(ef.velocidadePadrao * 10) / 10);
    return [...todas].sort((a, b) => a - b);
  }

  // Fora da esteira, a lista diz em palavras (a tabela, apertada, usa ↓ e >20).
  function celulaResultado(r) {
    if (r.tipo === "abaixo") return h("span", { class: "cola-inc-texto" }, "0% já passa");
    if (r.tipo === "acima") return h("span", { class: "cola-inc-texto" }, "acima de 20%");
    return h("span", { class: "num" }, `${formatar.num(r.inc, 1)}%`);
  }

  function descricaoAria(kmh, r, pct) {
    const base = `${textoVelocidade(kmh)} km/h a ${pct}% do VO2máx: `;
    if (r.tipo === "abaixo") return `${base}o plano já passa do alvo, reduza a velocidade`;
    if (r.tipo === "acima") return `${base}a esteira não alcança, aumente a velocidade`;
    return `${base}inclinação de ${formatar.num(r.inc, 1)}%`;
  }

  function trilho(r) {
    // Fora da escala de 0 a 20% o mini-trilho não teria o que mostrar.
    if (r.tipo !== "ok") return h("span", { "aria-hidden": "true" });
    const pos = (r.inc / INCLINACAO_MAX) * 100;
    return h("div", { class: "cola-trilho", style: { "--pos": `${pos}%` }, "aria-hidden": "true" },
      h("span", { class: "cola-trilho-valor" }),
      h("span", { class: "cola-trilho-marca" }),
    );
  }

  function desenharLista(ef) {
    const pct = pctLembrado;
    const linhas = listaVelocidades(ef).map((kmh) => {
      const r = inclinacaoCola(ef.vo2max, kmh, pct);
      const padrao = Math.abs(kmh - ef.velocidadePadrao) < 0.05;
      return h("div", {
        class: ["cola-linha", padrao && "cola-linha--padrao", r.tipo !== "ok" && "cola-linha--fora"],
        role: "listitem",
        "aria-label": descricaoAria(kmh, r, pct),
        "data-kmh": String(kmh),
      },
        h("div", { class: "cola-vel" },
          h("span", { class: "cola-vel-valor" },
            h("span", { class: "num" }, textoVelocidade(kmh)),
            h("span", { class: "cola-vel-unidade" }, "km/h")),
          h("span", { class: "cola-vel-detalhe" }, padrao ? `padrão · ${formatar.ritmo(kmh)}` : formatar.ritmo(kmh)),
        ),
        trilho(r),
        h("div", { class: "cola-inc" }, celulaResultado(r)),
      );
    });
    corpo.replaceChildren(h("div", { class: "cola-lista", role: "list", "aria-label": `Inclinação para ${pct}% do VO2máx` }, linhas));
  }

  function desenharTabela(ef) {
    const cabeca = h("tr", null,
      h("th", { scope: "col", class: "cola-th-vel" }, "km/h"),
      PORCENTAGENS.map((p) => h("th", { scope: "col", class: p === pctLembrado ? "sel" : null }, `${p}%`)),
    );
    const linhas = listaVelocidades(ef).map((kmh) => {
      const padrao = Math.abs(kmh - ef.velocidadePadrao) < 0.05;
      return h("tr", { class: padrao ? "padrao" : null },
        h("th", { scope: "row", class: "cola-th-vel" }, textoVelocidade(kmh)),
        PORCENTAGENS.map((p) => {
          const r = inclinacaoCola(ef.vo2max, kmh, p);
          const texto = r.tipo === "abaixo" ? "↓" : r.tipo === "acima" ? ">20" : formatar.num(r.inc, 1);
          return h("td", { class: [p === pctLembrado && "sel", r.tipo !== "ok" && "fora"], "aria-label": descricaoAria(kmh, r, p) }, h("span", { class: "num" }, texto));
        }),
      );
    });
    corpo.replaceChildren(h("div", { class: "cola-tabela-caixa" },
      h("table", { class: "cola-tabela" },
        h("caption", { class: "so-leitor" }, "Inclinação em porcentagem por velocidade e por porcentagem do VO2máx"),
        h("thead", null, cabeca),
        h("tbody", null, linhas),
      ),
    ));
  }

  function desenhar() {
    const ef = estado.perfilEfetivo();
    const tabela = modoLembrado === "tabela";
    seletorPct.definir(pctLembrado);
    seletorPct.hidden = tabela;
    alternar.replaceChildren(tabela ? "Por velocidade" : "Tabela completa");
    raiz.style.setProperty("--cor-int", corIntensidade(nivelIntensidade(pctLembrado)));

    if (!(ef.vo2max > 0)) {
      resumo.textContent = "";
      barra.hidden = true;
      seletorPct.hidden = true;
      corpo.replaceChildren(vazio({
        titulo: "Falta o VO2máx",
        texto: "Informe idade e FC de repouso no Perfil, ou faça o T7, para calcular a inclinação.",
        arte: false,
      }));
      return;
    }
    barra.hidden = false;

    const mets = ((pctLembrado / 100) * ef.vo2max) / 3.5;
    if (tabela) resumo.textContent = "Inclinação em %";
    else resumo.textContent = `${pctLembrado}% · ${formatar.num(mets, 1)} METs`;

    if (tabela) desenharTabela(ef);
    else desenharLista(ef);

    const origem = ef.exemplo ? "exemplo" : { manual: "informado", t7: "do T7", estimado: "estimado" }[ef.vo2maxOrigem];
    const legendaFora = tabela
      ? "↓ o plano já passa do alvo: reduza a velocidade. >20 a esteira não chega lá: aumente a velocidade."
      : "“0% já passa”: mesmo no plano a carga fica acima do alvo; reduza a velocidade.";
    const notas = compacto
      ? [`VO2máx ${formatar.num(ef.vo2max, 1)} (${origem}).${tabela ? " ↓ já passa do alvo · >20 fora da esteira." : ""}`]
      : [
        `Com VO2máx de ${formatar.num(ef.vo2max, 1)} ml/kg/min (${origem}), ${formatar.num(ef.vo2max / 3.5, 1)} METs. Inclinação arredondada a 0,5%.`,
        `${legendaFora} Contas de caminhada; para correr, use a sessão ao vivo.`,
        "Confira se o painel da XT025 mostra a inclinação em % ou em níveis. A tabela usa %.",
      ];
    corpo.append(h("div", { class: "cola-notas" }, notas.map((n) => h("p", { class: "t-footnote texto-2" }, n))));
  }

  // A sheet some do DOM ao fechar: nesse momento solta a assinatura.
  let conectou = false;
  const desassinar = estado.assinar(() => {
    if (raiz.isConnected) {
      conectou = true;
      desenhar();
    } else if (conectou) desassinar();
  });

  desenhar();
  return raiz;
}

export function criarTela(ctx) {
  return { el: conteudoCola(ctx), titulo: "Cola" };
}

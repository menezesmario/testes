// Aba Perfil: dados pessoais, treino, zonas de FC e gestão dos dados
// (onde estão salvos, exportar, importar, apagar).

import { zonasFC, fcMaxEstimada } from "../../src/calculadora.js";
import { TREINOS, semanaDoPlano } from "../../src/treinos.js";
import { paraCSV, resumirSessao } from "../../src/resumo.js";

const dois = (n) => String(n).padStart(2, "0");
const isoLocal = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
const hojeISO = () => isoLocal(new Date());
const dataLocal = (iso) => {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
};
const DIA = 86400000;

// Limites que o app aceita. Fora disso a mensagem diz a faixa válida.
const CAMPOS = {
  idade: { rotulo: "Idade", unidade: "anos", min: 14, max: 90, casas: 0 },
  pesoKg: { rotulo: "Peso", unidade: "kg", min: 30, max: 250, casas: 1 },
  fcRepouso: { rotulo: "FC de repouso", unidade: "bpm", min: 30, max: 120, casas: 0 },
  fcMax: { rotulo: "FC máxima", unidade: "bpm", min: 100, max: 230, casas: 0 },
  vo2max: { rotulo: "VO2máx", unidade: "ml/kg/min", min: 15, max: 80, casas: 1 },
  velocidadePadrao: { rotulo: "Velocidade padrão", unidade: "km/h", min: 3, max: 8, casas: 1 },
};

const CHAVES_PERFIL = ["nome", "idade", "sexo", "pesoKg", "fcRepouso", "fcMax", "vo2max", "velocidadePadrao", "velocidadeT7", "inicioPlano"];

// ---------- Backup: validação do JSON importado ----------
const numero = (v) => typeof v === "number" && Number.isFinite(v);

function perfilDoBackup(bruto) {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const perfil = {};
  for (const chave of CHAVES_PERFIL) {
    const v = bruto[chave];
    if (v == null || v === "") continue;
    if (chave === "sexo") { if (v === "m" || v === "f") perfil.sexo = v; }
    else if (chave === "nome") { if (typeof v === "string") perfil.nome = v.slice(0, 60); }
    else if (chave === "inicioPlano") { if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))) perfil.inicioPlano = v; }
    else {
      // Os mesmos limites da edição manual; fora deles o campo fica de fora.
      const limite = CAMPOS[chave] ?? (chave === "velocidadeT7" ? { min: 3.2, max: 7.2 } : null);
      if (numero(v) && limite && v >= limite.min && v <= limite.max) perfil[chave] = v;
    }
  }
  return Object.keys(perfil).length ? perfil : null;
}

function sessaoValida(s) {
  if (!s || typeof s !== "object") return false;
  // O id vira nome de documento no armazenamento: sem barras nem caracteres estranhos.
  if (typeof s.id !== "string" || !/^[\w-]{1,64}$/.test(s.id)) return false;
  if (!TREINOS[s.treino] || typeof s.inicio !== "string" || Number.isNaN(Date.parse(s.inicio))) return false;
  if (!Array.isArray(s.fases) || !s.fases.length || !s.fases.every((f) => f && numero(f.segundos) && typeof f.tipo === "string")) return false;
  if (s.vo2max != null && !(numero(s.vo2max) && s.vo2max >= CAMPOS.vo2max.min && s.vo2max <= CAMPOS.vo2max.max)) return false;
  const a = s.amostras;
  if (!a || !numero(a.passo) || !(a.passo > 0)) return false;
  const { v, i, fc, f } = a;
  if (![v, i, fc, f].every(Array.isArray) || !v.length || v.length > 20000) return false;
  if (i.length !== v.length || fc.length !== v.length || f.length !== v.length) return false;
  // Uma amostra que não é número vira NaN nos gráficos do Painel.
  if (!v.every((x) => numero(x) && x >= 0) || !i.every((x) => numero(x) && x >= 0)) return false;
  if (!fc.every((x) => x == null || numero(x))) return false;
  if (!f.every((x) => Number.isInteger(x) && x >= 0 && x < s.fases.length)) return false;
  try {
    resumirSessao(s);
  } catch {
    return false;
  }
  return true;
}

// { perfil, sessoes, ignoradas } ou { erro }.
function lerBackup(dados) {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    return { erro: "Esse arquivo não é um backup do Esteira. Escolha o .json que o app exportou em Perfil, Exportar backup." };
  }
  const brutas = Array.isArray(dados.sessoes) ? dados.sessoes : [];
  const sessoes = brutas.filter(sessaoValida).map(({ exemplo, ...resto }) => resto);
  const perfil = perfilDoBackup(dados.perfil);
  if (!sessoes.length && !perfil) {
    return { erro: "O arquivo não tem perfil nem sessões do Esteira. Escolha o .json que o app exportou em Perfil, Exportar backup." };
  }
  return { perfil, sessoes, ignoradas: brutas.length - sessoes.length };
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// ---------- Tela ----------
export function criarTela(ctx) {
  const { h, formatar, grupo, linha, botao, abrirSheet, confirmar, pedirNumero, toast, icone } = ctx.ui;
  const estado = ctx.estado;

  const el = h("div", { class: "perfil" });
  const aviso = h("div", { class: "perfil-aviso", id: "perfil-aviso", role: "alert", hidden: true });
  const status = h("p", { class: "perfil-status", id: "perfil-status", role: "status" });
  const entrada = h("input", {
    type: "file",
    id: "perfil-arquivo",
    accept: ".json,application/json",
    hidden: true,
    tabindex: "-1",
    "aria-label": "Arquivo de backup",
    "on:change": aoEscolherArquivo,
  });
  const corpo = h("div", { class: "perfil-corpo" });
  el.append(aviso, corpo, entrada);

  let visivel = false;
  let sujo = true;
  let temporizadorAviso = null;

  const tela = {
    el,
    titulo: "Perfil",
    aoMostrar() {
      visivel = true;
      if (sujo) desenhar();
    },
    aoOcultar() { visivel = false; },
  };
  estado.assinar(() => {
    sujo = true;
    if (visivel) desenhar();
  });

  // ---------- Mensagens ----------
  function mostrarErro(texto) {
    clearTimeout(temporizadorAviso);
    aviso.replaceChildren(icone("alerta", { tamanho: 20 }), h("span", null, texto));
    aviso.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    temporizadorAviso = setTimeout(limparErro, 12000);
  }
  function limparErro() {
    clearTimeout(temporizadorAviso);
    aviso.hidden = true;
    aviso.replaceChildren();
  }

  // ---------- Salvar ----------
  // Validações que dependem de mais de um campo.
  function validar(parcial) {
    const junto = { ...estado.perfil, ...parcial };
    const fcMax = junto.fcMax > 0 ? junto.fcMax : junto.idade > 0 ? fcMaxEstimada(junto.idade) : null;
    if (junto.fcRepouso > 0 && fcMax && junto.fcRepouso >= fcMax) {
      return `A FC de repouso (${junto.fcRepouso}) precisa ficar abaixo da FC máxima (${fcMax}). Revise a FC de repouso, a idade ou a FC máxima.`;
    }
    return null;
  }

  async function salvar(parcial) {
    const erro = validar(parcial);
    if (erro) {
      mostrarErro(erro);
      return false;
    }
    limparErro();
    try {
      await estado.salvarPerfil(parcial);
      toast("Salvo");
      return true;
    } catch (e) {
      if (!e?.avisado) mostrarErro("Não consegui salvar. Tente de novo. Se continuar, exporte um backup antes de fechar o app.");
      return false;
    }
  }

  // ---------- Edição de campos ----------
  // Antes de o perfil guardado chegar, a tela mostra o exemplo: editar agora
  // partiria de valores que não são os do usuário.
  function prontoParaEditar() {
    if (estado.perfilLido) return true;
    toast("Carregando seus dados. Tente em instantes.");
    return false;
  }

  async function digitar(chave, inicial) {
    const c = CAMPOS[chave];
    const n = await pedirNumero({ titulo: c.rotulo, valor: inicial, unidade: c.unidade, casas: c.casas, min: c.min, max: c.max });
    if (n != null) await salvar({ [chave]: n });
  }

  function editarObrigatorio(chave) {
    if (!prontoParaEditar()) return null;
    const ef = estado.perfilEfetivo();
    return digitar(chave, chave === "velocidadePadrao" ? ef.velocidadePadrao : estado.perfil[chave]);
  }

  // FC máxima e VO2máx: valor opcional, com a opção de voltar ao calculado.
  function editarOpcional(chave) {
    if (!prontoParaEditar()) return;
    const c = CAMPOS[chave];
    const ef = estado.perfilEfetivo();
    const atual = estado.perfil[chave];
    const estimada = ef.idade > 0 ? fcMaxEstimada(ef.idade) : null;
    const t7 = estado.ultimoT7();
    const dica = chave === "fcMax"
      ? `Sem valor, o app usa a estimada pela idade: ${estimada ? `${estimada} bpm` : "informe a idade"} (208 − 0,7 × idade). Digite o seu só se você viu uma FC máxima de verdade num teste ou num esforço total.`
      : `Sem valor, o app usa o último T7${t7 ? ` (${formatar.num(t7.t7.vo2max, 1)})` : ""} e, sem T7, estima pela FC. Digite o seu só se já mediu em laboratório ou no relógio.`;
    const inicial = atual ?? (chave === "fcMax" ? estimada : ef.vo2max);
    abrirSheet({
      titulo: c.rotulo,
      conteudo: h("div", { class: "pilha" },
        h("p", { class: "sheet-mensagem" }, dica),
        atual != null && h("p", { class: "perfil-sheet-atual" },
          h("span", { class: "num" }, formatar.num(atual, c.casas)), h("span", { class: "texto-2" }, ` ${c.unidade}, informado por você`)),
      ),
      acoes: [
        {
          id: `perfil-${chave}-digitar`,
          rotulo: atual != null ? "Alterar valor" : "Informar valor",
          tipo: "primario",
          onClick: (fechar) => { fechar(); digitar(chave, inicial); },
        },
        atual != null && {
          id: `perfil-${chave}-remover`,
          rotulo: chave === "fcMax" ? "Usar a estimada" : "Voltar ao automático",
          tipo: "secundario",
          onClick: (fechar) => { fechar(); salvar({ [chave]: null }); },
        },
      ].filter(Boolean),
    });
  }

  function editarSexo() {
    if (!prontoParaEditar()) return;
    const atual = estado.perfil.sexo;
    const escolher = (valor) => (fechar) => { fechar(); salvar({ sexo: valor }); };
    const sheet = abrirSheet({
      titulo: "Sexo",
      conteudo: h("div", { class: "pilha" },
        h("p", { class: "sheet-mensagem" }, "Entra na estimativa de VO2máx do teste T7."),
        grupo({},
          linha({ id: "perfil-sexo-m", rotulo: "Masculino", acessorio: atual === "m" ? "check" : undefined, onClick: () => escolher("m")(sheet.fechar) }),
          linha({ id: "perfil-sexo-f", rotulo: "Feminino", acessorio: atual === "f" ? "check" : undefined, onClick: () => escolher("f")(sheet.fechar) }),
        ),
      ),
    });
  }

  function editarInicio() {
    if (!prontoParaEditar()) return;
    const atual = estado.perfil.inicioPlano;
    const campo = h("input", {
      type: "date",
      id: "perfil-inicio-data",
      class: "perfil-campo",
      value: atual ?? hojeISO(),
      "aria-label": "Data de início do plano",
    });
    const erro = h("p", { class: "teclado-aviso", role: "alert" });
    const sheet = abrirSheet({
      titulo: "Início do plano",
      conteudo: h("div", { class: "pilha" },
        h("p", { class: "sheet-mensagem" }, "A semana 1 começa nesta data. Uma segunda-feira alinha o plano com o calendário."),
        campo,
        erro,
      ),
      acoes: [
        {
          id: "perfil-inicio-salvar",
          rotulo: "Salvar",
          tipo: "primario",
          onClick: async () => {
            const v = campo.value;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
              erro.textContent = "Escolha uma data no calendário (dia, mês e ano).";
              return;
            }
            const dias = (dataLocal(v) - dataLocal(hojeISO())) / DIA;
            if (v < "2020-01-01" || dias > 366) {
              erro.textContent = "Use uma data a partir de 2020 e até daqui a um ano.";
              return;
            }
            sheet.fechar();
            await salvar({ inicioPlano: v });
          },
        },
        {
          id: "perfil-inicio-hoje",
          rotulo: "Começar hoje",
          tipo: "secundario",
          onClick: async () => { sheet.fechar(); await salvar({ inicioPlano: hojeISO() }); },
        },
        atual && {
          id: "perfil-inicio-remover",
          rotulo: "Remover início",
          tipo: "perigo",
          onClick: async () => { sheet.fechar(); await salvar({ inicioPlano: null }); },
        },
      ].filter(Boolean),
    });
  }

  // ---------- Exportar ----------
  function sessoesReais() {
    return estado.exemplo ? [] : estado.sessoes;
  }

  async function copiar(area) {
    try {
      await navigator.clipboard.writeText(area.value);
      toast("Copiado");
      return;
    } catch { /* o iframe pode bloquear a área de transferência */ }
    area.focus();
    area.select();
    try {
      if (document.execCommand("copy")) {
        toast("Copiado");
        return;
      }
    } catch { /* cai na mensagem */ }
    toast("Selecione o texto e copie à mão");
  }

  function mostrarTexto({ titulo, nomeArquivo, texto }) {
    const area = h("textarea", {
      id: "perfil-texto-exportado",
      class: "perfil-texto",
      readonly: true,
      rows: 9,
      spellcheck: "false",
      "aria-label": `Conteúdo de ${nomeArquivo}`,
      value: texto,
      "on:focus": (e) => e.target.select(),
    });
    abrirSheet({
      titulo,
      classe: "perfil-sheet-texto",
      conteudo: h("div", { class: "pilha" },
        h("p", { class: "sheet-mensagem" }, `Não consegui salvar o arquivo direto. Copie o texto e cole num arquivo chamado ${nomeArquivo}.`),
        area,
      ),
      acoes: [{ id: "perfil-copiar", rotulo: "Copiar", tipo: "primario", icone: "check", onClick: () => copiar(area) }],
    });
  }

  async function entregar({ titulo, nomeArquivo, texto }) {
    try {
      const downloads = await window.claude?.use?.("downloads");
      if (downloads) {
        await downloads.save({ filename: nomeArquivo, data: texto });
        toast("Arquivo salvo");
        return;
      }
    } catch (erro) {
      if (erro?.code !== "declined") console.warn(erro);
    }
    mostrarTexto({ titulo, nomeArquivo, texto });
  }

  function exportarCSV() {
    const sessoes = sessoesReais();
    if (!sessoes.length) {
      toast("Ainda não há sessões suas para exportar");
      return;
    }
    entregar({ titulo: "Sessões em CSV", nomeArquivo: `esteira-sessoes-${hojeISO()}.csv`, texto: paraCSV(sessoes) });
  }

  function exportarBackup() {
    const sessoes = sessoesReais();
    const perfil = estado.perfilExemplo ? null : (({ exemplo, ...resto }) => resto)(estado.perfil);
    if (!sessoes.length && !perfil) {
      toast("Ainda não há dados seus para exportar");
      return;
    }
    const backup = { app: "esteira", versao: 1, exportadoEm: new Date().toISOString(), perfil, sessoes };
    entregar({ titulo: "Backup em JSON", nomeArquivo: `esteira-backup-${hojeISO()}.json`, texto: JSON.stringify(backup) });
  }

  // ---------- Importar ----------
  async function aoEscolherArquivo() {
    const arquivo = entrada.files?.[0];
    entrada.value = "";
    if (!arquivo) return;
    let dados;
    try {
      if (arquivo.size > 40 * 1024 * 1024) throw new Error("grande demais");
      dados = JSON.parse(await arquivo.text());
    } catch {
      mostrarErro(`Não consegui ler "${arquivo.name}". Escolha o .json que o app exportou em Perfil, Exportar backup.`);
      return;
    }
    const lido = lerBackup(dados);
    if (lido.erro) {
      mostrarErro(lido.erro);
      return;
    }
    limparErro();

    const existentes = new Set(estado.exemplo ? [] : estado.sessoes.map((x) => x.id));
    const novas = lido.sessoes.filter((x) => !existentes.has(x.id)).length;
    const substituidas = lido.sessoes.length - novas;
    const linhas = [];
    if (lido.sessoes.length) {
      linhas.push(`${plural(lido.sessoes.length, "sessão", "sessões")}: ${plural(novas, "nova", "novas")}${substituidas ? `, ${plural(substituidas, "substitui a de mesmo id", "substituem as de mesmo id")}` : ""}.`);
    }
    if (lido.ignoradas) linhas.push(`${plural(lido.ignoradas, "sessão ignorada", "sessões ignoradas")} por formato inválido.`);
    if (lido.perfil) linhas.push(estado.perfilExemplo ? "O perfil do backup entra no lugar do exemplo." : "O perfil do backup substitui o atual.");
    const ok = await confirmar({ titulo: "Importar backup?", mensagem: linhas.join(" "), confirmar: "Importar" });
    if (!ok) return;

    try {
      const entraram = await estado.importarBackup({ perfil: lido.perfil, sessoes: lido.sessoes });
      const resumo = lido.sessoes.length
        ? `${plural(entraram, "sessão importada", "sessões importadas")}: ${plural(novas, "nova", "novas")}, ${plural(substituidas, "atualizada", "atualizadas")}.`
        : "Perfil importado. O backup não tinha sessões.";
      status.textContent = resumo;
      toast(lido.sessoes.length ? plural(entraram, "sessão importada", "sessões importadas") : "Perfil importado");
    } catch (erro) {
      if (!erro?.avisado) console.error(erro);
      mostrarErro("A importação parou no meio. As sessões que entraram já aparecem; importe o mesmo arquivo de novo para completar.");
    }
  }

  // ---------- Apagar tudo ----------
  function apagarTudo() {
    if (!prontoParaEditar()) return;
    const sessoes = sessoesReais();
    if (estado.perfilExemplo && !sessoes.length) {
      toast("Não há dados seus para apagar");
      return;
    }
    const onde = estado.modoArmazenamento === "conta" ? "na sua conta do Claude" : "neste aparelho";
    const campo = h("input", {
      type: "text",
      id: "perfil-apagar-confirma",
      class: "perfil-campo",
      autocomplete: "off",
      autocapitalize: "none",
      spellcheck: "false",
      placeholder: "apagar",
      "aria-label": "Digite apagar para confirmar",
    });
    const confirma = botao({
      id: "perfil-apagar-ok",
      rotulo: "Apagar tudo",
      tipo: "perigo",
      grande: true,
      largo: true,
      desabilitado: true,
      onClick: async () => {
        sheet.fechar();
        try {
          await estado.apagarTudo();
          estado.apagarRascunho();
          status.textContent = "";
          toast("Dados apagados");
        } catch (erro) {
          if (!erro?.avisado) mostrarErro("Não consegui apagar tudo. Tente de novo.");
        }
      },
    });
    const conferir = () => { confirma.disabled = campo.value.trim().toLowerCase() !== "apagar"; };
    campo.addEventListener("input", conferir);
    campo.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !confirma.disabled) { e.preventDefault(); confirma.click(); }
    });
    const sheet = abrirSheet({
      titulo: "Apagar todos os dados",
      conteudo: h("div", { class: "pilha" },
        h("p", { class: "sheet-mensagem" },
          `Isto apaga seu perfil e ${plural(sessoes.length, "sessão salva", "sessões salvas")} ${onde}. Não dá para desfazer. Exporte um backup antes, se quiser guardar.`),
        h("label", { class: "perfil-rotulo-campo", for: "perfil-apagar-confirma" }, "Digite apagar para confirmar"),
        campo,
      ),
      acoes: [confirma, { rotulo: "Cancelar", tipo: "secundario", onClick: (fechar) => fechar() }],
    });
    campo.setAttribute("autofocus", "");
  }

  // ---------- Desenho ----------
  const pendente = () => h("span", { class: "perfil-pendente" }, "Informar");
  const comUnidade = (v, c) => (v > 0 ? `${formatar.num(v, c.casas)} ${c.unidade}` : pendente());

  function detalheVO2(ef) {
    const t7 = estado.ultimoT7();
    return {
      manual: "Informado por você",
      t7: t7 ? `Medido no T7 de ${formatar.data(t7.inicio)}` : "Medido no T7",
      estimado: "Estimado pela FC. Faça o T7 para medir",
      exemplo: "Valor de exemplo",
    }[ef.vo2maxOrigem] ?? "Faça o T7 ou informe o seu";
  }

  function detalhePlano(inicio) {
    const dias = Math.round((dataLocal(hojeISO()) - dataLocal(inicio)) / DIA);
    if (dias < 0) return `Começa em ${plural(-dias, "dia", "dias")}`;
    if (dias >= 56) return "Plano de 8 semanas concluído";
    return `Hoje é a semana ${semanaDoPlano(inicio, hojeISO())} de 8`;
  }

  function grupoZonas(ef) {
    let zonas = null;
    if (ef.fcMax > 0) {
      const repouso = ef.fcRepouso > 0 && ef.fcRepouso < ef.fcMax ? ef.fcRepouso : undefined;
      try { zonas = { lista: zonasFC({ fcMax: ef.fcMax, fcRepouso: repouso }), repouso }; } catch { zonas = null; }
    }
    if (!zonas) {
      return grupo({ titulo: "Zonas de frequência cardíaca", id: "perfil-zonas" },
        h("div", { class: "linha-item", role: "listitem" },
          h("div", { class: "linha" }, h("span", { class: "linha-texto texto-2" }, "Informe a idade ou a FC máxima para calcular as zonas."))));
    }
    const origem = ef.fcMaxOrigem === "informada" ? "informada" : "estimada pela idade";
    const rodape = zonas.repouso
      ? `Reserva de FC (Karvonen): repouso de ${zonas.repouso} bpm e máxima de ${ef.fcMax} bpm (${origem}).`
      : `Porcentagem da FC máxima de ${ef.fcMax} bpm (${origem}). Informe a FC de repouso para usar a reserva de FC.`;
    return grupo({ titulo: "Zonas de frequência cardíaca", rodape, id: "perfil-zonas" },
      ...zonas.lista.map((z) => {
        const [, rotulo, detalhe] = z.nome.match(/^(.*?)\s*\((.*)\)$/) ?? [null, z.nome, null];
        return linha({
          id: `perfil-zona-${z.zona}`,
          rotulo: `Z${z.zona} · ${rotulo}`,
          detalhe,
          valor: `${z.min}–${z.max} bpm`,
        });
      }),
    );
  }

  function grupoDados() {
    const sessoes = sessoesReais();
    const modo = estado.modoArmazenamento;
    const onde = {
      conta: { icone: "nuvem", rotulo: "Na sua conta do Claude", detalhe: "Aparece em qualquer aparelho onde você abrir o app." },
      aparelho: { icone: "aparelho", rotulo: "Neste aparelho", detalhe: "Se limpar os dados do navegador, você perde tudo. Exporte um backup de vez em quando." },
      carregando: { icone: "nuvem", rotulo: "Carregando…", detalhe: "Verificando onde seus dados ficam." },
    }[modo] ?? { icone: "nuvem", rotulo: "Carregando…" };
    return [
      // A explicação de onde os dados ficam vai no rodapé: na linha, ela
      // espremia o texto contra a contagem de sessões.
      grupo({ titulo: "Dados", id: "perfil-dados", rodape: [onde.detalhe, "O CSV serve para planilhas. O backup JSON guarda perfil e sessões inteiras e pode ser importado de volta."].filter(Boolean).join(" ") },
        linha({
          id: "perfil-salvo",
          icone: onde.icone,
          rotulo: onde.rotulo,
          valor: plural(sessoes.length, "sessão", "sessões"),
        }),
        linha({ id: "perfil-exportar-csv", icone: "exportar", rotulo: "Exportar sessões em CSV", acessorio: "chevron", onClick: exportarCSV }),
        linha({ id: "perfil-exportar-json", icone: "exportar", rotulo: "Exportar backup em JSON", acessorio: "chevron", onClick: exportarBackup }),
        linha({ id: "perfil-importar", icone: "importar", rotulo: "Importar backup", acessorio: "chevron", onClick: () => { if (prontoParaEditar()) entrada.click(); } }),
      ),
      status,
      grupo({ id: "perfil-perigo" },
        linha({ id: "perfil-apagar", icone: "lixeira", rotulo: "Apagar todos os dados", tom: "destrutiva", onClick: apagarTudo }),
      ),
    ];
  }

  function desenhar() {
    sujo = false;
    const idFoco = el.contains(document.activeElement) ? document.activeElement.id : null;
    const ef = estado.perfilEfetivo();
    const perfil = estado.perfil;
    const sexoTexto = { m: "Masculino", f: "Feminino" }[perfil.sexo];

    const filhos = [];
    if (!estado.perfilLido) {
      filhos.push(h("div", { class: "perfil-exemplo", id: "perfil-exemplo" },
        icone("nuvem", { tamanho: 20 }),
        h("p", null, "Carregando seus dados. A edição libera em instantes."),
      ));
    } else if (estado.erroCarga) {
      filhos.push(h("div", { class: "perfil-exemplo", id: "perfil-exemplo" },
        icone("alerta", { tamanho: 20 }),
        h("p", null, "Não deu para ler seu perfil salvo. Os valores abaixo são de exemplo. Recarregue a página antes de editar."),
      ));
    } else if (estado.perfilExemplo) {
      filhos.push(h("div", { class: "perfil-exemplo", id: "perfil-exemplo" },
        icone("info", { tamanho: 20 }),
        h("p", null, "Estes valores são de exemplo. Ao salvar um campo, todos passam a ser seus: confira cada um."),
      ));
    }

    filhos.push(
      grupo({
        titulo: "Dados pessoais",
        id: "perfil-pessoais",
        rodape: "Idade e sexo entram na estimativa de FC máxima e no cálculo do T7. O peso entra nas kcal.",
      },
        linha({ id: "perfil-idade", rotulo: "Idade", valor: comUnidade(perfil.idade, CAMPOS.idade), acessorio: "chevron", onClick: () => editarObrigatorio("idade") }),
        linha({ id: "perfil-sexo", rotulo: "Sexo", valor: sexoTexto ?? pendente(), acessorio: "chevron", onClick: editarSexo }),
        linha({ id: "perfil-peso", rotulo: "Peso", valor: comUnidade(perfil.pesoKg, CAMPOS.pesoKg), acessorio: "chevron", onClick: () => editarObrigatorio("pesoKg") }),
        linha({ id: "perfil-fc-repouso", rotulo: "FC de repouso", valor: comUnidade(perfil.fcRepouso, CAMPOS.fcRepouso), acessorio: "chevron", onClick: () => editarObrigatorio("fcRepouso") }),
        linha({
          id: "perfil-fc-max",
          rotulo: "FC máxima",
          detalhe: ef.fcMax ? (ef.fcMaxOrigem === "informada" ? "Informada por você" : "Estimada pela idade") : "Informe a idade para estimar",
          valor: ef.fcMax ? `${ef.fcMax} bpm` : "–",
          acessorio: "chevron",
          onClick: () => editarOpcional("fcMax"),
        }),
      ),
      grupo({
        titulo: "Treino",
        id: "perfil-treino",
        rodape: "A velocidade padrão define a inclinação sugerida em Hoje e a linha em destaque na Cola.",
      },
        linha({
          id: "perfil-vo2max",
          rotulo: "VO2máx",
          detalhe: detalheVO2(ef),
          valor: ef.vo2max ? `${formatar.num(ef.vo2max, 1)} ml/kg/min` : "–",
          acessorio: "chevron",
          onClick: () => editarOpcional("vo2max"),
        }),
        linha({
          id: "perfil-velocidade",
          rotulo: "Velocidade padrão",
          detalhe: `Ritmo de ${formatar.ritmo(ef.velocidadePadrao)}`,
          valor: `${formatar.num(ef.velocidadePadrao, 1)} km/h`,
          acessorio: "chevron",
          onClick: () => editarObrigatorio("velocidadePadrao"),
        }),
        linha({
          id: "perfil-inicio-plano",
          rotulo: "Início do plano",
          detalhe: perfil.inicioPlano ? detalhePlano(perfil.inicioPlano) : "Defina para ver o treino de cada dia",
          valor: perfil.inicioPlano ? formatar.data(dataLocal(perfil.inicioPlano)) : pendente(),
          acessorio: "chevron",
          onClick: editarInicio,
        }),
      ),
      grupoZonas(ef),
      ...grupoDados(),
    );
    corpo.replaceChildren(...filhos);
    if (idFoco) document.getElementById(idFoco)?.focus({ preventScroll: true });
  }

  desenhar();
  return tela;
}

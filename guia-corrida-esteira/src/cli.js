#!/usr/bin/env node
const calc = require("./calculadora");

const AJUDA = `Uso:
  node src/cli.js zonas      --idade 38 [--repouso 58] [--fcmax 186]
  node src/cli.js esforco    --vel 5 --inc 12 [--peso 80] [--min 30] [--modo caminhada|corrida]
  node src/cli.js tabela     --vel 5 [--modo caminhada|corrida]
  node src/cli.js ebbeling   --vel 5 --fc 128 --idade 38 --sexo m|f
  node src/cli.js prescricao --mets 10 | --vo2max 35 | --fcmax 182 --repouso 58  [--vel 5]
  node src/cli.js cola       (mesmas opções de ebbeling ou prescricao)

  zonas       zonas de FC (com --repouso usa Karvonen; sem, % da FC máxima)
  esforco     custo estimado de uma combinação velocidade/inclinação
  tabela      mesma velocidade, inclinação de 0% a 20%
  ebbeling    VO2máx pelo teste de caminhada (T7) e a prescrição resultante
  prescricao  faixas de treino por % do VO2máx e a inclinação para cada uma
  cola        tabela de bolso: inclinação por velocidade e % do VO2máx`;

const OPCOES_TEXTO = new Set(["modo", "sexo"]);

function lerArgs(argv) {
  const [comando, ...resto] = argv;
  const opcoes = {};
  for (let i = 0; i < resto.length; i += 2) {
    const chave = resto[i].replace(/^--/, "");
    const valor = resto[i + 1];
    opcoes[chave] = OPCOES_TEXTO.has(chave) ? valor : Number(valor);
  }
  return { comando, opcoes };
}

const um = (n) => n.toFixed(1);

function zonas({ idade, repouso, fcmax }) {
  const fcMax = fcmax ?? calc.fcMaxEstimada(idade);
  const origem = fcmax ? "informada" : "estimada (208 - 0,7 x idade)";
  console.log(`FC máxima ${origem}: ${fcMax} bpm`);
  console.log(repouso ? `Método: Karvonen (repouso ${repouso} bpm)\n` : "Método: % da FC máxima\n");
  for (const z of calc.zonasFC({ fcMax, fcRepouso: repouso })) {
    console.log(`Z${z.zona}  ${String(z.min).padStart(3)}-${String(z.max).padEnd(3)} bpm  ${z.nome}`);
  }
}

function esforco({ vel, inc = 0, peso, min, modo }) {
  const vo2 = calc.vo2Esteira({ velocidadeKmh: vel, inclinacaoPct: inc, modo });
  const eq = calc.velocidadeEquivalentePlano(vo2);
  console.log(`${vel} km/h (${calc.ritmo(vel)}) a ${inc}%`);
  console.log(`VO2 estimado:   ${um(vo2)} ml/kg/min`);
  console.log(`METs:           ${um(calc.mets(vo2))}`);
  console.log(`Equivale a correr no plano a ${um(eq)} km/h (${calc.ritmo(eq)})`);
  if (peso) {
    const kcal = calc.kcalPorMinuto({ vo2, pesoKg: peso });
    const total = min ? ` | ${Math.round(kcal * min)} kcal em ${min} min` : "";
    console.log(`Gasto:          ${um(kcal)} kcal/min${total}`);
  }
}

function tabela({ vel, modo }) {
  console.log(`| Inclinação | VO2 (ml/kg/min) | METs | Corrida no plano equivalente |`);
  console.log(`|---:|---:|---:|---:|`);
  for (let inc = 0; inc <= 20; inc += 2) {
    const vo2 = calc.vo2Esteira({ velocidadeKmh: vel, inclinacaoPct: inc, modo });
    const eq = calc.velocidadeEquivalentePlano(vo2);
    const eqTxt = eq < 8 ? "< 8 km/h" : `${um(eq)} km/h (${calc.ritmo(eq)})`;
    console.log(`| ${inc}% | ${um(vo2)} | ${um(calc.mets(vo2))} | ${eqTxt} |`);
  }
}

const INCLINACAO_MAX = 20;
const CORRIDA_MIN_KMH = 8;

// Faixa de inclinação, já limitada ao que a esteira faz (0–20%).
// Sem `ateMets`, a faixa é aberta ("X% ou mais").
function faixaInclinacao(vel, deMets, ateMets) {
  const inc = (mets) => calc.inclinacaoParaMets({ velocidadeKmh: vel, mets, modo: "caminhada" });
  const de = inc(deMets);
  const ate = ateMets === undefined ? Infinity : inc(ateMets);
  if (ate < 0) return "o plano já passa do alvo: reduza a velocidade";
  if (de > INCLINACAO_MAX) return `nem 20% alcança: aumente a velocidade ou corra`;
  const ini = `${um(Math.max(0, de))}%`;
  if (ate === Infinity) return `${ini} ou mais`;
  if (ate > INCLINACAO_MAX) return `${ini} a 20% (o topo da faixa pede mais que 20%)`;
  return `${ini} a ${um(ate)}%`;
}

function faixaCorrida(deMets, ateMets) {
  const vel = (mets) => calc.velocidadeParaMets({ mets, inclinacaoPct: 1 });
  const fmt = (v) => `${um(v)} km/h (${calc.ritmo(v)})`;
  const de = vel(deMets);
  const ate = ateMets === undefined ? Infinity : vel(ateMets);
  if (ate < CORRIDA_MIN_KMH) return "alvo abaixo de um trote: caminhe com inclinação";
  if (ate === Infinity) return de < CORRIDA_MIN_KMH ? "qualquer corrida já alcança" : `${fmt(de)} ou mais`;
  if (de < CORRIDA_MIN_KMH) return `até ${fmt(ate)}`;
  return `${fmt(de)} a ${fmt(ate)}`;
}

function imprimirPrescricao(vo2max, origem, vel) {
  const p = calc.prescricaoVO2(vo2max);
  console.log(`VO2máx ${origem}: ${um(vo2max)} ml/kg/min = ${um(p.vo2maxMets)} METs\n`);

  console.log(`Contínuo (50–70% do VO2máx): ${um(p.continuo.min)} a ${um(p.continuo.max)} METs`);
  console.log(`  caminhando a ${vel} km/h: ${faixaInclinacao(vel, p.continuo.min, p.continuo.max)}`);
  console.log(`  correndo a 1%: ${faixaCorrida(p.continuo.min, p.continuo.max)}`);

  console.log(`\nIntervalado (esforço acima de 85%): ${um(p.intervalado.min)} METs ou mais`);
  console.log(`  caminhando a ${vel} km/h: ${faixaInclinacao(vel, p.intervalado.min)}`);
  console.log(`  correndo a 1%: ${faixaCorrida(p.intervalado.min)}`);

  console.log(`\nPirâmide contínua (3 min por degrau, sobe e desce):`);
  console.log(`| % VO2máx | METs | Inclinação a ${vel} km/h |`);
  console.log(`|---:|---:|---:|`);
  for (const pct of [50, 55, 60, 65, 70]) {
    const alvo = (pct / 100) * p.vo2maxMets;
    const inc = calc.inclinacaoParaMets({ velocidadeKmh: vel, mets: alvo, modo: "caminhada" });
    const txt = inc < 0 ? "0%" : inc > INCLINACAO_MAX ? "> 20%" : `${um(inc)}%`;
    console.log(`| ${pct}% | ${um(alvo)} | ${txt} |`);
  }
}

// Aceita o VO2máx pronto (--vo2max ou --mets), os dados do T7
// (--vel --fc --idade --sexo) ou a FC de repouso (estimativa de Uth).
function resolverVo2max({ mets, vo2max, fc, vel, sexo, fcmax, repouso, idade }) {
  if (vo2max) return { vo2max, origem: "informado" };
  if (mets) return { vo2max: mets * calc.ML_POR_MET, origem: "informado" };
  if (fc) {
    const v = calc.vo2maxEbbeling({ velocidadeKmh: vel, fcFinal: fc, idade, sexo });
    return { vo2max: v, origem: "estimado pelo T7 (Ebbeling)" };
  }
  if (repouso) {
    const fcMax = fcmax ?? calc.fcMaxEstimada(idade);
    const v = calc.vo2maxUth({ fcMax, fcRepouso: repouso });
    return { vo2max: v, origem: "estimado sem teste (Uth, erro grande)" };
  }
  throw new RangeError("informe --mets, --vo2max, os dados do T7 ou --repouso");
}

function prescricao(opcoes) {
  const { vo2max, origem } = resolverVo2max(opcoes);
  imprimirPrescricao(vo2max, origem, opcoes.vel ?? 5);
}

const VELOCIDADES_COLA = [4.0, 4.5, 5.0, 5.5, 6.0, 6.5];
const PORCENTAGENS_COLA = [50, 55, 60, 65, 70, 85];

// Tabela de bolso para a academia: inclinação por velocidade e % do VO2máx.
function cola(opcoes) {
  const { vo2max, origem } = resolverVo2max(opcoes);
  const p = calc.prescricaoVO2(vo2max);
  const alvo = (pct) => (pct / 100) * p.vo2maxMets;

  console.log(`## Cola de inclinação`);
  console.log(`VO2máx ${um(vo2max)} ml/kg/min = ${um(p.vo2maxMets)} METs, ${origem}\n`);
  console.log(`| Caminhando | ${PORCENTAGENS_COLA.map((x) => `${x}%`).join(" | ")} |`);
  console.log(`|---|${PORCENTAGENS_COLA.map(() => "---:").join("|")}|`);
  for (const vel of VELOCIDADES_COLA) {
    const celulas = PORCENTAGENS_COLA.map((pct) => {
      const inc = calc.inclinacaoParaMets({ velocidadeKmh: vel, mets: alvo(pct), modo: "caminhada" });
      if (inc < 0) return "↓";
      if (inc > INCLINACAO_MAX) return "> 20";
      return `${(Math.round(inc * 2) / 2).toFixed(1)}%`;
    });
    console.log(`| ${vel.toFixed(1)} km/h | ${celulas.join(" | ")} |`);
  }
  const corrida = PORCENTAGENS_COLA.map((pct) => {
    const v = calc.velocidadeParaMets({ mets: alvo(pct), inclinacaoPct: 1 });
    return v < CORRIDA_MIN_KMH ? "< 8" : `${um(v)} km/h`;
  });
  console.log(`| **Correndo a 1%** | ${corrida.join(" | ")} |`);
  console.log(`\nContínuo: 50–70%. Tiro do intervalado: 85% ou mais.`);
  console.log(`Inclinação arredondada para 0,5%. ↓ = o plano já passa do alvo (reduza a velocidade).`);
  console.log(`> 20 = a esteira não alcança nessa velocidade. < 8 = alvo abaixo de um trote.`);
}

const comandos = { zonas, esforco, tabela, ebbeling: prescricao, prescricao, cola };

function main(argv) {
  const { comando, opcoes } = lerArgs(argv);
  const executar = comandos[comando];
  if (!executar) {
    console.log(AJUDA);
    return comando ? 1 : 0;
  }
  try {
    executar(opcoes);
    return 0;
  } catch (erro) {
    console.error(`Erro: ${erro.message}\n\n${AJUDA}`);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));

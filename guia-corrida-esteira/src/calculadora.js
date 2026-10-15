// Calculadora de esforço para treino em esteira.
//
// Fórmulas:
// - FC máxima estimada: Tanaka, Monahan & Seals (2001) -> 208 - 0,7 x idade
// - Zonas por reserva de FC: Karvonen -> FCrep + % x (FCmax - FCrep)
// - Custo de O2 na esteira: equações metabólicas do ACSM
//     caminhada: VO2 = 0,1·S + 1,8·S·G + 3,5
//     corrida:   VO2 = 0,2·S + 0,9·S·G + 3,5
//   (S em m/min, G = inclinação em fração, VO2 em ml/kg/min)
// - VO2máx: teste submáximo de caminhada de Ebbeling et al. (1991)
//   e estimativa pela razão de FC de Uth et al. (2004)
// - Faixas de prescrição por % do VO2máx, como nos vídeos de referência:
//   contínuo 50–70%, esforço do intervalado acima de 85%
//
// São estimativas populacionais: servem para comparar sessões entre si,
// não para substituir a FC medida pelo relógio.

export const LIMITE_CAMINHADA_KMH = 6.5;
export const ML_POR_MET = 3.5;
const COEFICIENTES = {
  caminhada: { horizontal: 0.1, vertical: 1.8 },
  corrida: { horizontal: 0.2, vertical: 0.9 },
};

const ZONAS = [
  { zona: 1, nome: "Muito leve (aquecimento)", de: 0.5, ate: 0.6 },
  { zona: 2, nome: "Leve (base aeróbica)", de: 0.6, ate: 0.7 },
  { zona: 3, nome: "Moderado (aeróbico)", de: 0.7, ate: 0.8 },
  { zona: 4, nome: "Forte (limiar)", de: 0.8, ate: 0.9 },
  { zona: 5, nome: "Máximo (VO2máx)", de: 0.9, ate: 1.0 },
];

export function fcMaxEstimada(idade) {
  if (!(idade > 0)) throw new RangeError("idade deve ser positiva");
  return Math.round(208 - 0.7 * idade);
}

// Sem fcRepouso: % da FC máxima (padrão do app Zepp).
// Com fcRepouso: % da reserva de FC (Karvonen), mais individual.
export function zonasFC({ fcMax, fcRepouso }) {
  if (!(fcMax > 0)) throw new RangeError("fcMax deve ser positiva");
  if (fcRepouso !== undefined && !(fcRepouso > 0 && fcRepouso < fcMax)) {
    throw new RangeError("fcRepouso deve ficar entre 0 e fcMax");
  }
  const base = fcRepouso ?? 0;
  const faixa = fcMax - base;
  return ZONAS.map(({ zona, nome, de, ate }) => ({
    zona,
    nome,
    min: Math.round(base + de * faixa),
    max: Math.round(base + ate * faixa),
  }));
}

function resolverModo(velocidadeKmh, modo) {
  if (modo === "caminhada" || modo === "corrida") return modo;
  if (modo !== undefined && modo !== "auto") {
    throw new RangeError("modo deve ser 'auto', 'caminhada' ou 'corrida'");
  }
  return velocidadeKmh < LIMITE_CAMINHADA_KMH ? "caminhada" : "corrida";
}

const kmhParaMMin = (kmh) => (kmh * 1000) / 60;

export function vo2Esteira({ velocidadeKmh, inclinacaoPct = 0, modo = "auto" }) {
  if (!(velocidadeKmh > 0)) throw new RangeError("velocidade deve ser positiva");
  if (!(inclinacaoPct >= 0)) throw new RangeError("inclinação não pode ser negativa");
  const s = kmhParaMMin(velocidadeKmh);
  const g = inclinacaoPct / 100;
  const { horizontal, vertical } = COEFICIENTES[resolverModo(velocidadeKmh, modo)];
  return horizontal * s + vertical * s * g + 3.5;
}

// Inclinação (%) que leva a velocidade dada até os METs desejados.
// Pode sair negativa (carga já passa do alvo no plano) ou acima de 20%
// (a esteira não chega lá nessa velocidade); quem chama decide o que fazer.
export function inclinacaoParaMets({ velocidadeKmh, mets: alvo, modo = "auto" }) {
  if (!(velocidadeKmh > 0)) throw new RangeError("velocidade deve ser positiva");
  const s = kmhParaMMin(velocidadeKmh);
  const { horizontal, vertical } = COEFICIENTES[resolverModo(velocidadeKmh, modo)];
  return ((alvo * ML_POR_MET - 3.5 - horizontal * s) / (vertical * s)) * 100;
}

// Velocidade de corrida (km/h) que atinge os METs desejados numa inclinação fixa.
export function velocidadeParaMets({ mets: alvo, inclinacaoPct = 1 }) {
  const { horizontal, vertical } = COEFICIENTES.corrida;
  const s = (alvo * ML_POR_MET - 3.5) / (horizontal + (vertical * inclinacaoPct) / 100);
  return (s * 60) / 1000;
}

// Velocidade de corrida no plano com o mesmo custo de O2.
// Abaixo de ~8 km/h o número existe, mas não corresponde a uma corrida real.
export function velocidadeEquivalentePlano(vo2) {
  return (((vo2 - 3.5) / 0.2) * 60) / 1000;
}

export function mets(vo2) {
  return vo2 / ML_POR_MET;
}

// Teste de Ebbeling: 4 min de aquecimento a 0% e 4 min a 5% na mesma
// velocidade de caminhada (3,2–7,2 km/h). fcFinal é a FC estável do
// fim do estágio a 5%. Validado em adultos saudáveis de 20 a 59 anos.
export function vo2maxEbbeling({ velocidadeKmh, fcFinal, idade, sexo }) {
  if (!(velocidadeKmh >= 3.2 && velocidadeKmh <= 7.2)) {
    throw new RangeError("o teste de Ebbeling usa caminhada entre 3,2 e 7,2 km/h");
  }
  if (!(fcFinal > 0 && idade > 0)) throw new RangeError("fcFinal e idade devem ser positivas");
  if (sexo !== "m" && sexo !== "f") throw new RangeError("sexo deve ser 'm' ou 'f'");
  const mph = velocidadeKmh / 1.609344;
  return (
    15.1 +
    21.8 * mph -
    0.327 * fcFinal -
    0.263 * mph * idade +
    0.00504 * fcFinal * idade +
    (sexo === "m" ? 5.98 : 0)
  );
}

// Estimativa sem exercício: 15,3 x FCmáx / FCrepouso. Erro grande,
// serve só como ponto de partida até fazer um teste.
export function vo2maxUth({ fcMax, fcRepouso }) {
  if (!(fcMax > 0 && fcRepouso > 0)) throw new RangeError("fcMax e fcRepouso devem ser positivas");
  return 15.3 * (fcMax / fcRepouso);
}

export function prescricaoVO2(vo2max) {
  if (!(vo2max > 0)) throw new RangeError("vo2max deve ser positivo");
  const max = mets(vo2max);
  return {
    vo2maxMets: max,
    continuo: { min: 0.5 * max, max: 0.7 * max },
    intervalado: { min: 0.85 * max },
  };
}

// ~5 kcal por litro de O2 consumido (valor bruto, inclui o repouso).
export function kcalPorMinuto({ vo2, pesoKg }) {
  if (!(pesoKg > 0)) throw new RangeError("peso deve ser positivo");
  return (vo2 * pesoKg * 5) / 1000;
}

export function ritmo(velocidadeKmh) {
  if (!(velocidadeKmh > 0)) throw new RangeError("velocidade deve ser positiva");
  const totalSeg = Math.round(3600 / velocidadeKmh);
  const min = Math.floor(totalSeg / 60);
  const seg = String(totalSeg % 60).padStart(2, "0");
  return `${min}:${seg}/km`;
}


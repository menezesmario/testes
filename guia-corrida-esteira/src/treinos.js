// Treinos T1–T7, plano de 8 semanas e a divisão de cada sessão em fases.
// As faixas de intensidade são % do VO2máx (ver docs/04, 05 e 07).

export const TREINOS = {
  T1: { nome: "Caminhada inclinada", resumo: "Contínuo, base aeróbica com pouco impacto" },
  T2: { nome: "Rodagem leve", resumo: "Corrida contínua a 1%" },
  T3: { nome: "Pirâmide contínua", resumo: "Degraus de 3 min; só a inclinação muda" },
  T4: { nome: "Tiros em subida", resumo: "Acima de 85% no tiro, recuperação caminhando" },
  T5: { nome: "Limiar", resumo: "Blocos fortes a 1–2%" },
  T6: { nome: "Power hiking", resumo: "Caminhada a 15–20% de inclinação" },
  T7: { nome: "Teste de referência", resumo: "Ebbeling: 4 min a 0% e 4 min a 5%" },
};

// Cada sessão: id (semana + letra), treino e parâmetros. `alvo` é um número
// (centro da faixa, ±3 pontos) ou [de, ate]. `alternativa` é a opção do dia.
export const PLANO = [
  {
    semana: 1, fase: "Base", sessoes: [
      { id: "1A", treino: "T7", complemento: { treino: "T1", minutos: 15, alvo: 50 } },
      { id: "1B", treino: "T1", minutos: 25, alvo: 50 },
      { id: "1C", treino: "T1", minutos: 25, alvo: [50, 55] },
    ],
  },
  {
    semana: 2, fase: "Base", sessoes: [
      { id: "2A", treino: "T1", minutos: 30, alvo: 55 },
      { id: "2B", treino: "T3", topo: 60 },
      { id: "2C", treino: "T2", minutos: 20, alvo: [50, 70], alternativa: { treino: "T1", minutos: 30, alvo: 55 } },
    ],
  },
  {
    semana: 3, fase: "Base", sessoes: [
      { id: "3A", treino: "T1", minutos: 35, alvo: [55, 60] },
      { id: "3B", treino: "T3", topo: 65 },
      { id: "3C", treino: "T2", minutos: 25, alvo: [50, 70], alternativa: { treino: "T1", minutos: 35, alvo: [55, 60] } },
    ],
  },
  {
    semana: 4, fase: "Base", descarga: true, sessoes: [
      { id: "4A", treino: "T1", minutos: 25, alvo: 55 },
      { id: "4B", treino: "T1", minutos: 25, alvo: 55 },
      { id: "4C", treino: "T7" },
    ],
  },
  {
    semana: 5, fase: "Construção", sessoes: [
      { id: "5A", treino: "T1", minutos: 40, alvo: 60 },
      { id: "5B", treino: "T4", nivel: 1 },
      { id: "5C", treino: "T3", topo: 70 },
      { id: "5D", treino: "T2", minutos: 30, alvo: [50, 70], opcional: true },
    ],
  },
  {
    semana: 6, fase: "Construção", sessoes: [
      { id: "6A", treino: "T1", minutos: 40, alvo: 65 },
      { id: "6B", treino: "T4", nivel: 2 },
      { id: "6C", treino: "T3", topo: 70, repeticoes: 2 },
      { id: "6D", treino: "T6", blocos: 3, inclinacao: 15, opcional: true },
    ],
  },
  {
    semana: 7, fase: "Construção", sessoes: [
      { id: "7A", treino: "T1", minutos: 45, alvo: [65, 70] },
      { id: "7B", treino: "T4", nivel: 2 },
      { id: "7C", treino: "T2", minutos: 35, alvo: [50, 70], alternativa: { treino: "T5", blocos: 2, minutos: 8 } },
      { id: "7D", treino: "T6", blocos: 4, inclinacao: 15, opcional: true },
    ],
  },
  {
    semana: 8, fase: "Construção", descarga: true, sessoes: [
      { id: "8A", treino: "T1", minutos: 30, alvo: 60 },
      { id: "8B", treino: "T3", topo: 70 },
      { id: "8C", treino: "T7" },
    ],
  },
];

const NIVEIS_T4 = {
  1: { repeticoes: 6, tiro: 45, recuperacao: 90 },
  2: { repeticoes: 8, tiro: 60, recuperacao: 90 },
  3: { repeticoes: 7, tiro: 90, recuperacao: 120 },
};

export function normalizarAlvo(alvo) {
  if (alvo == null) return null;
  if (Array.isArray(alvo)) return { de: alvo[0], ate: alvo[1] };
  return { de: alvo - 3, ate: alvo + 3 };
}

const fase = (tipo, rotulo, segundos, extra = {}) => ({ tipo, rotulo, segundos, alvo: null, ...extra });

const AQUECIMENTO = fase("aquecimento", "Aquecimento", 300, {
  dica: "4,5–5,5 km/h a 0–1%; suba para 2–4% nos 2 minutos finais",
});
const VOLTA = fase("volta", "Volta à calma", 300, { dica: "Caminhada leve a 0–1%" });

function degrausPiramide(topo, repeticoes) {
  const subida = [];
  for (let p = 50; p <= topo; p += 5) subida.push(p);
  const uma = [...subida, ...subida.slice(0, -1).reverse()];
  return Array.from({ length: repeticoes }, (_, r) => (r === 0 ? uma : uma.slice(1))).flat();
}

// Divide uma sessão do plano (ou uma escolhida livremente) em fases.
export function montarFases(sessao) {
  const { treino } = sessao;
  if (!TREINOS[treino]) throw new RangeError(`treino desconhecido: ${treino}`);

  if (treino === "T7") {
    return [
      fase("estagio", "Estágio 1 · 0%", 240, {
        inclinacaoFixa: 0,
        dica: "Caminhada firme entre 3,2 e 7,2 km/h. Use a mesma velocidade em todos os testes",
      }),
      fase("estagio", "Estágio 2 · 5%", 240, {
        inclinacaoFixa: 5,
        coletarFc: [180, 240],
        dica: "Mesma velocidade, sem segurar no corrimão",
      }),
      fase("volta", "Volta à calma", 180, { dica: "Desça a inclinação e caminhe devagar" }),
    ];
  }

  const meio = [];
  if (treino === "T1" || treino === "T2") {
    meio.push(fase("bloco", treino === "T1" ? "Caminhada inclinada" : "Rodagem", sessao.minutos * 60, {
      alvo: normalizarAlvo(sessao.alvo),
      ...(treino === "T2" && { inclinacaoFixa: 1 }),
    }));
  } else if (treino === "T3") {
    for (const p of degrausPiramide(sessao.topo ?? 70, sessao.repeticoes ?? 1)) {
      meio.push(fase("bloco", `Degrau ${p}%`, 180, { alvo: { de: p - 2.5, ate: p + 2.5 } }));
    }
  } else if (treino === "T4") {
    const { repeticoes, tiro, recuperacao } = NIVEIS_T4[sessao.nivel ?? 1];
    for (let r = 1; r <= repeticoes; r++) {
      meio.push(fase("tiro", `Tiro ${r} de ${repeticoes}`, tiro, { alvo: { de: 85, ate: 100 } }));
      if (r < repeticoes) {
        meio.push(fase("recuperacao", "Recuperação", recuperacao, {
          inclinacaoFixa: 1,
          dica: "Caminhe a 1% até a FC voltar para a Z2",
        }));
      }
    }
  } else if (treino === "T5") {
    const blocos = sessao.blocos ?? 2;
    for (let b = 1; b <= blocos; b++) {
      meio.push(fase("bloco", `Limiar ${b} de ${blocos}`, (sessao.minutos ?? 8) * 60, {
        alvo: { de: 78, ate: 85 },
        inclinacaoFixa: 1,
      }));
      if (b < blocos) meio.push(fase("recuperacao", "Caminhada", 120, { inclinacaoFixa: 1 }));
    }
  } else if (treino === "T6") {
    const blocos = sessao.blocos ?? 4;
    for (let b = 1; b <= blocos; b++) {
      meio.push(fase("bloco", `Subida ${b} de ${blocos}`, 300, {
        alvo: { de: 70, ate: 85 },
        inclinacaoFixa: sessao.inclinacao ?? 15,
        dica: "Passos curtos, mãos nas coxas se precisar, nunca no corrimão",
      }));
      if (b < blocos) meio.push(fase("recuperacao", "Recuperação", 120, { inclinacaoFixa: 4 }));
    }
  }
  return [AQUECIMENTO, ...meio, VOLTA].map((f) => ({ ...f }));
}

export const duracaoTotal = (fases) => fases.reduce((s, f) => s + f.segundos, 0);

// Semana do plano para uma data, contando a partir do início (1 a 8).
export function semanaDoPlano(inicioISO, dataISO) {
  const dia = 86400000;
  const dias = Math.floor((Date.parse(dataISO.slice(0, 10)) - Date.parse(inicioISO.slice(0, 10))) / dia);
  return Math.min(8, Math.max(1, Math.floor(dias / 7) + 1));
}

// Próxima sessão obrigatória ainda não feita na semana (ou null se a semana acabou).
export function proximaSessao(semana, idsFeitos) {
  const feitos = new Set(idsFeitos);
  const dados = PLANO[semana - 1];
  return dados.sessoes.find((s) => !s.opcional && !feitos.has(s.id)) ?? null;
}

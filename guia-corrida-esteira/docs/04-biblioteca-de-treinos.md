# 04 · Biblioteca de treinos

Sete treinos-modelo. O plano de 8 semanas combina esses blocos.

A intensidade vem em **% do VO2máx**, o método dos vídeos ([07 · Prescrição pelo VO2máx](07-prescricao-pelo-vo2max.md)). Para saber a inclinação exata, rode `node src/cli.js prescricao` depois do T7. As velocidades e inclinações escritas aqui são **pontos de partida** para quem ainda não fez o teste. Durante o treino, a zona de FC do relógio confirma se você está na faixa.

Todos começam com o mesmo aquecimento e terminam com a mesma volta à calma:

- **Aquecimento (5–8 min):** caminhada de 4,5 a 5,5 km/h, 0–1%, subindo para 2–4% nos 2 minutos finais. FC em Z1.
- **Volta à calma (5 min):** caminhada leve a 0–1%, até a FC ficar abaixo de ~110 bpm. Depois, alongue panturrilhas e flexores do quadril.

---

## T1 · Caminhada inclinada em Z2

**Objetivo:** base aeróbica com pouco impacto. É o treino "pilar" do guia.

| Parâmetro | Início | Progressão |
|---|---|---|
| Intensidade | **50–55% do VO2máx** (≈ Z1 alta) | até **70%** (≈ Z2) |
| Velocidade | 4,5–5,0 km/h | até 5,5–6,0 km/h |
| Inclinação | a que a `prescricao` indicar (sem teste: 4–8%) | até 12–15% ou mais |
| Bloco principal | 25 min | até 45–50 min |

- É o treino que o vídeo 1 defende: caminhada com inclinação, para quem não pode ou não quer correr.
- A referência popular é o **"12-3-30"**: 12%, 4,8 km/h (3 mph), 30 min. Ele custa ~8,2 METs, o que é 82% do VO2máx de quem tem 10 METs. Chegue nele aos poucos, sem começar por ele.
- Mantenha o tronco ereto, passos curtos e braços soltos, **sem segurar no corrimão**. Se precisar segurar, a inclinação está alta demais.
- Se a FC passar da Z2, baixe 1–2% de inclinação.

## T2 · Rodagem leve

**Objetivo:** volume de corrida em ritmo confortável.

- **Bloco:** 20 a 40 min a 1%, a **50–70% do VO2máx** (≈ Z1–Z2).
- **Velocidade:** a linha "correndo a 1%" da `prescricao`. Se ela disser que o alvo fica abaixo de um trote, a corrida ainda é intensa demais para treino contínuo. Fique no T1 ou alterne corrida e caminhada.
- **Iniciantes:** alterne corrida e caminhada (ex.: 2 min correndo + 1 min caminhando × 8) e reduza a caminhada a cada semana.

## T3 · Pirâmide contínua

**Objetivo:** variar o estímulo dentro da faixa contínua. É o formato descrito no vídeo 2.

Velocidade fixa (caminhada de 5,0–5,5 km/h). Mude **apenas a inclinação**, a cada **3 minutos**:

```
50% → 55% → 60% → 65% → 70% → 65% → 60% → 55% → 50% do VO2máx   (27 min)
```

A tabela "Pirâmide contínua" do `node src/cli.js prescricao` dá a inclinação de cada degrau. Exemplo para VO2máx de 10 METs a 5 km/h: 3,8% → 4,9% → 6,1% → 7,3% → 8,4% e volta.

- **Sem teste ainda:** use degraus fixos de 2% (2% → 4% → … → 12% → … → 2%), mantendo Z1–Z2 na subida e no máximo Z3 no topo.
- **Progressão:** o vídeo 2 sugere fazer uma segunda pirâmide para ter volume suficiente (54 min no total). Outra opção é começar o primeiro degrau em 55%.

## T4 · Tiros em subida

**Objetivo:** força de perna e potência aeróbica com menos impacto que tiros no plano.

| Nível | Tiro | Recuperação | Repetições |
|---|---|---|---|
| 1 | 45 s correndo a 6–8% | 90 s caminhando a 1% | 6 |
| 2 | 60 s a 6–8% | 90 s caminhando | 8 |
| 3 | 90 s a 8–10% | 2 min caminhando | 6–8 |
| Opção caminhada | 60 s a 15–18%, caminhada rápida | 90 s a 2% | 6–10 |

- **Intensidade:** no tiro, **acima de 85% do VO2máx** (linha "Intervalado" da `prescricao`). O esforço percebido fica em 8 de 10. Termine sentindo que conseguiria fazer mais um tiro.
- Para quem é bem condicionado, caminhar a 5 km/h não chega a 85% nem com 20% de inclinação. Corra ou caminhe mais rápido.
- **FC:** vai ficar atrasada nos tiros curtos. Use-a para a recuperação: só comece o próximo tiro quando a FC voltar para a **Z2**.
- **Dica de segurança:** em vez de mudar a velocidade a cada tiro, ajuste a inclinação ou monte o intervalo na memória da esteira. Para descansar, baixe a velocidade antes da inclinação.

## T5 · Limiar (tempo run)

**Objetivo:** aguentar ritmo forte por mais tempo.

- **Bloco:** 2 × 8 min **ou** 3 × 6 min em **Z4 baixa** (esforço 7/10), com 2 min de caminhada entre os blocos. Progrida até 20 min contínuos.
- **Inclinação:** 1–2%.
- Pré-requisito: 4 semanas de T1/T2 sem dor.

## T6 · Power hiking (trilha na esteira)

**Objetivo:** força específica de subida, preparação para trilha e alto gasto calórico com baixo impacto.

- **Bloco:** 4 × 5 min a **15–20%**, 4,0–5,0 km/h, com 2 min a 3–5% entre os blocos.
- **Zona:** Z3, com picos em Z4.
- Passos curtos, mãos podem apoiar nas coxas (como nas trilhas), **nunca no corrimão**.
- Pré-requisito: completar o T1 a 12% por 40 min sem dor na panturrilha.

## T7 · Teste de referência (Ebbeling, a cada 4 semanas)

**Objetivo:** estimar o VO2máx, que é a base da prescrição dos vídeos, e medir a evolução, sem esforço máximo. É o teste submáximo de caminhada de Ebbeling et al. (1991), validado em adultos saudáveis de 20 a 59 anos.

**Condições:** mesmo horário, descansado, sem treino forte no dia anterior e sem cafeína nas 3 horas antes. Relógio bem preso. Se tiver uma cinta peitoral, use-a: o GTR 4 aceita, e a leitura fica mais estável.

1. **Escolha a velocidade:** uma caminhada firme entre **3,2 e 7,2 km/h** que deixe a FC entre 50% e 70% da FC máxima estimada. Anote essa velocidade: os próximos testes precisam usar a mesma.
2. **4 min a 0%** nessa velocidade (aquecimento).
3. **4 min a 5%**, na mesma velocidade, sem segurar no corrimão.
4. Anote a FC no fim do **3º e do 4º minuto** a 5%. Se a diferença passar de 5 bpm, caminhe mais 1 minuto e use os dois últimos valores. A **FC final** é a média deles.
5. Desça a inclinação, caminhe devagar e anote a FC 1 minuto depois (recuperação).
6. Calcule:
   ```bash
   node src/cli.js ebbeling --vel 5 --fc 128 --idade 38 --sexo m   # VO2máx e faixas
   node src/cli.js cola     --vel 5 --fc 128 --idade 38 --sexo m   # tabela de bolso
   ```
   A saída traz o VO2máx estimado e as inclinações para T1, T3 e T4.

**Interpretação:** VO2máx estimado **maior** (ou FC final **menor** na mesma velocidade) indica melhor condicionamento. O erro típico do teste é de ~5 ml/kg/min, então compare sempre com os seus testes anteriores, não com os de outras pessoas.

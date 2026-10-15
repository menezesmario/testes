# 07 · Prescrição pelo VO2máx (método dos vídeos)

Os dois vídeos de referência ([referencias.md](../referencias.md)) usam o **VO2máx em METs** como régua de intensidade. O guia segue o mesmo método:

> **A esteira dá a carga em METs (prescrição). O relógio dá a FC nessa carga (monitoramento).**

## Passo 1 · Descobrir o VO2máx

Os vídeos insistem: **sem teste não há prescrição**. As opções, da mais para a menos precisa:

| Fonte | Precisão | Como |
|---|---|---|
| Ergoespirometria (teste com análise de gases) | ✅ padrão-ouro | Clínica ou laboratório de fisiologia do exercício |
| **T7 · teste de Ebbeling** | ✅ erro típico de ~5 ml/kg/min | 8 min de caminhada na esteira + FC do relógio. Ver [biblioteca](04-biblioteca-de-treinos.md#t7--teste-de-referência-ebbeling-a-cada-4-semanas) |
| VO2máx do próprio Amazfit | ⚠️ | Só em modelos com essa função, e a partir de corridas **ao ar livre com GPS** |
| Estimativa pela FC (Uth: 15,3 × FCmáx/FCrepouso) | ❌ erro grande | Só como ponto de partida, até fazer o T7 |

Para converter, use **1 MET = 3,5 ml/kg/min**. Um VO2máx de 35 ml/kg/min equivale a 10 METs.

## Passo 2 · Aplicar as faixas

| Tipo de treino | Faixa | Observação |
|---|---|---|
| Contínuo (T1, T2, T3) | **50–70% do VO2máx** | Iniciante começa em 50–55% e sobe aos poucos: 53 → 56 → 59 → 65 → 70% |
| Intervalado (T4) | **acima de 85%** no esforço | Recuperação em caminhada leve |

O vídeo 1 cita 55–70% para o contínuo e o vídeo 2 cita 50–70%. O guia usa 50% como entrada para iniciantes.

## Passo 3 · Converter em inclinação na esteira

```bash
node src/cli.js prescricao --mets 10            # VO2máx já conhecido, em METs
node src/cli.js prescricao --vo2max 35 --vel 5.5
node src/cli.js ebbeling --vel 5 --fc 128 --idade 38 --sexo m   # direto do T7
```

Saída para VO2máx de 10 METs (o exemplo da "Joana" do vídeo 1):

```
Contínuo (50–70% do VO2máx): 5.0 a 7.0 METs
  caminhando a 5 km/h: 3.8% a 8.4%
Intervalado (esforço acima de 85%): 8.5 METs ou mais
  caminhando a 5 km/h: 11.9% ou mais
```

Se o painel da esteira da sua academia mostrar METs, confira. No vídeo 1, o painel deu 3,4 METs para 5 km/h no plano e 5,6 METs para 5 km/h a 5%; a calculadora dá 3,4 e 5,5. É a mesma equação (ACSM).

### Exemplos rápidos (caminhando a 5 km/h)

| VO2máx | Contínuo 50–70% | Intervalado > 85% |
|---|---|---|
| 6 METs (muito destreinado) | 0% a 1,9% | 4% ou mais |
| 10 METs (iniciante) | 3,8% a 8,4% | 11,9% ou mais |
| 15 METs (bem condicionado) | 9,6% a 16,6% | nem 20% alcança: aumente a velocidade ou corra a partir de 11,8 km/h |

Com uma esteira que vai a **20%**, mesmo quem é bem condicionado chega à faixa contínua só caminhando. O limite aparece no intervalado.

## Passo 4 · Ligar à FC do relógio

As faixas em METs valem para qualquer pessoa. A FC que corresponde a elas é individual. Para descobrir a sua:

1. Faça 2 ou 3 sessões de T1 na inclinação prescrita.
2. Anote a FC estável depois do minuto 10 (antes que a deriva cardíaca apareça).
3. Essa faixa de FC passa a ser **o seu alvo pessoal** para treinos contínuos. Ajuste o alerta de FC no Zepp para o topo dela.

Enquanto isso não acontece, use esta correspondência aproximada (ACSM: % da reserva de FC ≈ % da reserva de VO2):

| % do VO2máx | ≈ % reserva de FC (Karvonen) | Zona do guia (Karvonen) |
|---|---|---|
| 50% | ~45% | Z1 |
| 60% | ~56% | Z1 alta |
| 70% | ~68% | Z2 |
| 85% | ~84% | Z4 |

Em outras palavras, **a faixa contínua dos vídeos corresponde, mais ou menos, à Z1–Z2** das [zonas de FC](01-zonas-de-frequencia-cardiaca.md) pelo método Karvonen.

## Reavaliação

Repita o T7 a cada 4 semanas, na **mesma velocidade**. Se o VO2máx subir, rode `prescricao` de novo: as mesmas porcentagens vão pedir mais inclinação. É a progressão que os vídeos descrevem.

## Cuidados com os números

- **"5 km/h a 8% ≈ correr a 8 km/h" (vídeo 1).** Pelas equações, 5 km/h a 8% dá ~6,8 METs, e correr a 8 km/h dá ~8,6 METs. A equivalência acontece por volta de **11–12%**. Até usando só os números do painel mostrados no vídeo (0% → 3,4 e 5% → 5,6 METs), 8% fica em ~6,9 METs. A ideia está certa; o número está otimista.
- **O "12-3-30" (4,8 km/h a 12%) custa ~8,2 METs.** Para quem tem VO2máx de 10 METs, isso é 82%, já perto da faixa de intervalado. Não é um treino contínuo de iniciante.
- **% do VO2máx × % da reserva de VO2.** O ACSM recomenda calcular sobre a reserva (VO2máx − 1 MET). Os vídeos usam o VO2máx direto, e o guia segue os vídeos. A diferença só pesa para VO2máx baixo (abaixo de ~8 METs).
- **Corrimão.** Segurar invalida todos esses cálculos: o gasto real cai bastante.

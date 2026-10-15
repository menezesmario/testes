# 01 · Zonas de frequência cardíaca

O guia usa **5 zonas**, a mesma divisão que o app Zepp mostra no resumo de cada treino.

> A **prescrição** do guia é por % do VO2máx, como nos vídeos ([07](07-prescricao-pelo-vo2max.md)). As zonas de FC servem para **monitorar** com o relógio se você está na faixa. A faixa contínua dos vídeos (50–70% do VO2máx) corresponde, mais ou menos, à Z1–Z2 pelo método Karvonen.

## 1. FC máxima

Em ordem de preferência:

1. **A maior FC que o relógio já registrou** num esforço realmente máximo (fim de prova, último tiro de um treino duro). Confira no histórico do Zepp.
2. **Estimativa por idade** (Tanaka): `208 − 0,7 × idade`. O erro típico é de ±10 bpm, então trate como ponto de partida.

Não faça um teste máximo por conta própria se você é sedentário, tem mais de 40 anos sem acompanhamento ou tem qualquer fator de risco cardíaco. Veja [06 · Segurança](06-seguranca.md).

## 2. FC de repouso

Use a média de 3 a 5 manhãs: a medida feita ao acordar, antes de levantar, ou a "FC em repouso" que o Zepp calcula a partir do sono. Um valor de repouso deixa as zonas mais individuais (método Karvonen).

## 3. As zonas

| Zona | Nome | % FC máx | % reserva (Karvonen) | Esforço percebido (0–10) | Como se sente |
|---|---|---|---|---|---|
| Z1 | Muito leve | 50–60% | 50–60% | 1–2 | Aquecimento, conversa fácil |
| Z2 | Leve (base aeróbica) | 60–70% | 60–70% | 3–4 | Frases completas, respiração pelo nariz possível |
| Z3 | Moderado | 70–80% | 70–80% | 5–6 | Frases curtas |
| Z4 | Forte (limiar) | 80–90% | 80–90% | 7–8 | Poucas palavras |
| Z5 | Máximo | 90–100% | 90–100% | 9–10 | Não fala |

Para calcular as suas:

```bash
node src/cli.js zonas --idade 38                # % da FC máxima
node src/cli.js zonas --idade 38 --repouso 58   # Karvonen (recomendado)
node src/cli.js zonas --fcmax 188 --repouso 58  # se você já conhece a FC máx
```

Exemplo, 38 anos, repouso 58 bpm:

```
FC máxima estimada (208 - 0,7 x idade): 181 bpm
Método: Karvonen (repouso 58 bpm)

Z1  120-132 bpm  Muito leve (aquecimento)
Z2  132-144 bpm  Leve (base aeróbica)
Z3  144-156 bpm  Moderado (aeróbico)
Z4  156-169 bpm  Forte (limiar)
Z5  169-181 bpm  Máximo (VO2máx)
```

## 4. Distribuição da semana

Para quem treina 3 a 5 vezes por semana, a regra prática é **cerca de 80% do tempo em Z1–Z2 e 20% em Z3–Z5**. Na esteira inclinada é fácil passar sem querer para Z3: se a FC subir, **baixe primeiro a inclinação** e só depois a velocidade.

## 5. Quando a FC engana

- **Deriva cardíaca:** em sessões longas, no calor ou com pouca hidratação, a FC sobe de 5 a 10 bpm sem que a carga mude. É normal.
- **Atraso nos tiros:** em intervalos de 30 a 60 s, a FC ainda está subindo quando o tiro acaba. Nos tiros curtos, guie-se pelo esforço percebido e use a FC para controlar a recuperação.
- **Leitura óptica no pulso:** pode travar na cadência dos passos. Uma FC "colada" em ~160–170 logo no começo é suspeita. Veja [02 · Amazfit GTR](02-amazfit-gtr.md).

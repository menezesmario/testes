# 03 · Inclinação e velocidade

A esteira da academia é uma **NewFitness Xtreme XT025**, que vai até **20%**. Inclinação é a ferramenta mais poderosa do guia: dá para chegar a um esforço de corrida **caminhando**, com bem menos impacto.

O painel da XT025 **não mostra METs**. Por isso a calculadora faz esse papel: o [app](../README.md#app) mostra os METs ao vivo, e o comando `node src/cli.js cola ...` gera a tabela de bolso ([07](07-prescricao-pelo-vo2max.md#passo-3--converter-em-inclinação-na-esteira)).

## Antes de tudo: o número do painel é % ou nível?

Todas as contas do guia supõem que o painel mostra **inclinação em %**. Algumas esteiras mostram **níveis** (1, 2, 3…) que não correspondem a %. Não encontrei a ficha técnica da XT025, então confira uma vez:

1. Com a esteira parada a **0**, apoie o celular na lona, perto do painel, e abra o app de nível (no iPhone: app Medida › Nível; no Android, qualquer app de "nível" ou "inclinômetro"). Anote o ângulo: esse é o desnível do piso.
2. Suba para **10** e meça de novo. Subtraia o valor do passo 1.
3. Compare:

| Painel | Ângulo esperado se for % |
|---:|---:|
| 5 | 2,9° |
| 10 | 5,7° |
| 15 | 8,5° |
| 20 | 11,3° |

Se a 10 der ~5,7°, o painel está em %. Se der outro valor, anote a correspondência real (meça também 5, 15 e 20) e use a % medida na calculadora.

## Quanto custa cada %

As tabelas usam as equações metabólicas do ACSM (ver `src/calculadora.js`). A coluna da direita diz **a que velocidade você teria de correr no plano para ter o mesmo gasto**.

São estimativas médias. A sua FC é que diz o esforço real. Acima de ~15% de inclinação a margem de erro das fórmulas aumenta.

### Caminhando a 4,8 km/h (3 mph, a velocidade do "12-3-30")

| Inclinação | VO2 (ml/kg/min) | METs | Corrida no plano equivalente |
|---:|---:|---:|---:|
| 0% | 11.5 | 3.3 | < 8 km/h |
| 2% | 14.4 | 4.1 | < 8 km/h |
| 4% | 17.3 | 4.9 | < 8 km/h |
| 6% | 20.1 | 5.8 | < 8 km/h |
| 8% | 23.0 | 6.6 | < 8 km/h |
| 10% | 25.9 | 7.4 | < 8 km/h |
| 12% | 28.8 | 8.2 | < 8 km/h |
| 14% | 31.7 | 9.0 | 8.4 km/h (7:06/km) |
| 16% | 34.5 | 9.9 | 9.3 km/h (6:27/km) |
| 18% | 37.4 | 10.7 | 10.2 km/h (5:54/km) |
| 20% | 40.3 | 11.5 | 11.0 km/h (5:26/km) |

### Caminhando a 5,5 km/h

| Inclinação | VO2 (ml/kg/min) | METs | Corrida no plano equivalente |
|---:|---:|---:|---:|
| 0% | 12.7 | 3.6 | < 8 km/h |
| 2% | 16.0 | 4.6 | < 8 km/h |
| 4% | 19.3 | 5.5 | < 8 km/h |
| 6% | 22.6 | 6.4 | < 8 km/h |
| 8% | 25.9 | 7.4 | < 8 km/h |
| 10% | 29.2 | 8.3 | < 8 km/h |
| 12% | 32.5 | 9.3 | 8.7 km/h (6:54/km) |
| 14% | 35.8 | 10.2 | 9.7 km/h (6:12/km) |
| 16% | 39.1 | 11.2 | 10.7 km/h (5:37/km) |
| 18% | 42.4 | 12.1 | 11.7 km/h (5:09/km) |
| 20% | 45.7 | 13.0 | 12.7 km/h (4:45/km) |

### Correndo a 8 km/h

| Inclinação | VO2 (ml/kg/min) | METs | Corrida no plano equivalente |
|---:|---:|---:|---:|
| 0% | 30.2 | 8.6 | 8.0 km/h (7:30/km) |
| 2% | 32.6 | 9.3 | 8.7 km/h (6:53/km) |
| 4% | 35.0 | 10.0 | 9.4 km/h (6:21/km) |
| 6% | 37.4 | 10.7 | 10.2 km/h (5:54/km) |
| 8% | 39.8 | 11.4 | 10.9 km/h (5:31/km) |
| 10% | 42.2 | 12.0 | 11.6 km/h (5:10/km) |
| 12% | 44.6 | 12.7 | 12.3 km/h (4:52/km) |
| 14% | 47.0 | 13.4 | 13.0 km/h (4:36/km) |
| 16% | 49.4 | 14.1 | 13.8 km/h (4:22/km) |
| 18% | 51.8 | 14.8 | 14.5 km/h (4:09/km) |
| 20% | 54.2 | 15.5 | 15.2 km/h (3:57/km) |

### Correndo a 10 km/h

| Inclinação | VO2 (ml/kg/min) | METs | Corrida no plano equivalente |
|---:|---:|---:|---:|
| 0% | 36.8 | 10.5 | 10.0 km/h (6:00/km) |
| 2% | 39.8 | 11.4 | 10.9 km/h (5:30/km) |
| 4% | 42.8 | 12.2 | 11.8 km/h (5:05/km) |
| 6% | 45.8 | 13.1 | 12.7 km/h (4:43/km) |
| 8% | 48.8 | 14.0 | 13.6 km/h (4:25/km) |
| 10% | 51.8 | 14.8 | 14.5 km/h (4:08/km) |
| 12% | 54.8 | 15.7 | 15.4 km/h (3:54/km) |

Para outras velocidades:

```bash
node src/cli.js tabela --vel 6 --modo caminhada
node src/cli.js esforco --vel 5 --inc 15 --peso 80 --min 40
```

## Regras práticas

- **1% para imitar a rua.** Na esteira não há resistência do ar. Para corridas acima de ~10 km/h, 1% de inclinação compensa isso (Jones & Doust, 1996). Use 1% como o "plano" das rodagens.
- **Mude uma variável por vez.** Numa mesma semana, aumente velocidade **ou** inclinação **ou** duração.
- **A FC sobe com atraso.** Depois de mudar a inclinação, espere 2 a 3 minutos antes de julgar a zona.
- **Caminhar ou correr?** Entre 6 e 8 km/h numa subida forte, caminhar costuma ser mais econômico. Se a FC disparar correndo, caminhe mais rápido.
- **Inclinação alta, velocidade baixa.** Acima de 12%, a sobrecarga vai para panturrilha, tendão de Aquiles e lombar. Aumente a inclinação aos poucos, no máximo +2 pontos por semana no bloco principal.

## Inclinação × impacto

| Situação | Impacto nas articulações | Carga em panturrilha/Aquiles | Quando usar |
|---|---|---|---|
| Correr no plano (1%) | Alto | Médio | Rodagens, ritmo de prova |
| Caminhar inclinado (8–15%) | Baixo | Médio-alto | Base aeróbica com pouco impacto, volta de lesão |
| Caminhar muito inclinado (15–20%) | Baixo | Alto | Força específica e "trilha" |
| Correr inclinado (4–10%) | Médio | Alto | Tiros em subida, força |

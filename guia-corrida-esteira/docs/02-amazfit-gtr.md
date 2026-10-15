# 02 · Usando o Amazfit GTR 4

> Escrito para o GTR 4 com Zepp OS 3.x. Os nomes dos menus mudam entre versões do relógio e do app Zepp. Se algo não estiver onde está descrito, procure pelo nome da função. Mantenha relógio e app atualizados.

## O que o GTR 4 oferece para este guia

| Recurso | Para que serve aqui |
|---|---|
| FC óptica no pulso | Monitorar se você está na faixa prescrita |
| **Cinta peitoral Bluetooth** (suportada desde o Zepp OS 3) | Opcional. Mais precisa no teste T7 e nos tiros curtos |
| **Alertas de zona de FC** | Vibrar quando você sair da faixa no treino contínuo |
| **Treino intervalado** no relógio (aquecimento, tiros, recuperação, repetições, volta à calma) | Avisar cada troca no T4, sem depender de programa da esteira |
| Modelos de treino (Zepp Coach) | Guardar o T4 e o T3 prontos. Só valem para alguns esportes |
| VO2máx, efeito do treino, carga de treino, tempo de recuperação | Acompanhar volume e cansaço. O VO2máx só sai de treinos ao ar livre |
| PAI | Meta semanal de atividade (acima de 100) |
| Transmissão de FC (Heart Rate Push, Zepp OS 3.5) | Se a esteira aceitar sensor de FC Bluetooth, o painel pode mostrar a FC do relógio. Não confirmado para a XT025 |

## O que ele mede bem e mal na esteira

| Dado | Confiável? | Observação |
|---|---|---|
| Frequência cardíaca | ✅ boa em ritmo constante | Pior no começo do treino, em tiros curtos e com o braço apoiado. Análises do GTR 4 relatam FC subestimada no início e na retomada de corridas |
| Tempo em cada zona | ✅ | |
| Duração | ✅ | |
| Cadência (passos/min) | ✅ | Vem do acelerômetro |
| Carga de treino e efeito do treino | ⚠️ tendência | Calculados pela FC. Úteis para comparar semanas |
| Calorias | ⚠️ estimativa | Útil para comparar sessões entre si |
| Distância e ritmo | ❌ | Sem GPS, o relógio estima pelo movimento do braço. **Use o painel da esteira** |
| Inclinação | ❌ não mede | **Anote manualmente** |
| VO2máx | ❌ na esteira | O GTR 4 estima o VO2máx em corridas **ao ar livre com GPS**. Na esteira, use o teste T7. Se você correr na rua, compare os dois |

Resumo: **a esteira informa a carga (velocidade e inclinação), e a calculadora a converte em METs, porque o painel da XT025 não mostra METs. O relógio informa a resposta do corpo (FC).**

## Configuração inicial (uma vez)

1. **Perfil no Zepp:** data de nascimento, peso, altura e sexo corretos. Calorias, zonas e VO2máx dependem disso.
2. **Monitoramento contínuo de FC** ligado, a cada 1 minuto. Isso alimenta a FC de repouso e o PAI.
3. **Zonas de FC:** no app Zepp, procure "Zonas de frequência cardíaca" nas configurações de treino ou do perfil.
   - Se houver a opção de calcular pela **reserva de FC**, escolha-a e informe FC máxima e FC de repouso.
   - Se só houver **% da FC máxima**, informe a sua FC máxima real (ou a estimada) em vez de deixar o relógio usar só a idade.
   - Depois confira se as faixas do relógio batem com `node src/cli.js zonas`.
4. **Alerta de zona de FC:** no relógio, abra o treino **Esteira** e vá em **Configurações › Assistente › Alertas de treino › Zona de frequência cardíaca**. Escolha a zona que corresponde ao topo da sua faixa contínua ([07 · passo 4](07-prescricao-pelo-vo2max.md#passo-4--ligar-à-fc-do-relógio)). O alerta vale para o treino inteiro, não para cada intervalo.
5. **Treino intervalado (para o T4):** nas configurações do treino, procure "Treino intervalado". Monte aquecimento, tiro, recuperação, número de repetições e volta à calma. Se a Esteira não tiver essa opção, use "Corrida interna" só nos dias de tiro.
6. **Cinta peitoral (opcional):** pareie pelas configurações do treino. Procure por sensor externo ou cinta de FC.
7. **Sincronização (opcional):** o Zepp conecta a Strava, Apple Saúde e Google (Health Connect), conforme a versão.

## Em cada sessão

1. Use o relógio **um a dois dedos acima do osso do pulso**, firme. Durante o treino aperte um furo a mais que o normal.
2. Use o treino **Esteira** para tudo, inclusive a caminhada inclinada, para manter o histórico num lugar só. A distância que ele marca não importa.
3. Espere a FC aparecer antes de iniciar. Não julgue a zona nos primeiros 3 a 5 minutos.
4. Comece a esteira a 0–1% e só depois suba a inclinação.
5. **Não segure no corrimão**: isso derruba a FC, falseia a cadência e reduz o esforço real.
6. Ao terminar, se o relógio oferecer **calibrar a distância**, informe a distância do painel da esteira.
7. Anote no registro o que o relógio não sabe: **velocidade, inclinação, estrutura dos intervalos e esforço percebido (0–10)**.

## Telas úteis durante o treino

Nas configurações do treino Esteira, edite as páginas de dados e deixe numa tela:

- FC atual
- Zona de FC atual
- Tempo decorrido
- FC média (útil no T7)

## Depois da sessão: o que anotar

No resumo do treino no Zepp, copie para [registros/modelo-registro.csv](../registros/modelo-registro.csv):

| Coluna | De onde vem |
|---|---|
| `fc_media`, `fc_max` | Resumo do treino |
| `min_z1` … `min_z5` | Gráfico de zonas de FC |
| `kcal_relogio`, `cadencia_spm` | Resumo do treino |
| `carga_treino` | Resumo do treino (carga ou efeito do treino) |
| `pai` | Tela PAI do dia |
| `velocidade_kmh`, `inclinacao_pct` | Painel da esteira (no bloco principal) |
| `rpe_0a10` | Sua percepção de esforço |

## Exportar os dados brutos

Para ter o histórico completo (FC minuto a minuto, sono, passos), o Zepp gera um arquivo de exportação. Procure **"Exportar dados"** nas configurações da conta no app. Outro caminho é exportar cada treino pelo Strava (`.fit`/`.gpx`). Esses arquivos podem ser lidos por uma futura versão da calculadora.

## Indicadores de progresso

- **VO2máx estimado maior** e **FC final menor** no teste T7, na mesma velocidade. É o indicador principal.
- **VO2máx do relógio**, se você também correr ao ar livre. Compare a tendência com a do T7.
- **FC de repouso** estável ou caindo ao longo de semanas. Uma alta de 5 bpm ou mais por vários dias seguidos sugere cansaço acumulado ou doença.
- **Tempo de recuperação** que o relógio sugere depois dos treinos fortes. Se ele não zerar até o próximo T4, troque o treino por um T1 leve.
- **Recuperação da FC:** quanto ela cai 1 minuto depois de parar o esforço. Uma queda maior com o tempo indica melhor condicionamento.
- **PAI:** manter acima de 100 na semana.

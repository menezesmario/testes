# 02 · Usando o Amazfit GTR

> Os nomes dos menus mudam entre modelos (GTR, GTR 2/2e, GTR 3/3 Pro, GTR 4, GTR Mini) e versões do app Zepp. Se algo não estiver onde está descrito, procure pelo nome da função.

## O que o relógio mede bem e mal na esteira

| Dado | Confiável? | Observação |
|---|---|---|
| Frequência cardíaca | ✅ boa em ritmo constante | Pior em tiros curtos e com o braço apoiado no corrimão |
| Tempo em cada zona | ✅ | É o dado principal do guia |
| Duração | ✅ | |
| Cadência (passos/min) | ✅ | Vem do acelerômetro |
| Calorias | ⚠️ estimativa | Útil para comparar sessões entre si |
| Distância e ritmo | ❌ | Sem GPS, o relógio estima pelo movimento do braço. **Use o painel da esteira** |
| Inclinação | ❌ não mede | **Anote manualmente** |
| VO2máx | ❌ na esteira | Os modelos que estimam VO2máx usam corridas ao ar livre com GPS. Na esteira, use o teste T7 |

Resumo: **a esteira informa a carga (velocidade, inclinação e, em muitos painéis, METs); o relógio informa a resposta do corpo (FC)**. O guia cruza as duas coisas.

## Configuração inicial (uma vez)

1. **Perfil no Zepp:** data de nascimento, peso, altura e sexo corretos. Calorias e zonas dependem disso.
2. **Monitoramento contínuo de FC** ligado, de preferência com intervalo de 1 minuto ou "inteligente". Isso alimenta a FC de repouso e o PAI.
3. **Zonas de FC:** se o seu modelo permite informar a FC máxima (ou escolher reserva de FC), use os valores de [01 · Zonas](01-zonas-de-frequencia-cardiaca.md). Se não permite, o relógio usa a idade, e as zonas ficam próximas das calculadas por % da FC máxima.
4. **Alerta de FC no treino:** nas configurações do modo Esteira, ative o alerta com o **limite superior da sua Z2**. Ele vibra quando você sair da base aeróbica nos treinos leves.
5. **Sincronização (opcional):** o Zepp conecta a Strava, Apple Saúde e Google (Health Connect / Fit), conforme a versão. Isso facilita gráficos e o histórico.

## Em cada sessão

1. Use o relógio **um a dois dedos acima do osso do pulso**, firme. Durante o treino aperte um furo a mais que o normal.
2. Abra o treino **Esteira** (ou "Corrida interna" / "Indoor run"). Espere a FC aparecer antes de iniciar.
3. Comece a esteira a 0–1% e só depois suba a inclinação.
4. **Não segure no corrimão**: isso derruba a FC, falseia a cadência e reduz o esforço real.
5. Ao terminar, se o relógio oferecer **calibrar a distância**, informe a distância mostrada na esteira. As próximas estimativas melhoram.
6. Anote no registro o que o relógio não sabe: **velocidade, inclinação, estrutura dos intervalos e esforço percebido (0–10)**.

## Telas úteis durante o treino

Se o modelo permite personalizar os campos do treino, deixe numa tela:

- FC atual
- Zona de FC atual
- Tempo decorrido
- FC média (bom para o teste de referência)

## Depois da sessão: o que anotar

No resumo do treino no Zepp, copie para [registros/modelo-registro.csv](../registros/modelo-registro.csv):

| Coluna | De onde vem |
|---|---|
| `fc_media`, `fc_max` | Resumo do treino |
| `min_z1` … `min_z5` | Gráfico de zonas de FC |
| `kcal_relogio`, `cadencia_spm` | Resumo do treino |
| `pai` | Tela PAI do dia |
| `velocidade_kmh`, `inclinacao_pct` | Painel da esteira (no bloco principal) |
| `rpe_0a10` | Sua percepção de esforço |

## Exportar os dados brutos

Para ter o histórico completo (FC minuto a minuto, sono, passos), o Zepp gera um arquivo de exportação. Procure **"Exportar dados"** nas configurações da conta no app. Outro caminho é exportar cada treino pelo Strava (`.fit`/`.gpx`). Esses arquivos podem ser lidos por uma futura versão da calculadora.

## Indicadores de progresso

- **VO2máx estimado maior** e **FC final menor** no teste T7, na mesma velocidade. É o indicador principal.
- **FC de repouso** estável ou caindo ao longo de semanas. Uma alta de 5 bpm ou mais por vários dias seguidos sugere cansaço acumulado ou doença.
- **Recuperação da FC:** quanto ela cai 1 minuto depois de parar o esforço. Uma queda maior com o tempo indica melhor condicionamento.
- **PAI:** manter acima de 100 na semana é a meta do próprio Zepp.

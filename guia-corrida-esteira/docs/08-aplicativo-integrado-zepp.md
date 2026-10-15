# 08 · Aplicativo integrado ao Zepp (proposta)

**Resumo:** é possível, mas não como uma tela nova dentro do app Zepp. O que a Zepp permite oficialmente é criar **mini apps para o relógio** (Zepp OS). Eles usam o app Zepp do celular como ponte para a internet. Não existe API oficial para outro app ler o histórico de treinos do Zepp.

Pesquisa feita em outubro de 2026, com base na documentação oficial do Zepp OS ([repositório zeppos-docs](https://github.com/zepp-health/zeppos-docs)).

## O que o GTR 4 permite

Segundo a [lista oficial de dispositivos](https://github.com/zepp-health/zeppos-docs/blob/main/docs/reference/related-resources/device-list.mdx), o GTR 4 está no **API_LEVEL 3.6 (Zepp OS 3.5)**.

| Capacidade | API do Zepp OS | No GTR 4 |
|---|---|---|
| Mini app no relógio, em JavaScript | Device App | ✅ |
| FC ao vivo | `HeartRate.onCurrentChange` (2.1) | ✅ |
| FC de repouso | `HeartRate.getResting` (3.0) | ✅ |
| VO2máx, carga de treino e tempo de recuperação calculados pelo relógio | `Workout.getStatus` (3.0) | ✅ |
| Continuar gravando com a tela apagada | App Service em execução contínua (3.0) | ✅ |
| Manter a tela acesa durante o treino | `setPageBrightTime` (2.0) | ✅ |
| Vibrar nas trocas de intervalo | `Vibrator` | ✅ |
| Conectar a aparelhos Bluetooth (sensores, esteira) | BLE central, `mstStartScan`/`mstConnect` (3.0) | ✅ se a esteira tiver Bluetooth |
| Enviar e receber dados da internet | Side Service com `fetch`, rodando dentro do app Zepp no celular | ✅ |
| Tela de configuração dentro do app Zepp | Settings App: texto, botões, campos, seletores, imagens. **Sem gráficos** | ✅ limitado |
| Instalar sem publicar na loja | Modo desenvolvedor do app Zepp + `zeus preview` (QR code) | ✅ |
| Plugin dentro do treino **Esteira** nativo | [Workout Extension](https://github.com/zepp-health/zeppos-docs/blob/main/docs/guides/workout-extension/intro.mdx) (3.6) | ❌ GTR 4 fora da lista oficial (só Cheetah, T-Rex 3, T-Rex Ultra e Falcon) |
| Ler as zonas de FC configuradas no Zepp | `Workout.getUserHrZoneSettings` (4.2) | ❌ exige API 4.2 |

O Workout Extension seria o encaixe perfeito: ele aceita o treino Esteira e lê velocidade, distância e cadência do treino nativo. A Zepp, porém, não o libera para o GTR 4.

## O que não dá, ou só por caminhos não oficiais

- **Ler o histórico do Zepp por API:** não existe API pública. Há três caminhos:
  - **Strava:** o Zepp sincroniza os treinos, e a API do Strava é oficial e entrega a série de FC de cada treino ([limites](https://developers.strava.com/docs/rate-limits/)).
  - **Health Connect (Android):** o Zepp só escreve, mas outros apps podem ler.
  - **Exportação pela página de GDPR do Zepp:** há ferramentas não oficiais, como o [Mi Fit and Zepp workout exporter](https://github.com/rolandsz/Mi-Fit-and-Zepp-workout-exporter). Evitar como base do app, porque quebram sem aviso.
- **Criar telas ou gráficos novos dentro do app Zepp:** só os componentes simples do Settings App.
- **Gravar a sessão do nosso app no histórico nativo do Zepp:** não há API para isso. É preciso testar se o treino Esteira nativo continua rodando em segundo plano com o mini app aberto. Se continuar, ficamos com os dois registros.

## Arquitetura proposta

```
┌─────────────────────┐   Bluetooth   ┌──────────────────────┐   HTTPS   ┌──────────────┐
│ GTR 4               │ ────────────▶ │ Side Service         │ ───────▶ │ Banco de     │
│ mini app "Esteira"  │ ◀──────────── │ (dentro do app Zepp) │ ◀─────── │ dados        │
└─────────────────────┘ plano do dia  └──────────────────────┘          └──────┬───────┘
                                                                               │
                                                        ┌──────────────────────▼───────┐
                                                        │ Web app no celular/PC (PWA)  │
                                                        │ painel, plano, gráficos      │
                                                        └──────────────────────────────┘
```

1. **Relógio (durante o treino):**
   - Plano do dia (T1 a T7) com a faixa de % do VO2máx.
   - FC ao vivo, e velocidade e inclinação informadas com toques (+/−).
   - METs e % do VO2máx calculados na hora, comparados com a faixa, com aviso por vibração para subir ou baixar a inclinação.
   - Cronômetro do T4.
   - T7 guiado, que calcula o VO2máx no próprio pulso.
   - Gravação a cada 5 s e envio ao terminar.
2. **Side Service:** envia as sessões para o banco e baixa o plano e o perfil.
3. **Banco:** [Supabase](https://supabase.com) (Postgres gratuito, com login) ou uma Planilha Google com Apps Script (mais simples, e você vê os dados na planilha).
4. **Web app (antes e depois do treino):**
   - Perfil, prescrição, plano e cola.
   - Histórico e gráficos: FC ao longo do tempo com velocidade e inclinação, tempo dentro da faixa, evolução do VO2máx nos T7 e FC por MET (eficiência).
   - Exportação em CSV.
   - Usa a mesma conta da [calculadora](../src/calculadora.js).

**Alternativa só com o celular, sem mini app:** o GTR 4 tem o **Heart Rate Push** (Zepp OS 3.5), que faz o relógio funcionar como uma cinta de FC Bluetooth padrão. Um web app pode ler essa FC ao vivo via Web Bluetooth, mas **só no Chrome para Android**. O Safari do iPhone não tem Web Bluetooth.

## Roteiro

| Fase | Entrega | O que exige de você |
|---|---|---|
| 1 · MVP | Web app: sessão ao vivo no celular (velocidade, inclinação, cronômetro, METs, % do VO2máx, cola dinâmica), registro e gráficos. FC digitada ou via Heart Rate Push (Android) | Só o celular |
| 2 · Relógio | Mini app no GTR 4 com FC ao vivo, alvos, vibração, gravação e sincronização com o web app | Computador com Node.js, [Zeus CLI](https://github.com/zepp-health/zeppos-docs/blob/main/docs/guides/quick-start/environment.mdx) e conta gratuita de desenvolvedor Zepp |
| 3 · Extras | Importar do Strava o treino nativo; ler velocidade e inclinação da esteira, se a XT025 tiver Bluetooth (FTMS); Workout Extension, se a Zepp liberar para o GTR 4 | — |

### Como instalar o mini app sem a loja (fase 2)

1. No computador: `npm i -g @zeppos/zeus-cli`, depois `zeus login` e `zeus preview`, que gera um QR code.
2. No app Zepp: **Perfil › Configurações › Sobre** e toque **7 vezes** no ícone do Zepp para ligar o modo desenvolvedor ([documentação](https://github.com/zepp-health/zeppos-docs/blob/main/docs/guides/tools/zepp-app.mdx)).
3. No modo desenvolvedor, use **Escanear** no QR code. O app vai para o relógio.

O modo desenvolvedor também mostra os logs do relógio, o que ajuda a corrigir erros.

## Riscos

- **Teste só no relógio real:** o código do mini app pode ser escrito em qualquer lugar, mas o simulador e o `zeus preview` precisam rodar no seu computador. Cada ajuste passa por você.
- **FC óptica:** atrasa no começo do treino e nos tiros curtos. Uma cinta peitoral resolve.
- **Bateria:** tela acesa por 45 minutos consome mais.
- **Mudanças da Zepp:** o roteiro usa só APIs oficiais e documentadas.

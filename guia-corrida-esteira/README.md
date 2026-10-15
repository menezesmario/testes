# Guia de Treino em Esteira

Guia pessoal de corrida e caminhada inclinada, feito primeiro para a esteira.

- **Esteira:** NewFitness Xtreme XT025 da academia, inclinação de 0% a 20%. O painel não mostra METs
- **Relógio:** Amazfit GTR 4 (FC, zonas, alertas, treino intervalado, carga de treino, PAI), via app Zepp
- **Método:** prescrição por % do VO2máx em METs, como nos [vídeos de referência](referencias.md), com a FC do relógio para monitorar

> **A carga (velocidade + inclinação) vira METs pela calculadora (prescrição). O relógio dá a FC nessa carga (monitoramento).**

## Como começar

1. **Leia [06 · Segurança](docs/06-seguranca.md)** antes da primeira sessão.
2. **Configure o GTR 4:** perfil, zonas, alerta de zona e treino Esteira, conforme [02 · Amazfit GTR 4](docs/02-amazfit-gtr.md).
3. **Confira a inclinação da XT025:** veja se o painel mostra % ou níveis, com o celular ([03](docs/03-inclinacao-e-velocidade.md#antes-de-tudo-o-número-do-painel-é--ou-nível)).
4. **Faça o teste T7 (Ebbeling):** 8 minutos de caminhada que estimam o seu VO2máx. Está na [biblioteca](docs/04-biblioteca-de-treinos.md#t7--teste-de-referência-ebbeling-a-cada-4-semanas).
5. **Use o [app](#app)** na academia, ou gere a sua cola no terminal:
   ```bash
   node src/cli.js cola --vel 5 --fc 128 --idade 38 --sexo m
   ```
   A tabela diz qual inclinação usar, em cada velocidade, para 50–70% do VO2máx (contínuo) e para 85% ou mais (intervalado).
6. **Siga o [plano de 8 semanas](docs/05-plano-8-semanas.md)** e anote cada sessão em [registros/](registros/).

## App

O app **Esteira** guia o treino no celular, apoiado no console da esteira. Ele está publicado em <https://claude.ai/artifact/M6CBWDq1pR1T284cQZMH1R>; o link é privado e só abre com a sua conta.

- **Hoje:** o treino do dia no plano de 8 semanas, com o perfil de degraus, a faixa e a inclinação sugerida. "Começar" abre a sessão ao vivo.
- **Sessão ao vivo:** velocidade e inclinação com botões grandes, % do VO2máx e METs na hora contra a faixa, sugestão de inclinação (um toque aplica), FC digitada ou por Bluetooth, bipes na troca de fase e tela sempre acesa. O T7 é guiado e calcula o VO2máx no fim.
- **Painel:** evolução do VO2máx, minutos na faixa por semana, eficiência (batimentos por MET) e o histórico de sessões.
- **Cola:** inclinação por velocidade e % do VO2máx.
- **Perfil:** seus dados, zonas de FC, exportação em CSV (mesmas colunas de `registros/modelo-registro.csv`) e backup em JSON.

Enquanto o Perfil não é preenchido, o app mostra dados de exemplo, sempre marcados como exemplo. Comece pelo Perfil e faça o T7.

### Onde ficam os dados

- **No claude.ai:** na sua conta, visíveis só para você, inclusive se o link for compartilhado.
- **Fora do claude.ai** (GitHub Pages ou servidor local): só no navegador daquele aparelho. Para levar os dados de um lugar ao outro, use "Exportar backup" e "Importar backup" no Perfil.

### FC por Bluetooth (Android)

O navegador bloqueia o Bluetooth dentro do claude.ai; lá, a FC é digitada. Para ler a FC ao vivo do GTR 4:

1. Abra <https://github.com/menezesmario/testes/settings/pages>. Em **Source**, escolha **Deploy from a branch**; em **Branch**, escolha `claude/fervent-brahmagupta-13f9fj` e a pasta `/ (root)`; toque em **Save**.
2. Espere 1 a 2 minutos, até a página de configuração mostrar "Your site is live". Depois abra no **Chrome do Android** o endereço `https://menezesmario.github.io/testes/` (ele leva direto ao app).
3. No GTR 4, abra **Heart Rate Push** (Zepp OS 3.5) antes de começar.
4. Na sessão ao vivo, toque no ícone de Bluetooth da linha de FC e escolha o relógio.

### Rodar localmente

```bash
python3 -m http.server 8000   # nesta pasta; depois abra http://localhost:8000
```

## Conteúdo

| Arquivo | O que tem |
|---|---|
| [docs/01-zonas-de-frequencia-cardiaca.md](docs/01-zonas-de-frequencia-cardiaca.md) | FC máxima, FC de repouso, zonas de 1 a 5, sensação de esforço |
| [docs/02-amazfit-gtr.md](docs/02-amazfit-gtr.md) | GTR 4: configuração, alertas, intervalado, quais dados confiar, exportação |
| [docs/03-inclinacao-e-velocidade.md](docs/03-inclinacao-e-velocidade.md) | XT025: conferir % × nível; quanto custa cada % de inclinação |
| [docs/04-biblioteca-de-treinos.md](docs/04-biblioteca-de-treinos.md) | 7 treinos-modelo (T1 a T7), incluindo o teste T7 |
| [docs/05-plano-8-semanas.md](docs/05-plano-8-semanas.md) | Base (semanas 1–4) e construção (semanas 5–8) |
| [docs/06-seguranca.md](docs/06-seguranca.md) | Cuidados com inclinação alta, sinais de alerta |
| [docs/07-prescricao-pelo-vo2max.md](docs/07-prescricao-pelo-vo2max.md) | O método dos vídeos, passo a passo, e a ligação com a FC |
| [docs/08-aplicativo-integrado-zepp.md](docs/08-aplicativo-integrado-zepp.md) | Proposta de app: o que o Zepp permite, arquitetura e roteiro |
| [referencias.md](referencias.md) | Resumo dos vídeos, onde batem e onde divergem do guia, bibliografia |
| [registros/modelo-registro.csv](registros/modelo-registro.csv) | Planilha para anotar as sessões |
| [index.html](index.html) e [app/](app/) | O app (JavaScript puro, sem dependências) |
| [src/](src/) | Lógica compartilhada pelo app e pelo terminal: calculadora, plano e fases dos treinos, resumo de sessão |

## Calculadora

Precisa só de Node.js 18 ou mais recente. Não há nada para instalar.

```bash
node src/cli.js cola       --vel 5 --fc 128 --idade 38 --sexo m   # tabela de bolso para a academia
node src/cli.js ebbeling   --vel 5 --fc 128 --idade 38 --sexo m   # VO2máx pelo T7 + faixas detalhadas
node src/cli.js prescricao --mets 10 [--vel 5]                    # VO2máx conhecido (cola aceita o mesmo)
node src/cli.js zonas      --idade 38 --repouso 58                # zonas de FC
node src/cli.js esforco    --vel 4.8 --inc 12 --peso 80 --min 30  # METs, kcal, equivalente
node src/cli.js tabela     --vel 5 --modo caminhada               # 0% a 20%
npm test
```

## Próximos passos

- [ ] Preencher o Perfil no app
- [ ] Conferir se a inclinação da XT025 está em % ou em níveis
- [ ] Ajustar zonas e alerta de zona no GTR 4
- [ ] Fazer o primeiro T7 no app
- [ ] Revisar o plano depois do reteste da semana 4

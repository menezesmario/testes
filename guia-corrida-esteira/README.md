# Guia de Treino em Esteira

Guia pessoal de corrida e caminhada inclinada, feito primeiro para a esteira.

- **Esteira:** academia, inclinação de 0% a 20%
- **Relógio:** Amazfit GTR (FC, tempo em zonas, calorias, PAI), via app Zepp
- **Método:** prescrição por % do VO2máx em METs, como nos [vídeos de referência](referencias.md), com a FC do relógio para monitorar

> **A esteira dá a carga em METs (prescrição). O relógio dá a FC nessa carga (monitoramento).**

## Como começar

1. **Leia [06 · Segurança](docs/06-seguranca.md)** antes da primeira sessão.
2. **Configure o relógio:** perfil, alerta de FC e modo Esteira, conforme [02 · Amazfit GTR](docs/02-amazfit-gtr.md).
3. **Faça o teste T7 (Ebbeling):** 8 minutos de caminhada que estimam o seu VO2máx. Está na [biblioteca](docs/04-biblioteca-de-treinos.md#t7--teste-de-referência-ebbeling-a-cada-4-semanas).
4. **Gere a sua prescrição:**
   ```bash
   node src/cli.js ebbeling --vel 5 --fc 128 --idade 38 --sexo m
   ```
   A saída diz qual inclinação usar para 50–70% do VO2máx (contínuo) e para mais de 85% (intervalado).
5. **Siga o [plano de 8 semanas](docs/05-plano-8-semanas.md)** e anote cada sessão em [registros/](registros/).

## Conteúdo

| Arquivo | O que tem |
|---|---|
| [docs/01-zonas-de-frequencia-cardiaca.md](docs/01-zonas-de-frequencia-cardiaca.md) | FC máxima, FC de repouso, zonas de 1 a 5, sensação de esforço |
| [docs/02-amazfit-gtr.md](docs/02-amazfit-gtr.md) | Configuração, modo esteira, quais dados confiar, exportação |
| [docs/03-inclinacao-e-velocidade.md](docs/03-inclinacao-e-velocidade.md) | Quanto custa cada % de inclinação; tabelas de equivalência |
| [docs/04-biblioteca-de-treinos.md](docs/04-biblioteca-de-treinos.md) | 7 treinos-modelo (T1 a T7), incluindo o teste T7 |
| [docs/05-plano-8-semanas.md](docs/05-plano-8-semanas.md) | Base (semanas 1–4) e construção (semanas 5–8) |
| [docs/06-seguranca.md](docs/06-seguranca.md) | Cuidados com inclinação alta, sinais de alerta |
| [docs/07-prescricao-pelo-vo2max.md](docs/07-prescricao-pelo-vo2max.md) | O método dos vídeos, passo a passo, e a ligação com a FC |
| [referencias.md](referencias.md) | Resumo dos vídeos, onde batem e onde divergem do guia, bibliografia |
| [registros/modelo-registro.csv](registros/modelo-registro.csv) | Planilha para anotar as sessões |
| [src/](src/) | Calculadora (Node.js, sem dependências) |

## Calculadora

Precisa só de Node.js 18 ou mais recente. Não há nada para instalar.

```bash
node src/cli.js ebbeling   --vel 5 --fc 128 --idade 38 --sexo m   # VO2máx pelo T7 + prescrição
node src/cli.js prescricao --mets 10 [--vel 5]                    # VO2máx conhecido
node src/cli.js zonas      --idade 38 --repouso 58                # zonas de FC
node src/cli.js esforco    --vel 4.8 --inc 12 --peso 80 --min 30  # METs, kcal, equivalente
node src/cli.js tabela     --vel 5 --modo caminhada               # 0% a 20%
npm test
```

## Próximos passos

- [ ] Fazer o primeiro T7 e registrar o VO2máx estimado
- [ ] Conferir se o painel da esteira da academia mostra METs e se bate com a calculadora
- [ ] Revisar o plano depois do reteste da semana 4

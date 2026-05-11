# Regras de pontuação — Bolão Copa 2026

> Os valores reais ficam em [`src/app/core/config/scoring.config.ts`](src/app/core/config/scoring.config.ts).
> Edite aquele arquivo para mudar os pontos sem precisar tocar no resto do código.

## Fase de grupos

| Acerto                                          | Pontos |
| ----------------------------------------------- | ------ |
| Placar exato (cravada)                          | **10** |
| Vencedor + diferença de gols (ex.: 2x1 / 3x2)   | **7**  |
| Apenas o vencedor                               | **5**  |
| Empate correto (qualquer placar de empate)      | **5**  |
| Acertou o número de gols de **um** dos times    | **2**  |

## Mata-mata (16-avos, oitavas, quartas, semis, 3º lugar, final)

| Acerto                                       | Pontos |
| -------------------------------------------- | ------ |
| Placar exato (cravada)                       | **15** |
| Apenas o vencedor                            | **8**  |
| Acertou os gols de **um** dos times          | **3**  |

> No mata-mata não existe "empate" no resultado final do confronto (decisão por
> pênaltis avança o time, mas o cálculo considera o resultado dentro do tempo
> normal/prorrogação registrado pela ESPN).

## Bônus do chaveamento (campeão / vice / 3º / 4º)

Travado quando começa o **primeiro jogo do mata-mata**.

| Acerto                          | Pontos |
| ------------------------------- | ------ |
| Cravar o **campeão**            | **30** |
| Cravar o **vice-campeão**       | **15** |
| Cravar o **3º lugar**           | **10** |
| Cravar o **4º lugar**           | **10** |

## Travamento dos palpites

- **Fase de grupos**: palpites travam quando começa o **primeiro jogo da fase de grupos**.
- **Cada fase do mata-mata**: palpites daquela fase específica travam quando começa o **primeiro jogo da etapa**.
- **Bônus do chaveamento**: trava quando começa o primeiro jogo do mata-mata.

## Desempate no ranking

1. Pontuação total
2. Cravadas (placar exato)
3. Acertos de vencedor

## Privacidade dos palpites

Palpite de cada usuário é **privado** até o jogo começar. Após o início do
jogo, todos os participantes podem ver os palpites uns dos outros.

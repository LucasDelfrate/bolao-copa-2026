export const SCORING = {
  groupStage: {
    correctWinner: 3,
    correctWinnerAndOneScore: 4,
    exactScore: 7,
    correctDraw: 3,
    exactDraw: 7,
    wrongWinner: -2,
  },

  groupAdvancement: {
    correctQualifier: 2,
    correctQualifierWithPosition: 3, // 2 + 1 bônus de posição
  },

  knockout: {
    correctWinner: 3,
    correctWinnerAndOneScore: 4,
    exactScore: 7,
    correctDraw: 3,
    exactDraw: 7,
    wrongWinner: 0,
    correctQualifier: 1, // acertou quem avançou (inclui penaltis)
  },

  semifinals: {
    inPodium: 5,       // acertou o time entre os 4 finalistas
    exactPosition: 5,  // bônus por acertar a posição exata (cumulativo)
  },

  preCopaChampion: 20,
} as const;

export type ScoringConfig = typeof SCORING;

export interface ScoringRule {
  label: string;
  description: string;
  points: number;
  type: 'positive' | 'negative' | 'neutral';
}

export interface ScoringSection {
  title: string;
  icon: string;
  rules: ScoringRule[];
}

export const SCORING_RULES: ScoringSection[] = [
  {
    title: 'Fase de Grupos — Resultado do jogo',
    icon: '⚽',
    rules: [
      {
        label: 'Cravou o placar',
        description: 'Acertou exatamente o placar do jogo (ex: apostou 2×1 e deu 2×1)',
        points: SCORING.groupStage.exactScore,
        type: 'positive',
      },
      {
        label: 'Acertou o ganhador + um dos placares',
        description: 'Acertou quem ganhou e um dos placares (ex: apostou 2×1 e deu 3×1 — acertou o "1")',
        points: SCORING.groupStage.correctWinnerAndOneScore,
        type: 'positive',
      },
      {
        label: 'Acertou só o ganhador',
        description: 'Acertou quem ganhou, mas errou os dois placares',
        points: SCORING.groupStage.correctWinner,
        type: 'positive',
      },
      {
        label: 'Cravou o empate',
        description: 'Apostou empate com placar exato (ex: 1×1 e deu 1×1)',
        points: SCORING.groupStage.exactDraw,
        type: 'positive',
      },
      {
        label: 'Acertou o empate',
        description: 'Acertou que seria empate, mas errou o placar',
        points: SCORING.groupStage.correctDraw,
        type: 'positive',
      },
      {
        label: 'Errou o ganhador',
        description: 'Apostou no time errado — time A ganharia mas o B venceu',
        points: SCORING.groupStage.wrongWinner,
        type: 'negative',
      },
    ],
  },
  {
    title: 'Fase de Grupos — Classificação',
    icon: '📊',
    rules: [
      {
        label: 'Acertou um classificado (sem posição)',
        description: 'O time que você previu entre os 2 primeiros do grupo realmente avançou, mas na posição errada',
        points: SCORING.groupAdvancement.correctQualifier,
        type: 'positive',
      },
      {
        label: 'Acertou um classificado na posição certa',
        description: 'Previu corretamente o 1º ou 2º colocado do grupo na posição exata',
        points: SCORING.groupAdvancement.correctQualifierWithPosition,
        type: 'positive',
      },
    ],
  },
  {
    title: 'Mata-mata — Resultado do jogo',
    icon: '🏟️',
    rules: [
      {
        label: 'Cravou o placar',
        description: 'Acertou exatamente o placar do jogo no tempo regulamentar',
        points: SCORING.knockout.exactScore,
        type: 'positive',
      },
      {
        label: 'Acertou o ganhador + um dos placares',
        description: 'Acertou quem avançou e um dos placares',
        points: SCORING.knockout.correctWinnerAndOneScore,
        type: 'positive',
      },
      {
        label: 'Acertou só o ganhador',
        description: 'Acertou quem avançou, mas errou os dois placares',
        points: SCORING.knockout.correctWinner,
        type: 'positive',
      },
      {
        label: 'Cravou o empate',
        description: 'Apostou empate com placar exato no tempo regulamentar',
        points: SCORING.knockout.exactDraw,
        type: 'positive',
      },
      {
        label: 'Acertou o empate',
        description: 'Acertou que seria empate no regulamentar, mas errou o placar',
        points: SCORING.knockout.correctDraw,
        type: 'positive',
      },
      {
        label: 'Acertou quem avançou (pênaltis/prorrogação)',
        description: 'Em caso de empate no placar, você indicou o time correto que avançaria nos pênaltis',
        points: SCORING.knockout.correctQualifier,
        type: 'positive',
      },
    ],
  },
  {
    title: 'Semifinalistas — Previsão antes do mata-mata',
    icon: '🎯',
    rules: [
      {
        label: 'Time acertado no pódio (posição errada)',
        description: 'O time que você previu está entre os 4 semifinalistas, mas não na posição que você indicou',
        points: SCORING.semifinals.inPodium,
        type: 'positive',
      },
      {
        label: 'Time acertado na posição exata',
        description: 'Acertou o time E a posição (campeão, vice, 3º ou 4º) — recebe os dois bônus somados',
        points: SCORING.semifinals.inPodium + SCORING.semifinals.exactPosition,
        type: 'positive',
      },
    ],
  },
  {
    title: 'Palpite do Campeão — Antes da Copa',
    icon: '🏆',
    rules: [
      {
        label: 'Acertou o campeão',
        description: 'Previu antes do início da Copa qual seleção seria a campeã',
        points: SCORING.preCopaChampion,
        type: 'positive',
      },
    ],
  },
];

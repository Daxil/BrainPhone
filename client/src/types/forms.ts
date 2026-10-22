export interface AudioRecording {
  id: string;
  type: string;
  label: string;
  url?: string;
  blob?: Blob;
  duration?: number;
  minDuration?: number;
  maxDuration?: number;
  status: 'pending' | 'recording' | 'completed' | 'warning';
  recordedAt?: string;
}

export interface MDSUPDRSPart1 {
  cognitiveImpairment: number;
  hallucinations: number;
  depression: number;
  anxiety: number;
  apathy: number;
  dopamineDysregulation: number;
  sleepProblems: number;
  pain: number;
  urinaryProblems: number;
  constipation: number;
  lightheadedness: number;
  fatigue: number;
}

export interface MDSUPDRSPart2 {
  speech: number;
  salivation: number;
  swallowing: number;
  eating: number;
  dressing: number;
  hygiene: number;
  handwriting: number;
  doingHobbies: number;
  turningInBed: number;
  tremor: number;
  gettingOutOfBed: number;
  walking: number;
  freezing: number;
}

export interface MDSUPDRSPart3 {
  speech: number;
  facialExpression: number;
  rigidityNeck: number;
  rigidityRightArm: number;
  rigidityLeftArm: number;
  rigidityRightLeg: number;
  rigidityLeftLeg: number;
  fingerTappingRight: number;
  fingerTappingLeft: number;
  handMovementsRight: number;
  handMovementsLeft: number;
  pronationSupinationRight: number;
  pronationSupinationLeft: number;
  toeTappingRight: number;
  toeTappingLeft: number;
  legAgilityRight: number;
  legAgilityLeft: number;
  arisingFromChair: number;
  gait: number;
  freezingGait: number;
  posturalStability: number;
  posturalTremorRightHand: number;
  posturalTremorLeftHand: number;
  kineticTremorRightHand: number;
  kineticTremorLeftHand: number;
  restTremorRightHand: number;
  restTremorLeftHand: number;
  restTremorLips: number;
  constancyRestTremor: number;
}

export interface MDSUPDRSPart4 {
  timeDyskinesias: number;
  functionalImpactDyskinesias: number;
  painfulDyskinesias: number;
  timeOff: number;
  functionalImpactOff: number;
  complexityMedication: number;
}

export interface MDSUPDRSForm {
  part1: MDSUPDRSPart1;
  part2: MDSUPDRSPart2;
  part3: MDSUPDRSPart3;
  part4: MDSUPDRSPart4;
  totalScore: number;
  date: string;
  examiner: string;
}

export interface MoCATest {
  visuospatialExecutive: {
    cube: boolean;
    clockContour: boolean;
    clockNumbers: boolean;
    clockHands: boolean;
    namingLion: boolean;
    namingRhino: boolean;
    namingCamel: boolean;
  };
  attention: {
    digitSpanForward: number;
    digitSpanBackward: number;
    tappingLetters: number;
    serialSubtraction: number;
  };
  language: {
    sentenceRepetition: boolean;
    verbalFluency: number;
  };
  abstraction: {
    similarityTrainBicycle: boolean;
    similarityWatchClock: boolean;
  };
  memory: {
    wordListTrial1: number;
    wordListTrial2: number;
    wordListRecall: number;
    wordListRecognition: number;
  };
  orientation: {
    date: boolean;
    month: boolean;
    year: boolean;
    day: boolean;
    place: boolean;
    city: boolean;
  };
  totalScore: number;
  educationAdjustment: boolean;
  finalScore: number;
  date: string;
  examiner: string;
}

export interface PatientAssessment {
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  mdsUpdrs?: MDSUPDRSForm;
  moca?: MoCATest;
  createdAt: string;
  updatedAt: string;
}

// Когнитивная анкета (как в brainphone-pro): приём, информант, GPCOG.
export const GPCOG_QUESTIONS: { id: string; text: string }[] = [
  { id: 'q1', text: 'Этому пациенту сейчас труднее, чем раньше, вспоминать то, что произошло недавно?' },
  { id: 'q2', text: 'Ему (ей) труднее вспоминать разговор несколько дней спустя?' },
  { id: 'q3', text: 'В разговоре труднее подыскивать правильные слова, чаще использует неуместные слова?' },
  { id: 'q4', text: 'Уменьшилась ли способность решать денежные и финансовые вопросы?' },
  { id: 'q5', text: 'Уменьшилась ли способность независимо управляться с лекарствами?' },
  { id: 'q6', text: 'Требуется ли дополнительная помощь с транспортом?' },
];

export type GpcogAnswer = 'yes' | 'no' | 'unknown' | 'notApplicable';

export const GPCOG_ANSWER_LABELS: Record<GpcogAnswer, string> = {
  yes: 'Да',
  no: 'Нет',
  unknown: 'Не знаю',
  notApplicable: 'Неприменимо',
};

/** «Да» — информант заметил ухудшение — 0 баллов, любой другой ответ — 1. */
export const gpcogAnswerScore = (a: GpcogAnswer): number => (a === 'yes' ? 0 : 1);

export const INTAKE_CHECKS: { id: string; text: string }[] = [
  { id: 'hearing', text: 'Пациент слышит и понимает инструкцию и способен выполнить задание' },
  { id: 'vision', text: 'Пациент видит изображение и способен различать его основные элементы (возможно использование средств коррекции зрения)' },
  { id: 'noDelirium', text: 'Отсутствуют остро возникшее спутанное состояние, делирий, интоксикация, абстинентное состояние или выраженная седация' },
  { id: 'noAcuteCondition', text: 'Отсутствует острое состояние, влияющее на внимание, сознание или речь: ОНМК, недавняя тяжёлая ЧМТ, постприступное состояние, выраженная боль, лихорадка' },
];

export interface CognitiveIntake {
  educationYears: string;
  primaryLanguage: 'ru' | 'other';
  russianSufficient: boolean | null;
  checks: Record<string, boolean>;
  informant: {
    name: string;
    relation: string;
    contactFrequency: string;
    knownFor: string;
    canCompare: boolean | null;
  };
  gpcogSkipped: boolean;
  gpcog: Record<string, GpcogAnswer>;
}

export const EMPTY_COGNITIVE_INTAKE: CognitiveIntake = {
  educationYears: '',
  primaryLanguage: 'ru',
  russianSufficient: null,
  checks: {},
  informant: { name: '', relation: '', contactFrequency: '', knownFor: '', canCompare: null },
  gpcogSkipped: false,
  gpcog: {},
};

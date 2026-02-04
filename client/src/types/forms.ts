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

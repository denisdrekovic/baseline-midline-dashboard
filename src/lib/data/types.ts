export type ProjectGroup = "T-1" | "T-2" | "Control";

export interface Farmer {
  id: number;
  district: string;
  block: string;
  village: string;
  name: string;
  age: number;
  caste: string;
  gender: string;
  lat: number | null;
  lon: number | null;
  totalFamilyMembers: number;
  totalAcre: number;
  farmSizeCategory: string;
  segment: string; // legacy — no longer used for segmentation
  project: ProjectGroup;
  // Financial
  totalIncomeUsd: number | null;
  totalExpensesUsd: number | null;
  totalNetIncomeUsd: number | null;
  netIncomeDaily: number | null;
  netIncomeDailyIndividual: number | null;
  offFarmDependency: number | null;
  // Per-crop net income
  mintNetIncome: number | null;
  riceNetIncome: number | null;
  potatoNetIncome: number | null;
  mustardNetIncome: number | null;
  wheatNetIncome: number | null;
  // Other income
  otherCropsNetIncome: number | null;
  offFarmNetIncome: number | null;
  livestockIncome: number | null;
  livestockExpenses: number | null;
  offFarmIncome: number | null;
  offFarmExpenses: number | null;
  fixedCostAllCrops: number | null;
  // Indices
  resourcesIndex: number;
  productivityIndex: number;
  womenEmpowerment: number;
  // Quality & participation
  qualityOfLife: string;
  targetCropBenefit: string;
  fpcMember: string;
  accessSafetyNet: number;
  useFinancialServices: number;
  womenIncomeContributor: string;
  practiceAdoptRateMint: number | null;
  aboveLIB: string | number;
  incomeCategory: string;
  ownership: number;
  irrigationSession: string;
  timeChange: string;
  trainingParticipation: string;
  practiceAdoption: string;
  // Women empowerment survey
  womenQ1: string;
  womenQ2: string;
  womenQ3: string;
  womenQ4: string;
  womenQ5: string;
  womenQ6: string;
  womenQ7: string;
  womenQ8: string;
  womenHoursHousehold: string;
  womenHoursLivestock: string;
  womenHoursIncomeGenerating: string;
  womenActivityParticipation: string[];
  womenInfoOnTraining: string;
  womenInterestedStartBusiness: string;
  womenStartBusiness: string;
  womenRateKnowledge: string;
  womenIncomeAmountUsd: number;
  womenEnterpriseInterested: string[];
  // Sustainability
  soilCarbon: number | null;
  transportation: number | null;
  electricity: number | null;
  pesticide: number | null;
  miscActivities: number | null;
  carbonFromTrees: number | null;
  carbonFromHousehold: number | null;
}

export interface CropRecord {
  id: number;
  yield: number;
  acre: number;
  income: number;
  expenses: number;
  netIncome: number;
  crop: string;
}

export interface ProjectGroupStat {
  group: ProjectGroup;
  count: number;
  avgIncome: number;
  avgResources: number;
  avgProductivity: number;
  avgEmpowerment: number;
}

export interface CropStat {
  crop: string;
  totalFarmers: number;
  avgYield: number;
  avgIncome: number;
  avgExpenses: number;
  avgNetIncome: number;
  avgAcre: number;
  medianNetIncome: number;
}

export interface Aggregates {
  totalFarmers: number;
  totalDistricts: number;
  totalBlocks: number;
  totalVillages: number;
  avgIncome: number;
  medianIncome: number;
  avgProductivity: number;
  avgWomenEmpowerment: number;
  districts: string[];
  blocks: string[];
  projectGroups: ProjectGroupStat[];
  crops: CropStat[];
  genders: string[];
  castes: string[];
  farmSizes: string[];
  projects: string[];
  villages: string[];
}

export interface FilterState {
  districts: string[];
  blocks: string[];
  villages: string[];
  projectGroups: string[];
  genders: string[];
  castes: string[];
  farmSizes: string[];
  projects: string[];
}

export interface Insight {
  type: "anomaly" | "trend" | "comparison" | "highlight";
  icon: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "success";
}

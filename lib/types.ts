export type RatingCategory =
  | "context"
  | "data"
  | "expectedResult"
  | "successCriteria"
  | "constraints"
  | "users"
  | "businessContact";

export interface TaskCard {
  title: string;
  context: string;
  need: string;
  users: string;
  data: string;
  constraints: string;
  expectedResult: string;
  successCriteria: string;
  contact: string;
  format: string;
}

export type ReadinessLevel = "черновик" | "рабочая" | "готовая" | "приоритетная";

export interface Task {
  id: string;
  draftText: string;
  card: TaskCard;
  rating: number;
  readiness: ReadinessLevel;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  interests: string;
  skills: string;
  tech: string;
}

export type ResponseStatus = "pending" | "accepted" | "declined";

export interface TeamResponse {
  id: string;
  taskId: string;
  teamId: string;
  idea: string;
  plan: string;
  deadline: string;
  link: string;
  status: ResponseStatus;
}

export type VideoStatus =
  | "UPLOADING"
  | "QUEUED"
  | "PROCESSING"
  | "TRANSCRIBING"
  | "CORRECTING"
  | "BURNING"
  | "UPLOADING_OUTPUTS"
  | "READY"
  | "EXPORTED"
  | "ERROR";

export type PaymentType = "SUBSCRIPTION" | "AVULSO";

export type PaymentMethod = "CARD" | "PIX" | "BOLETO";

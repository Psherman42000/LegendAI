export type VideoStatus =
  | "UPLOADING"
  | "QUEUED"
  | "PROCESSING"
  | "TRANSCRIBING"
  | "CORRECTING"
  | "READY"
  | "ERROR"
  | "EXPORTED";

export type PaymentType = "SUBSCRIPTION" | "AVULSO";

export type PaymentMethod = "CARD" | "PIX" | "BOLETO";

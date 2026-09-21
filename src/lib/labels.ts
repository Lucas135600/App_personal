import type { CheckinStatus, Modality, StudentStatus } from "./types";

/* Os valores gravados no banco continuam sem acento (são identificadores).
   Tudo que o usuário lê passa por estes mapas. */

export const MODALITY_LABEL: Record<Modality, string> = {
  presencial: "Presencial",
  online: "Online",
  hibrido: "Híbrido",
};

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

export const CHECKIN_STATUS_LABEL: Record<CheckinStatus, string> = {
  pendente: "Pendente",
  respondido: "Respondido",
  atrasado: "Atrasado",
};

/** Escala de 1 a 5 usada nas respostas do check-in. */
export const SCALE_LABEL = ["", "muito ruim", "ruim", "regular", "bom", "ótimo"];

/** Primeira letra maiúscula, sem mexer no resto (evita "86.7 Kg"). */
export function capitalizeFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

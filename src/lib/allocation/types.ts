export type AllocationPreviewReservation = {
  memberId: string;
  memberName: string;
  quantity: number;
};

export type AllocationPreviewResource = {
  resourceId: string;
  resourceName: string;
  type: "FEATHER" | "CARD";
  total: number;
  reserved: number;
  available: number;
  reservations: AllocationPreviewReservation[];
};

export type AllocationPreview = {
  guildId: string;
  guildName: string;
  resources: AllocationPreviewResource[];
};
export interface CreateShopInput {
  shopCode: unknown;
  shopName: unknown;
  location: unknown;
  contact: unknown;
  isActive?: unknown;
  acceptingOrders?: unknown;
}

export interface UpdateShopInput {
  shopName?: unknown;
  location?: unknown;
  contact?: unknown;
  isActive?: unknown;
  acceptingOrders?: unknown;
}

// Every PrintShop field is already non-sensitive (no financial/staff data
// on this model), so this is a pass-through shape rather than a stripped-
// down one - kept as an explicit type/mapper anyway for consistency with
// the rest of the codebase's toSafeX() convention.
export interface SafeShop {
  shopId: string;
  shopCode: string;
  shopName: string;
  location: string;
  contact: string;
  isActive: boolean;
  acceptingOrders: boolean;
  createdAt: Date;
  updatedAt: Date;
}

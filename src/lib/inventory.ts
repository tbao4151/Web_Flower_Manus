export type AvailabilityStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
export type SaleMode = "ready_stock" | "preorder";

export function availabilityStatusFromQuantity(quantity: number, lowStockThreshold = 2): AvailabilityStatus {
  if (quantity <= 0) return "OUT_OF_STOCK";
  return quantity <= Math.max(1, lowStockThreshold) ? "LOW_STOCK" : "IN_STOCK";
}

export function formatPreorderLeadTime(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `ít nhất ${days} ngày`;
  }
  return `ít nhất ${hours} giờ`;
}

export function preorderLeadTimeMessage(hours: number, productName?: string): string {
  const prefix = productName ? `Mẫu ${productName}` : "Mẫu hoa này";
  return `${prefix} cần được đặt trước ${formatPreorderLeadTime(hours)}.`;
}

/**
 * Convert the shop's Vietnam-local delivery date/time into an absolute Date.
 * For a delivery window, the start is used for the conservative preorder check.
 */
export function receiveDateTimeFromDelivery(deliveryDate: string, normalizedDeliveryTime: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deliveryDate);
  const timeMatch = /^(\d{2}):(\d{2})/.exec(normalizedDeliveryTime);
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const utcMilliseconds = Date.UTC(year, month - 1, day, hour - 7, minute);
  const result = new Date(utcMilliseconds);
  return Number.isNaN(result.getTime()) ? null : result;
}

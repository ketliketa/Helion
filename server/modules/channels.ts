/** Internal contract. Real platform adapters must be implemented and certified separately. */
export type Availability = {
  roomId: string;
  date: string;
  available: number;
  price: number;
  currency: string;
};
export type IncomingReservation = {
  externalId: string;
  roomId: string;
  arrival: string;
  departure: string;
  guest: string;
  adults: number;
};
export interface ChannelAdapter {
  readonly mode: "simulation" | "live";
  pushAvailability(
    rows: Availability[],
    idempotencyKey: string,
  ): Promise<{ reference: string; accepted: number }>;
  pushRates(
    rows: Availability[],
    idempotencyKey: string,
  ): Promise<{ reference: string; accepted: number }>;
  normalizeReservation(payload: unknown): IncomingReservation;
}
export class SimulatorAdapter implements ChannelAdapter {
  readonly mode = "simulation" as const;
  async pushAvailability(rows: Availability[], key: string) {
    if (rows.some((r) => r.available < 0 || r.available > 1 || r.price <= 0))
      throw new Error("INVALID_INVENTORY");
    return { reference: "SIM-" + key, accepted: rows.length };
  }
  async pushRates(rows: Availability[], key: string) {
    return this.pushAvailability(rows, key);
  }
  normalizeReservation(payload: unknown): IncomingReservation {
    const p = payload as IncomingReservation;
    if (
      !p ||
      typeof p.externalId !== "string" ||
      typeof p.roomId !== "string" ||
      typeof p.guest !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(p.arrival) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(p.departure) ||
      p.departure <= p.arrival ||
      !Number.isInteger(p.adults) ||
      p.adults < 1
    )
      throw new Error("INVALID_CHANNEL_PAYLOAD");
    return p;
  }
}
export const retryDelay = (attempt: number) =>
  Math.min(3600000, 1000 * 2 ** Math.min(Math.max(attempt, 0), 12));

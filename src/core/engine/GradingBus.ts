export type BusListener = (key: string, value: any) => void;

class GradingBus {
  private listeners = new Set<BusListener>();
  private values: Record<string, any> = {};

  subscribe(listener: BusListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  set(key: string, value: any) {
    this.values[key] = value;
    this.listeners.forEach(l => l(key, value));
  }

  get(key: string) {
    return this.values[key];
  }

  clear() {
    this.values = {};
  }
}

export const gradingBus = new GradingBus();

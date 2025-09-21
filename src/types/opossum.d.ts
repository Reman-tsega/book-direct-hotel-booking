declare module 'opossum' {
  class CircuitBreaker<T extends any[], R> {
    constructor(fn: (...args: T) => Promise<R>, options?: any);
    fire(...args: T): Promise<R>;
    fallback(fn: (...args: T) => R | Promise<R>): void;
    on(event: string, listener: (...args: any[]) => void): void;
  }

  export = CircuitBreaker;
}
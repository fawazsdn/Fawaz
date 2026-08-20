/**
 * Small helper shared by every mock service implementation. Real network
 * calls have latency and can fail; simulating a short delay keeps loading
 * skeletons and pull-to-refresh states meaningfully visible in the demo.
 * When a real backend replaces these services, this file (and the artificial
 * delay) simply goes away — callers only depend on the returned Promises.
 */
export function mockDelay<T>(value: T, ms = 420): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

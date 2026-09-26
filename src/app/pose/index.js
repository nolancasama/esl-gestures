import { PoseDetector } from './pose-detector.js';
import { SimulatedDetector } from './simulated-detector.js';

export { PoseDetector, SimulatedDetector };

export function simulationOptions(search = globalThis.location?.search ?? '') {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(search);
  return {
    simulate: params.get('simulate') === '1',
    simulateFail: params.get('simulateFail')
  };
}

/** Create a camera or synthetic detector from explicit/query-string options. */
export function createDetector(options = {}) {
  const query = simulationOptions(options.search);
  const simulate = options.simulate ?? query.simulate;
  const detectorOptions = { ...options };
  delete detectorOptions.search;
  delete detectorOptions.simulate;

  if (simulate) {
    detectorOptions.simulateFail ??= query.simulateFail;
    return new SimulatedDetector(detectorOptions);
  }
  delete detectorOptions.simulateFail;
  return new PoseDetector(detectorOptions);
}

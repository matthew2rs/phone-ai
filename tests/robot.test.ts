import { describe, expect, it } from 'vitest';
import { loadScenarios, runScenario } from '../robot/runner.js';

describe('robot scenarios (offline)', () => {
  const scenarios = loadScenarios();
  it('there are scenarios', () => expect(scenarios.length).toBeGreaterThanOrEqual(10));
  for (const s of scenarios) {
    it(s.name, async () => {
      const r = await runScenario(s);
      expect(r.failures).toEqual([]);
    });
  }
});

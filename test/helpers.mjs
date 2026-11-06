import { Engine } from '../src/engine.js';
import { Scheduler } from '../src/scheduler.js';
import { SimulationAdapter, sampleItems } from '../src/adapters/simulation.js';
export const item = (changes = {}) => ({ ...sampleItems()[1], ...changes });
export function setup(items = [item()], overrides = {}) {
  let clock = 1700000000000;
  const now = () => clock;
  const sleeper = async (ms, signal) => { if (signal?.aborted) throw Object.assign(new Error('Stopped'), { code: 'STOPPED' }); clock += ms; };
  const adapter = new SimulationAdapter(items);
  const scheduler = new Scheduler({ now, sleeper });
  const engine = new Engine({ adapter, scheduler, now, sleeper, ...overrides });
  return { adapter, scheduler, engine, now, advance: ms => { clock += ms; } };
}
export async function run(engine, options = {}, settings = {}) {
  await engine.scan(options);
  const info = engine.confirmationFor(options);
  return engine.execute(options, { confirmed: true, phrase: info.phrase, ...settings });
}

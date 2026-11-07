import { fail } from '../errors.js';
import { eligibility } from '../filters.js';
// Synthetic fixtures only. This adapter never sends network requests.
export class SimulationAdapter {
  simulation = true;
  label = 'Simulation · synthetic data only';
  identity = { id: 't2_demo', name: 'demo_user' };
  constructor(items = sampleItems()) { this.items = structuredClone(items); }
  async account() { return { ...this.identity }; }
  async page({ after }) {
    const offset = after ? Number(after) : 0;
    return { items: structuredClone(this.items.slice(offset, offset + 25)), after: offset + 25 < this.items.length ? String(offset + 25) : null };
  }
  async get(id) { return structuredClone(this.items.find(item => item.id === id)); }
  guard(id, expected, mode) {
    const item = this.items.find(item => item.id === id);
    if (!expected || expected.id !== this.identity.id || expected.name !== this.identity.name) fail('ACCOUNT_CHANGED', 'Account changed.');
    if (!item || eligibility(item, expected, mode)) fail('OWNERSHIP', 'Ownership or capability changed.');
    return item;
  }
  async edit(id, text, expected) {
    const item = this.guard(id, expected, 'anonymize');
    item.text = text;
    item.edited = true;
    return { acknowledged: true };
  }
  async delete(id, expected, verifiedReplacement) {
    const item = this.guard(id, expected, 'delete');
    if (verifiedReplacement !== undefined && item.text !== verifiedReplacement) fail('EDIT_CHANGED', 'Replacement changed before deletion.');
    item.deleted = true;
    item.text = '';
    return { acknowledged: true };
  }
}
export function sampleItems() {
  return Array.from({ length: 12 }, (_, i) => ({
    id: `${i % 3 ? 't1' : 't3'}_demo${i}`, authorId: 't2_demo', author: 'demo_user',
    subreddit: ['privacy', 'technology', 'casualconversation'][i % 3],
    type: i % 3 ? 'comment' : 'post', created: Date.UTC(2025, i, 5, 12), score: i * 3 - 5,
    edited: i % 2 === 0, deletable: true, editable: i !== 6, deleted: false,
    text: [
      'I used to share too much about my daily routine. Time for a fresh start.',
      'Small privacy habits make a difference. This is a synthetic example comment.',
      'An old conversation, a new perspective. No real Reddit content is loaded.'
    ][i % 3], permalink: ''
  }));
}

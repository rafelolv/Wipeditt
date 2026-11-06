import { fail } from '../errors.js';
export class BlockedAdapter {
  simulation = false;
  label = 'Live Reddit integration unavailable';
  async account() {
    fail('LIVE_UNAVAILABLE', 'Reddit approval and a verified public-client OAuth integration are required. This build cannot read or modify your Reddit account.');
  }
  async page() { return this.account(); }
  async get() { return this.account(); }
  async edit() { return this.account(); }
  async delete() { return this.account(); }
}

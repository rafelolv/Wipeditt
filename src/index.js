import { mount } from './ui/panel.js';
// A shared DOM claim protects isolated extension worlds and userscript reinjection.
const ID = 'wipeditt-runtime-v1';
if (window.top === window.self && !document.getElementById(ID)) {
  const host = document.createElement('div');
  host.id = ID;
  host.style.cssText = 'position:fixed;z-index:2147483646;inset:0;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  container.style.pointerEvents = 'auto';
  shadow.append(container);
  document.documentElement.append(host);
  mount(container, __VERSION__);
}

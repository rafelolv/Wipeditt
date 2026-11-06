export class AppError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    Object.assign(this, details);
  }
}
export function checkAbort(signal) {
  if (signal?.aborted) throw new AppError('STOPPED', 'Stopped. Submitted requests may still finish.');
}
export function sleep(ms, signal) {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const finish = () => { signal?.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(finish, ms);
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new AppError('STOPPED', 'Stopped.'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}
export const fail = (code, message) => { throw new AppError(code, message); };

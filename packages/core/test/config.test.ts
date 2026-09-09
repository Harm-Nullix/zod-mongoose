import {describe, expect, mock, test} from 'bun:test';
import {setFrontendMode} from '../src/config.js';

describe('setFrontendMode', () => {
  test('warns that the legacy manual mode is deprecated', () => {
    const warn = mock(() => undefined);
    // eslint-disable-next-line no-console
    const originalWarn = console.warn;
    // eslint-disable-next-line no-console
    console.warn = warn;

    // Keep the shared test process in backend mode for conversion tests that follow.
    setFrontendMode(false);

    // eslint-disable-next-line no-console
    console.warn = originalWarn;
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
  });
});

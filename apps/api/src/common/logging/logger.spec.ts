import pino from 'pino';
import { Writable } from 'node:stream';
import { redactPaths } from './logger';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return {
    logger: pino({ redact: { paths: redactPaths(), censor: '[redacted]' } }, stream),
    lines,
  };
}

describe('log redaction', () => {
  it('removes phones, codes and tokens at any common depth', () => {
    const { logger, lines } = capture();
    logger.info({
      phone: '+919876543210',
      body: { code: '123456', nested: { refreshToken: 'rt', visitCode: '1234' } },
      req: { headers: { authorization: 'Bearer abc', cookie: 'doqto_at=x' } },
      safe: 'kept',
    });
    const out = lines.join('');
    expect(out).not.toContain('+919876543210');
    expect(out).not.toContain('123456');
    expect(out).not.toContain('Bearer abc');
    expect(out).not.toContain('doqto_at=x');
    expect(out).not.toContain('"rt"');
    expect(out).toContain('kept');
  });
});

import { EMPTY_SHA256, presignUrl, signRequestHeaders, uriEncode } from './sigv4';

// Test vectors from the AWS S3 SigV4 documentation (examplebucket, 2013-05-24).
const creds = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
};
const date = new Date('2013-05-24T00:00:00Z');

describe('SigV4', () => {
  it('matches the AWS presigned URL example', () => {
    const url = new URL(
      presignUrl(
        creds,
        { host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', expiresSeconds: 86400 },
        date,
      ),
    );
    expect(url.searchParams.get('X-Amz-Signature')).toBe(
      'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
    expect(url.searchParams.get('X-Amz-Credential')).toBe(
      'AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request',
    );
  });

  it('matches the AWS GET object (header auth) example', () => {
    const headers = signRequestHeaders(
      creds,
      {
        method: 'GET',
        host: 'examplebucket.s3.amazonaws.com',
        path: '/test.txt',
        headers: { range: 'bytes=0-9' },
        payloadHash: EMPTY_SHA256,
      },
      date,
    );
    expect(headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, ' +
        'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, ' +
        'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });

  it('encodes per RFC 3986', () => {
    expect(uriEncode('a b/c~d*', true)).toBe('a%20b/c~d%2A');
    expect(uriEncode('a/b')).toBe('a%2Fb');
  });
});

import { reportRangeError } from './report-range';

describe('report date validation', (): void => {
  it('accepts 366 days inclusive and rejects 367', (): void => {
    expect(reportRangeError('2024-01-01', '2024-12-31')).toBeNull();
    expect(reportRangeError('2024-01-01', '2025-01-01')).not.toBeNull();
  });
  it('rejects reversed, malformed and impossible dates', (): void => {
    expect(reportRangeError('2024-12-31', '2024-01-01')).not.toBeNull();
    expect(reportRangeError('invalid', '2024-01-01')).not.toBeNull();
    expect(reportRangeError('2024-02-30', '2024-03-01')).not.toBeNull();
  });
  it('allows backend default dates when omitted', (): void => {
    expect(reportRangeError()).toBeNull();
  });
});

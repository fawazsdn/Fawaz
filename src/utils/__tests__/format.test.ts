import { displayName, formatDistance, formatSAR } from '@/utils/format';

describe('formatSAR', () => {
  it('formats a price in Arabic', () => {
    expect(formatSAR(250, 'ar')).toContain('ر.س');
  });

  it('formats a price in English', () => {
    expect(formatSAR(250, 'en')).toBe('SAR 250');
  });
});

describe('formatDistance', () => {
  it('formats sub-kilometer distances in meters', () => {
    expect(formatDistance(600, 'en')).toBe('600 m');
  });

  it('formats larger distances in kilometers', () => {
    expect(formatDistance(1500, 'en')).toBe('1.5 km');
  });
});

describe('displayName', () => {
  const base = { firstName: 'فواز', lastName: 'السعدون' };

  it('shows the full name when privacy is full', () => {
    expect(displayName({ ...base, namePrivacy: 'full' })).toBe('فواز السعدون');
  });

  it('shows first name + last initial', () => {
    expect(displayName({ ...base, namePrivacy: 'first_last_initial' })).toBe('فواز ا.');
  });

  it('shows only the first name when requested', () => {
    expect(displayName({ ...base, namePrivacy: 'first_only' })).toBe('فواز');
  });
});

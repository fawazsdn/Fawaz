import { buildInviteMessage } from '../inviteMessage';

// Locks in the exact approved WhatsApp/share copy — any accidental
// rewording here is a regression against explicitly-specified brand copy.
describe('buildInviteMessage', () => {
  it('builds the exact approved Arabic copy', () => {
    const message = buildInviteMessage({
      neighborhoodName: 'العقربية',
      link: 'haratna://join/n1/ABC123',
      locale: 'ar',
    });
    expect(message).toBe(
      'انضم إلى حارتنا 🏡\n\n' +
        'مجتمع حي العقربية صار على حارتنا.\n\n' +
        'تعرف على جيرانك، شارك فعاليات الحي، اكتشف الأماكن القريبة وساعد مجتمعك.\n\n' +
        'انضم من هنا:\n' +
        'haratna://join/n1/ABC123',
    );
  });

  it('builds the exact approved English copy', () => {
    const message = buildInviteMessage({
      neighborhoodName: 'Al Aqrabiyah',
      link: 'haratna://join/n1/ABC123',
      locale: 'en',
    });
    expect(message).toBe(
      'Join our neighborhood on Haratna 🏡\n\n' +
        'Al Aqrabiyah is now on Haratna.\n\n' +
        "Meet your neighbors, discover what's happening nearby, join local events and help build our community.\n\n" +
        'Join here:\n' +
        'haratna://join/n1/ABC123',
    );
  });

  it('substitutes a different neighborhood name and link without altering the surrounding copy', () => {
    const message = buildInviteMessage({ neighborhoodName: 'حي النزهة', link: 'https://haratna.app/join/n9/XYZ', locale: 'ar' });
    expect(message).toContain('مجتمع حي حي النزهة صار على حارتنا.');
    expect(message).toContain('https://haratna.app/join/n9/XYZ');
  });
});

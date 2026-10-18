import { auditActorName } from './audit-actor-name';

describe('Audit actor name', () => {
  const user = { id: 27, name: 'Current name', email: 'operator@example.test' };

  it('preserves the name recorded when the action occurred', () => {
    expect(auditActorName({ metadata: { actorName: 'Original name' }, user })).toBe('Original name');
  });

  it('uses the related user for older records without a snapshot', () => {
    expect(auditActorName({ metadata: null, user })).toBe('Current name');
  });

  it('does not label an unknown author as an automatic system action', () => {
    expect(auditActorName({ metadata: null, user: null })).toBe('Sin identificar');
  });

  it('ignores invalid or empty snapshots', () => {
    expect(auditActorName({ metadata: { actorName: {} }, user })).toBe('Current name');
    expect(auditActorName({ metadata: { actorName: ' ' }, user })).toBe('Current name');
  });
});

import 'package:flutter_test/flutter_test.dart';
import 'package:riftbound_mobile/models/rift_models.dart';

void main() {
  test('Guardian model maps role and server progress safely', () {
    const role = GuardianRole(
      id: 'vanguard',
      name: 'Vanguard',
      icon: '🔥',
      archetype: 'Frontline · Bruiser',
      color: '#ff6b55',
      skill: 'Comet Break',
      lore: 'Keeper of the Khar beacon.',
    );
    final guardian = Guardian.fromJson(
      {
        'id': 'guardian-1',
        'name': 'Ash',
        'role': 'vanguard',
        'level': 4,
        'xp': 21,
        'gold': 70,
        'hp': 95,
        'maxHp': 110,
        'wins': 5,
        'card': {'publicToken': 'a' * 32},
      },
      [role],
    );
    expect(guardian.name, 'Ash');
    expect(guardian.role.name, 'Vanguard');
    expect(guardian.level, 4);
    expect(guardian.cardToken, 'a' * 32);
  });

  test('Card state uses the same token for pending and claimed routes', () {
    final pending = CardState.fromJson('token-one', {
      'state': 'unclaimed',
      'message': 'Register this card',
    });
    final claimed = CardState.fromJson('token-one', {
      'state': 'claimed',
      'message': 'Card linked',
    });
    expect(pending.token, claimed.token);
    expect(pending.state, 'unclaimed');
    expect(claimed.state, 'claimed');
  });
}

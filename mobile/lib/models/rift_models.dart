class RiftUser {
  const RiftUser({required this.id, required this.username});
  final String id;
  final String username;
  factory RiftUser.fromJson(Map<String, dynamic> json) =>
      RiftUser(id: json['id'] as String, username: json['username'] as String);
}

class GuardianRole {
  const GuardianRole({
    required this.id,
    required this.name,
    required this.icon,
    required this.archetype,
    required this.color,
    required this.skill,
    required this.lore,
  });
  final String id;
  final String name;
  final String icon;
  final String archetype;
  final String color;
  final String skill;
  final String lore;
  factory GuardianRole.fromJson(Map<String, dynamic> json) => GuardianRole(
    id: json['id'] as String,
    name:
        json['name'] as String? ??
        json['label'] as String? ??
        json['id'] as String,
    icon: json['icon'] as String? ?? '✦',
    archetype: json['archetype'] as String? ?? 'Guardian',
    color: json['color'] as String? ?? '#9b8cff',
    skill: json['skill'] as String? ?? 'Role skill',
    lore: json['lore'] as String? ?? '',
  );
}

class Guardian {
  const Guardian({
    required this.id,
    required this.name,
    required this.role,
    required this.level,
    required this.xp,
    required this.gold,
    required this.hp,
    required this.maxHp,
    required this.wins,
    this.cardToken,
  });
  final String id;
  final String name;
  final GuardianRole role;
  final int level;
  final int xp;
  final int gold;
  final int hp;
  final int maxHp;
  final int wins;
  final String? cardToken;
  factory Guardian.fromJson(
    Map<String, dynamic> json,
    List<GuardianRole> roles,
  ) {
    final roleId = json['role'] as String? ?? 'vanguard';
    final role = roles.firstWhere(
      (item) => item.id == roleId,
      orElse: () => roles.first,
    );
    final card = json['card'] as Map<String, dynamic>?;
    return Guardian(
      id: json['id'] as String,
      name: json['name'] as String,
      role: role,
      level: (json['level'] as num?)?.toInt() ?? 1,
      xp: (json['xp'] as num?)?.toInt() ?? 0,
      gold: (json['gold'] as num?)?.toInt() ?? 0,
      hp: (json['hp'] as num?)?.toInt() ?? 0,
      maxHp: (json['maxHp'] as num?)?.toInt() ?? 0,
      wins: (json['wins'] as num?)?.toInt() ?? 0,
      cardToken: card?['publicToken'] as String?,
    );
  }
}

class CardState {
  const CardState({required this.token, required this.state, this.message});
  final String token;
  final String state;
  final String? message;
  factory CardState.fromJson(String token, Map<String, dynamic> json) =>
      CardState(
        token: token,
        state: json['state'] as String,
        message: json['message'] as String?,
      );
}

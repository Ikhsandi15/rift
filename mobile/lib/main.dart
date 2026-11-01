import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'models/rift_models.dart';
import 'services/rift_api.dart';

final apiProvider = Provider<RiftApi>((ref) => RiftApi());

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final api = RiftApi();
  await api.hydrate();
  runApp(
    ProviderScope(
      overrides: [apiProvider.overrideWithValue(api)],
      child: const RiftboundApp(),
    ),
  );
}

class RiftboundApp extends StatelessWidget {
  const RiftboundApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Riftbound',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xff9b85ff),
        brightness: Brightness.dark,
      ),
      scaffoldBackgroundColor: const Color(0xff080d19),
      useMaterial3: true,
    ),
    home: const RiftHome(),
  );
}

class RiftHome extends ConsumerStatefulWidget {
  const RiftHome({super.key});
  @override
  ConsumerState<RiftHome> createState() => _RiftHomeState();
}

class _RiftHomeState extends ConsumerState<RiftHome> {
  StreamSubscription<Uri>? _linkSubscription;
  bool _loading = true;
  String? _error;
  String? _cardToken;
  RiftUser? _user;
  List<GuardianRole> _roles = [];
  List<Guardian> _guardians = [];

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final links = AppLinks();
    final initial = await links.getInitialLink();
    if (initial != null) _acceptUri(initial);
    _linkSubscription = links.uriLinkStream.listen(_acceptUri);
    await _load();
  }

  void _acceptUri(Uri uri) {
    if (uri.pathSegments.length >= 2 && uri.pathSegments.first == 'card') {
      setState(() => _cardToken = uri.pathSegments[1]);
      if (_user != null) _loadCard();
    }
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiProvider);
      _roles = await api.roles();
      final me = await api.me();
      if (me['user'] != null) {
        _user = RiftUser.fromJson(me['user'] as Map<String, dynamic>);
        final avatars = (me['data']['avatars'] as List<dynamic>? ?? []);
        _guardians = avatars
            .map(
              (item) => Guardian.fromJson(item as Map<String, dynamic>, _roles),
            )
            .toList();
      }
      if (_cardToken != null && _user != null) await _loadCard();
      if (mounted) {
        setState(() {
          _loading = false;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = error.toString();
        });
      }
    }
  }

  Future<void> _loadCard() async {
    if (_cardToken == null) return;
    try {
      final card = await ref.read(apiProvider).cardState(_cardToken!);
      if (card.state == 'unclaimed' &&
          _user != null &&
          _guardians.isNotEmpty &&
          mounted) {
        final guardianId = await showModalBottomSheet<String>(
          context: context,
          builder: (sheetContext) => SafeArea(
            child: ListView(
              shrinkWrap: true,
              children: [
                const ListTile(title: Text('Choose a Guardian for this card')),
                ..._guardians.map(
                  (guardian) => ListTile(
                    leading: Text(
                      guardian.role.icon,
                      style: const TextStyle(fontSize: 24),
                    ),
                    title: Text(guardian.name),
                    subtitle: Text(
                      '${guardian.role.name} · LV ${guardian.level}',
                    ),
                    onTap: () => Navigator.pop(sheetContext, guardian.id),
                  ),
                ),
              ],
            ),
          ),
        );
        if (guardianId != null) {
          await ref.read(apiProvider).claimCard(_cardToken!, guardianId);
          await _load();
        }
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  Future<void> _auth(String username, String password, bool register) async {
    try {
      final api = ref.read(apiProvider);
      _user = register
          ? await api.register(username, password)
          : await api.login(username, password);
      await _load();
      if (_cardToken != null) await _loadCard();
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  Future<void> _createGuardian(String name, String role) async {
    try {
      final api = ref.read(apiProvider);
      await api.createGuardian(name, role, _roles);
      await _load();
      if (_cardToken != null) await _loadCard();
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_user == null) {
      return AuthScreen(error: _error, onSubmit: _auth, onScan: _scanCard);
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('✦ RIFTBOUND'),
        actions: [
          IconButton(
            tooltip: 'Scan card QR',
            onPressed: _scanCard,
            icon: const Icon(Icons.qr_code_scanner),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _newGuardian(context),
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('Awaken Guardian'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Text(
              'THE WARDEN ARCHIVE',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: const Color(0xffa995ff),
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Welcome, ${_user!.username}.',
              style: Theme.of(
                context,
              ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            const Text('Pilih Guardian, lalu masuk ke petualangan Riftbound.'),
            if (_cardToken != null) _cardClaimPanel(),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  _error!,
                  style: const TextStyle(color: Colors.redAccent),
                ),
              ),
            const SizedBox(height: 22),
            ..._guardians.map(_guardianTile),
            if (_guardians.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(20),
                  child: Text(
                    'Belum ada Guardian. Bangkitkan Guardian pertamamu untuk memulai perjalanan.',
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _cardClaimPanel() => Card(
    color: const Color(0xff1b1731),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'PHYSICAL CARD',
            style: TextStyle(
              color: Color(0xffc3b4ff),
              fontWeight: FontWeight.bold,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _guardians.isEmpty
                ? 'Buat Guardian untuk menautkan kartu yang discan.'
                : 'Kartu siap ditautkan ke Guardian pertama.',
          ),
          if (_guardians.isNotEmpty)
            TextButton.icon(
              onPressed: _loadCard,
              icon: const Icon(Icons.link),
              label: const Text('Register card to first Guardian'),
            ),
        ],
      ),
    ),
  );

  Widget _guardianTile(Guardian guardian) => Card(
    margin: const EdgeInsets.only(bottom: 14),
    child: ListTile(
      isThreeLine: true,
      leading: CircleAvatar(
        backgroundColor: Color(
          int.tryParse(guardian.role.color.replaceFirst('#', '0xff')) ??
              0xff9b85ff,
        ),
        child: Text(guardian.role.icon, style: const TextStyle(fontSize: 22)),
      ),
      title: Text(
        guardian.name,
        style: const TextStyle(fontWeight: FontWeight.bold),
      ),
      subtitle: Text(
        '${guardian.role.name} · ${guardian.role.archetype}\nLV ${guardian.level}  •  ${guardian.xp} XP  •  ${guardian.gold} Gold',
      ),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => GuardianScreen(guardian: guardian),
        ),
      ),
    ),
  );

  Future<void> _scanCard() async {
    final token = await Navigator.of(
      context,
    ).push<String>(MaterialPageRoute(builder: (_) => const QrScanScreen()));
    if (token == null || !mounted) return;
    setState(() => _cardToken = token);
    await _loadCard();
  }

  Future<void> _newGuardian(BuildContext context) async {
    if (_roles.isEmpty) return;
    final name = TextEditingController();
    String role = _roles.first.id;
    final result = await showDialog<(String, String)>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => AlertDialog(
          title: const Text('Awaken a Guardian'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                maxLength: 24,
                decoration: const InputDecoration(labelText: 'Guardian name'),
              ),
              DropdownButtonFormField<String>(
                initialValue: role,
                items: _roles
                    .map(
                      (r) => DropdownMenuItem(
                        value: r.id,
                        child: Text('${r.icon} ${r.name}'),
                      ),
                    )
                    .toList(),
                onChanged: (value) => update(() => role = value ?? role),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, (name.text.trim(), role)),
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
    name.dispose();
    if (result != null && result.$1.length >= 2) {
      await _createGuardian(result.$1, result.$2);
    }
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({
    super.key,
    required this.error,
    required this.onSubmit,
    required this.onScan,
  });
  final String? error;
  final Future<void> Function(String, String, bool) onSubmit;
  final Future<void> Function() onScan;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _username = TextEditingController(),
      _password = TextEditingController();
  bool _register = false, _busy = false;
  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Card(
                color: const Color(0xff11192c),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Icon(
                        Icons.auto_awesome,
                        size: 44,
                        color: Color(0xffa995ff),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'RIFTBOUND',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(
                              fontWeight: FontWeight.w900,
                              letterSpacing: 3,
                            ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Close the Rift. Keep the story.',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      TextField(
                        controller: _username,
                        autocorrect: false,
                        decoration: const InputDecoration(
                          labelText: 'Username',
                          prefixIcon: Icon(Icons.person),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _password,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Password',
                          prefixIcon: Icon(Icons.lock),
                        ),
                      ),
                      if (widget.error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(
                            widget.error!,
                            style: const TextStyle(color: Colors.redAccent),
                          ),
                        ),
                      const SizedBox(height: 18),
                      FilledButton(
                        onPressed: _busy
                            ? null
                            : () async {
                                setState(() => _busy = true);
                                await widget.onSubmit(
                                  _username.text.trim(),
                                  _password.text,
                                  _register,
                                );
                                if (mounted) setState(() => _busy = false);
                              },
                        child: Text(
                          _busy
                              ? 'Please wait…'
                              : _register
                              ? 'Create account'
                              : 'Login',
                        ),
                      ),
                      TextButton(
                        onPressed: () => setState(() => _register = !_register),
                        child: Text(
                          _register
                              ? 'Already have an account? Login'
                              : 'New here? Create account',
                        ),
                      ),
                      OutlinedButton.icon(
                        onPressed: widget.onScan,
                        icon: const Icon(Icons.qr_code_scanner),
                        label: const Text('Scan physical Guardian card'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class QrScanScreen extends StatefulWidget {
  const QrScanScreen({super.key});
  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  bool done = false;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Scan Guardian card')),
    body: MobileScanner(
      onDetect: (capture) {
        if (done) return;
        for (final barcode in capture.barcodes) {
          final raw = barcode.rawValue;
          if (raw == null) continue;
          final uri = Uri.tryParse(raw);
          if (uri != null &&
              uri.pathSegments.length >= 2 &&
              uri.pathSegments.first == 'card') {
            done = true;
            Navigator.pop(context, uri.pathSegments[1]);
            return;
          }
        }
      },
    ),
  );
}

class GuardianScreen extends StatelessWidget {
  const GuardianScreen({super.key, required this.guardian});
  final Guardian guardian;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(guardian.name)),
    body: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CircleAvatar(
            radius: 44,
            backgroundColor: const Color(0xff27203d),
            child: Text(
              guardian.role.icon,
              style: const TextStyle(fontSize: 40),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            guardian.role.name,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          Text(guardian.role.archetype, textAlign: TextAlign.center),
          const SizedBox(height: 20),
          Text(guardian.role.lore),
          const SizedBox(height: 20),
          Text('Level ${guardian.level} · ${guardian.xp} XP'),
          Text(
            'HP ${guardian.hp}/${guardian.maxHp} · ${guardian.gold} Gold · ${guardian.wins} Rift wins',
          ),
          const Spacer(),
          FilledButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute<void>(
                builder: (_) => WorldPrototypeScreen(guardian: guardian),
              ),
            ),
            icon: const Icon(Icons.explore),
            label: const Text('Enter the Rift'),
          ),
        ],
      ),
    ),
  );
}

class WorldPrototypeScreen extends StatelessWidget {
  const WorldPrototypeScreen({super.key, required this.guardian});
  final Guardian guardian;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Camp Khar · World prototype')),
    body: Stack(
      children: [
        Center(
          child: CustomPaint(
            size: Size.infinite,
            painter: _WorldPainter(guardian.role.icon),
          ),
        ),
        Positioned(
          left: 20,
          bottom: 28,
          child: Container(
            width: 124,
            height: 124,
            decoration: BoxDecoration(
              color: Colors.white10,
              borderRadius: BorderRadius.circular(70),
            ),
            child: const Icon(Icons.gamepad, size: 76, color: Colors.white54),
          ),
        ),
        Positioned(
          right: 22,
          bottom: 30,
          child: Column(
            children: [
              FloatingActionButton.small(
                heroTag: 'attack',
                onPressed: () {},
                child: const Icon(Icons.flash_on),
              ),
              const SizedBox(height: 10),
              FloatingActionButton.small(
                heroTag: 'skill',
                onPressed: () {},
                child: const Icon(Icons.auto_awesome),
              ),
            ],
          ),
        ),
        const Positioned(
          left: 16,
          top: 16,
          child: Chip(label: Text('SAFE ZONE · CAMP KHAR')),
        ),
        const Center(
          child: Text(
            'Flutter / Flame overworld milestone\nMovement & combat wiring next',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70),
          ),
        ),
      ],
    ),
  );
}

class _WorldPainter extends CustomPainter {
  _WorldPainter(this.hero);
  final String hero;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = const Color(0xff1b312e);
    canvas.drawRect(Offset.zero & size, p);
    p.color = const Color(0xff34443b);
    for (var x = 0; x < size.width; x += 48) {
      for (var y = 0; y < size.height; y += 48) {
        canvas.drawRect(Rect.fromLTWH(x + 1, y + 1, 46, 46), p);
      }
    }
    p.color = const Color(0xff526348);
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(size.width / 2, size.height / 2),
        width: 130,
        height: 72,
      ),
      p,
    );
    p.color = const Color(0xffe7a75b);
    canvas.drawCircle(Offset(size.width / 2, size.height / 2), 20, p);
    final tp = TextPainter(
      text: TextSpan(text: hero, style: const TextStyle(fontSize: 28)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(size.width / 2 - 14, size.height / 2 - 55));
  }

  @override
  bool shouldRepaint(covariant _WorldPainter oldDelegate) =>
      oldDelegate.hero != hero;
}

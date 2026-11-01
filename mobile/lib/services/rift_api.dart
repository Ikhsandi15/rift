import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/rift_models.dart';

class RiftApi {
  RiftApi({String? baseUrl})
    : _dio = Dio(
        BaseOptions(
          baseUrl:
              baseUrl ??
              const String.fromEnvironment(
                'RIFT_API_BASE_URL',
                defaultValue: 'https://rift.pascadigital.my.id',
              ),
          headers: {'Content-Type': 'application/json'},
        ),
      );
  final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  String? _accessToken;

  Future<void> hydrate() async =>
      _accessToken = await _storage.read(key: 'rift_access_token');
  Future<void> clearTokens() async {
    _accessToken = null;
    await _storage.delete(key: 'rift_access_token');
    await _storage.delete(key: 'rift_refresh_token');
  }

  Future<Map<String, dynamic>> _json(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    bool retry = true,
  }) async {
    try {
      final headers = <String, dynamic>{};
      if (_accessToken != null) {
        headers['Authorization'] = 'Bearer $_accessToken';
      }
      final response = await _dio.request<Map<String, dynamic>>(
        path,
        options: Options(method: method, headers: headers),
        data: data,
      );
      return response.data ?? <String, dynamic>{};
    } on DioException catch (error) {
      if (retry && error.response?.statusCode == 401) {
        final refreshed = await refresh();
        if (refreshed) {
          return _json(path, method: method, data: data, retry: false);
        }
      }
      throw RiftApiException(
        error.response?.data is Map
            ? ((error.response?.data as Map)['error'] ?? error.message)
                  .toString()
            : error.message ?? 'Network error',
      );
    }
  }

  Future<bool> refresh() async {
    final refreshToken = await _storage.read(key: 'rift_refresh_token');
    if (refreshToken == null) return false;
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/api/auth/mobile/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = response.data!;
      _accessToken = data['accessToken'] as String;
      await _storage.write(key: 'rift_access_token', value: _accessToken);
      await _storage.write(
        key: 'rift_refresh_token',
        value: data['refreshToken'] as String,
      );
      return true;
    } catch (_) {
      await clearTokens();
      return false;
    }
  }

  Future<RiftUser> login(String username, String password) async =>
      _authResult('/api/auth/mobile/login', username, password);
  Future<RiftUser> register(String username, String password) async =>
      _authResult('/api/auth/mobile/register', username, password);
  Future<RiftUser> _authResult(
    String path,
    String username,
    String password,
  ) async {
    final data = await _json(
      path,
      method: 'POST',
      data: {
        'username': username,
        'password': password,
        'deviceName': 'Riftbound mobile',
      },
    );
    _accessToken = data['accessToken'] as String;
    await _storage.write(key: 'rift_access_token', value: _accessToken);
    await _storage.write(
      key: 'rift_refresh_token',
      value: data['refreshToken'] as String,
    );
    return RiftUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> me() => _json('/api/me');
  Future<List<GuardianRole>> roles() async {
    final data = await _json('/api/content');
    return (data['roles'] as List<dynamic>)
        .map((item) => GuardianRole.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<CardState> cardState(String token) async => CardState.fromJson(
    token,
    await _json('/api/card/state?token=${Uri.encodeComponent(token)}'),
  );
  Future<void> claimCard(String token, String avatarId) async => _json(
    '/api/cards/claim',
    method: 'POST',
    data: {'publicToken': token, 'avatarId': avatarId},
  );
  Future<Guardian> createGuardian(
    String name,
    String role,
    List<GuardianRole> roles,
  ) async {
    final data = await _json(
      '/api/avatars',
      method: 'POST',
      data: {'name': name, 'role': role},
    );
    return Guardian.fromJson(data['avatar'] as Map<String, dynamic>, roles);
  }
}

class RiftApiException implements Exception {
  RiftApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTeacherAccounts,
  resolveTeacherAccount,
  normalizeTeacherAccess,
} from '../server/config/teacher-accounts.js';

test('resolveTeacherAccount 按凭证命中身份，并忽略长度不同的误配', () => {
  const accounts = parseTeacherAccounts({
    TEACHER_ACCOUNTS: JSON.stringify([
      { id: 'exp-1', token: 'token-alpha', name: '体验教师1' },
      { id: 'exp-2', token: 'token-bravo', name: '体验教师2' },
    ]),
  });

  assert.equal(resolveTeacherAccount(accounts, 'token-bravo')?.id, 'exp-2');
  assert.equal(resolveTeacherAccount(accounts, 'token-alpha')?.experiencePack, true);
  assert.equal(resolveTeacherAccount(accounts, 'token-al'), null);
  assert.equal(resolveTeacherAccount(accounts, ''), null);
});

test('旧的单凭证 teacherAccess 配置仍能归一成账号名单', () => {
  const accounts = normalizeTeacherAccess({
    required: true,
    token: 'legacy-teacher-token',
    teacherId: 'teacher-from-server',
  });
  assert.deepEqual(accounts, [{
    id: 'teacher-from-server',
    token: 'legacy-teacher-token',
    name: '带队教师',
    experiencePack: false,
  }]);
  assert.equal(resolveTeacherAccount(accounts, 'legacy-teacher-token')?.id, 'teacher-from-server');
});

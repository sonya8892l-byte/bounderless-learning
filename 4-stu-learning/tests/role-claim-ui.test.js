import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  mergeRoleClaimProjection,
  roleClaimChoice,
} from '../src/engine/role-claim.js';

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const studentControllerPath = path.join(testsDirectory, '../src/app-controller.js');
const teacherAppPath = path.join(testsDirectory, '../../4-tea-leading/app.js');

test('正式场次把同组已领取角色禁用，同时允许本人继续自己的角色', () => {
  const base = {
    standalone: false,
    currentRoleId: '',
    claimedRoleId: 'role-a',
    takenRoleIds: ['role-a', 'role-b'],
    availableRoleIds: ['role-c'],
    rolesReleased: true,
    rolesLocked: false,
  };
  assert.deepEqual(roleClaimChoice({ ...base, roleId: 'role-b' }), {
    selectable: false,
    state: 'taken',
    label: '已领取',
    reason: '这个角色已被同组成员领取，请选择其他角色。',
  });
  assert.equal(roleClaimChoice({ ...base, roleId: 'role-a' }).selectable, true);
  assert.equal(roleClaimChoice({ ...base, roleId: 'role-a' }).label, '继续当前角色');
  assert.equal(roleClaimChoice({ ...base, roleId: 'role-c' }).selectable, true);
});

test('锁定角色后只允许进入本人已领取角色，本地预览仍可自由切换', () => {
  const locked = {
    standalone: false,
    claimedRoleId: 'role-a',
    rolesReleased: false,
    rolesLocked: true,
  };
  assert.equal(roleClaimChoice({ ...locked, roleId: 'role-a' }).selectable, true);
  assert.equal(roleClaimChoice({ ...locked, roleId: 'role-b' }).selectable, false);
  assert.equal(roleClaimChoice({ ...locked, roleId: 'role-b' }).label, '已锁定');
  assert.equal(roleClaimChoice({ ...locked, standalone: true, roleId: 'role-b' }).selectable, true);
});

test('角色领取投影保留响应中省略的字段，并接受明确清空', () => {
  const previous = {
    claimedRoleId: 'role-a',
    takenRoleIds: ['role-a', 'role-b'],
    availableRoleIds: ['role-c'],
  };
  assert.deepEqual(mergeRoleClaimProjection(previous, { rolesLocked: true }), previous);
  assert.deepEqual(mergeRoleClaimProjection(previous, {
    claimedRoleId: null,
    takenRoleIds: [],
    availableRoleIds: ['role-a', 'role-b', 'role-c'],
  }), {
    claimedRoleId: null,
    takenRoleIds: [],
    availableRoleIds: ['role-a', 'role-b', 'role-c'],
  });
});

test('正式角色领取先等服务端确认再切换当前轨道，冲突不清空原角色', () => {
  const source = fs.readFileSync(studentControllerPath, 'utf8');
  const selection = source.slice(
    source.indexOf('async function performRoleSelection'),
    source.indexOf('function renderHeader'),
  );
  const serviceConfirmation = selection.indexOf("if (!prototypeFreeRoleSelection && state.teacherClaimedRoleId !== role.id)");
  const trackCommit = selection.indexOf('state.currentRoleId = role.id;', selection.indexOf('// 正式场次先让服务端原子确认'));
  assert.ok(serviceConfirmation >= 0);
  assert.ok(trackCommit > serviceConfirmation);
  assert.match(selection, /error\?\.details\?\.runState/u);
  assert.doesNotMatch(selection, /catch \(error\)[\s\S]{0,500}state\.currentRoleId = null/u);
});

test('选择前阶段会话先在服务端领取角色，再复用到角色轨道', () => {
  const source = fs.readFileSync(studentControllerPath, 'utf8');
  const selection = source.slice(
    source.indexOf('async function performRoleSelection'),
    source.indexOf('function renderHeader'),
  );
  const claim = selection.indexOf('claimAgentRole(reusablePhaseSessionId, role.id)');
  const sessionCommit = selection.indexOf('roleState.agentSessionId = confirmedSessionId;');
  const phaseBindingCommit = selection.indexOf('state.phaseSessionBoundRoleId = role.id;');
  assert.ok(claim >= 0);
  assert.match(selection, /state\.phaseState\?\.completed[\s\S]*?state\.phaseState\?\.agentSessionId/u);
  assert.ok(sessionCommit > claim);
  assert.ok(phaseBindingCommit > claim);
  assert.doesNotMatch(selection.slice(0, claim), /roleState\.agentSessionId\s*=\s*reusablePhaseSessionId/u);
});

test('教师端不暴露专属链接与二维码产品入口', () => {
  const source = fs.readFileSync(teacherAppPath, 'utf8');
  assert.match(source, /participantRoleLabel\(participant\)[\s\S]*?待领取/u);
  assert.match(source, /角色由学生领取/u);
  assert.doesNotMatch(source, /copy-student-link|show-student-qr|专属入课/u);
  assert.doesNotMatch(source, /按现有小组和角色顺序分配/u);
  assert.doesNotMatch(source, /roleName\.slice\(/u);
});

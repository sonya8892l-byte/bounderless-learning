export class DatabaseConfigurationError extends Error {
  constructor(message = '持久化数据库尚未配置。') {
    super(message);
    this.name = 'DatabaseConfigurationError';
    this.statusCode = 503;
    this.code = 'DATABASE_NOT_CONFIGURED';
  }
}

export class DatabaseSchemaError extends Error {
  constructor(message = '数据库结构尚未完成迁移。') {
    super(message);
    this.name = 'DatabaseSchemaError';
    this.statusCode = 503;
    this.code = 'DATABASE_SCHEMA_NOT_READY';
  }
}

export class SessionWriteConflictError extends Error {
  constructor(sessionId) {
    super('会话已被另一个请求更新，请刷新后重试。');
    this.name = 'SessionWriteConflictError';
    this.statusCode = 409;
    this.code = 'SESSION_WRITE_CONFLICT';
    this.sessionId = sessionId;
  }
}

export class LearnerRequestLeaseConflictError extends Error {
  constructor(requestId) {
    super('请求租约已失效或已被接管。');
    this.name = 'LearnerRequestLeaseConflictError';
    this.statusCode = 409;
    this.code = 'LEARNER_REQUEST_LEASE_CONFLICT';
    this.requestId = requestId;
  }
}

export class CourseRunMutationConflictError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CourseRunMutationConflictError';
    this.statusCode = 409;
    this.code = code;
    this.details = details;
  }
}

export class ApplicationError implements Error {
  name: string;
  message: string;

  constructor(message?: string) {
    this.name = 'ApplicationError';
    this.message = message || 'Application error occurred';
  }

  toString(): string {
    return `${this.name} ${this.message}`;
  }

  toJSON(): string {
    return JSON.stringify({ message: this.message });
  }
}

export class PermissionError extends ApplicationError {
  constructor(message?: string) {
    super(message || 'This operation is not allowed');

    this.name = 'PermissionError';
  }
}

export class NonExistentError extends ApplicationError {
  constructor(message?: string) {
    super(message || 'Not Found');

    this.name = 'NonExistentError';
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';

export class TooManyRequestsException extends HttpException {
  constructor(response: string | object) {
    super(response, HttpStatus.TOO_MANY_REQUESTS);
  }
}
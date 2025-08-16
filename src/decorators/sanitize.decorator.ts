import { SetMetadata } from '@nestjs/common';
import { SanitizationOptions } from '../types';
import { SANITIZATION_OPTIONS_METADATA } from '../nestjs/constants';

export const Sanitize = (options: SanitizationOptions = {}): MethodDecorator => {
  return SetMetadata(SANITIZATION_OPTIONS_METADATA, options);
};
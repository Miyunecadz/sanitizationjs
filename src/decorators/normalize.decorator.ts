import { SetMetadata } from '@nestjs/common';
import { NormalizationOptions } from '../types';
import { NORMALIZATION_OPTIONS_METADATA } from '../nestjs/constants';

export const Normalize = (options: NormalizationOptions = {}): MethodDecorator => {
  return SetMetadata(NORMALIZATION_OPTIONS_METADATA, options);
};